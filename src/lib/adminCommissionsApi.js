import { supabase, isSupabaseConfigured } from './supabase'
import { getCurrentSession } from './roles'
import { getNextCommissionPayment } from './dateUtils'
import { calculateNetPaid } from './commissionConstants'

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

async function currentUserId() {
  const session = await getCurrentSession()
  const userId = session?.user?.id
  if (!userId) throw new Error('Sesion no valida.')
  return userId
}

function toDateOnly(value) {
  return new Date(value).toISOString().slice(0, 10)
}

export async function getCommissionBatches() {
  requireSupabase()
  const { data, error } = await supabase
    .from('commission_batches')
    .select('*')
    .order('period_start', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createCommissionBatch(period, notes = '') {
  requireSupabase()
  const createdBy = await currentUserId()
  const payment = getNextCommissionPayment(period.endExclusive)
  const payload = {
    period_start: toDateOnly(period.start),
    period_end: toDateOnly(new Date(period.endExclusive.getTime() - 1)),
    payment_day: toDateOnly(payment.date),
    status: 'draft',
    created_by: createdBy,
    notes: notes.trim() || null
  }
  const { data, error } = await supabase.from('commission_batches').insert(payload).select('*').single()
  if (error) throw error
  return data
}

export async function updateCommissionBatchStatus(id, status) {
  requireSupabase()
  const { data, error } = await supabase
    .from('commission_batches')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function getCommissionBatch(id) {
  requireSupabase()
  const { data, error } = await supabase
    .from('commission_batches')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function getEligibleSalesForBatch(batch) {
  requireSupabase()
  const endExclusive = new Date(`${batch.period_end}T00:00:00`)
  endExclusive.setDate(endExclusive.getDate() + 1)

  const { data, error } = await supabase
    .from('sales')
    .select(`
      id,
      reseller_id,
      product_name_snapshot,
      reseller_commission,
      delivered_at,
      commission_paid,
      reseller:profiles(id,reseller_code,full_name,email,city)
    `)
    .eq('status', 'delivered_paid')
    .eq('commission_paid', false)
    .gte('delivered_at', `${batch.period_start}T00:00:00`)
    .lt('delivered_at', `${endExclusive.toISOString().slice(0, 10)}T00:00:00`)
    .order('delivered_at', { ascending: true })
  if (error) throw error
  return data || []
}

export function groupSalesByReseller(sales = []) {
  const groups = new Map()
  sales.forEach((sale) => {
    const key = sale.reseller_id
    const current = groups.get(key) || {
      reseller: sale.reseller,
      reseller_id: key,
      sales: [],
      total: 0
    }
    current.sales.push(sale)
    current.total += Number(sale.reseller_commission || 0)
    groups.set(key, current)
  })
  return Array.from(groups.values())
}

export async function getBankAccountForReseller(resellerId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('reseller_id', resellerId)
    .eq('is_primary', true)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getPaymentsForBatch(batchId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('commission_payments')
    .select('*,reseller:profiles(id,reseller_code,full_name,email)')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getCommissionPayment(id) {
  requireSupabase()
  const { data, error } = await supabase
    .from('commission_payments')
    .select('*,batch:commission_batches(*),reseller:profiles(id,reseller_code,full_name,email)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function getPaymentItems(paymentId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('commission_payment_items')
    .select('*,sale:sales(id,product_name_snapshot,delivered_at,reseller_commission)')
    .eq('payment_id', paymentId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createCommissionPayment({ batchId, resellerId, sales, bankAccount, form }) {
  requireSupabase()
  const createdBy = await currentUserId()
  const gross = sales.reduce((sum, sale) => sum + Number(sale.reseller_commission || 0), 0)
  const adjustments = Number(form.adjustments || 0)
  const discounts = Number(form.discounts || 0)
  const paymentPayload = {
    batch_id: batchId,
    reseller_id: resellerId,
    bank_name_snapshot: bankAccount?.bank_name || '',
    bank_alias_snapshot: bankAccount?.bank_alias || '',
    bank_holder_snapshot: bankAccount?.bank_holder || '',
    bank_document_snapshot: bankAccount?.bank_document || '',
    gross_commission: gross,
    adjustments,
    discounts,
    net_paid: calculateNetPaid({ gross_commission: gross, adjustments, discounts }),
    payment_date: form.payment_date || toDateOnly(new Date()),
    payment_method: form.payment_method?.trim() || null,
    voucher_url: form.voucher_url?.trim() || null,
    voucher_number: form.voucher_number?.trim() || null,
    status: 'pending',
    created_by: createdBy,
    notes: form.notes?.trim() || null
  }

  const { data: payment, error: paymentError } = await supabase
    .from('commission_payments')
    .insert(paymentPayload)
    .select('*')
    .single()
  if (paymentError) throw paymentError

  const items = sales.map((sale) => ({
    payment_id: payment.id,
    sale_id: sale.id,
    commission_amount_snapshot: Number(sale.reseller_commission || 0)
  }))
  const { error: itemError } = await supabase.from('commission_payment_items').insert(items)
  if (itemError) throw itemError

  const { data: paidPayment, error: paidError } = await supabase
    .from('commission_payments')
    .update({ status: 'paid' })
    .eq('id', payment.id)
    .select('*')
    .single()
  if (paidError) throw paidError
  return paidPayment
}

export async function cancelCommissionPayment(id, notes = '') {
  requireSupabase()
  const { data, error } = await supabase
    .from('commission_payments')
    .update({ status: 'cancelled', notes: notes.trim() || null })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}
