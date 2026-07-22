import { supabase, isSupabaseConfigured } from './supabase'
import { getCurrentSession } from './roles'
import { calculateSaleTotals } from './salesConstants'

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

const SALE_SELECT = `
  *,
  customer:customers(id,full_name,phone,city,neighborhood,address,map_url,reference,requires_advance_payment,notes),
  reseller:profiles(id,reseller_code,full_name,email,city),
  product:products(id,name,model,main_image_url)
`

function cleanNumber(value) {
  const number = Number(value || 0)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

function cleanSalePayload(payload) {
  const totals = calculateSaleTotals(payload)
  return {
    reseller_id: payload.reseller_id,
    customer_id: payload.customer_id,
    product_id: payload.product_id || null,
    product_name_snapshot: payload.product_name_snapshot?.trim(),
    product_model_snapshot: payload.product_model_snapshot?.trim() || null,
    quantity: Math.max(Number(payload.quantity || 1), 1),
    status: payload.status || 'pending_contact',
    admin_notes: payload.admin_notes?.trim() || null,
    reseller_visible_notes: payload.reseller_visible_notes?.trim() || null,
    product_sale_price: cleanNumber(payload.product_sale_price),
    product_cost: cleanNumber(payload.product_cost),
    delivery_charged: cleanNumber(payload.delivery_charged),
    delivery_cost: cleanNumber(payload.delivery_cost),
    reseller_commission: cleanNumber(payload.reseller_commission),
    other_costs: cleanNumber(payload.other_costs),
    total_collected: totals.total_collected,
    camaraza_net_profit: totals.camaraza_net_profit,
    delivery_city: payload.delivery_city?.trim() || null,
    delivery_neighborhood: payload.delivery_neighborhood?.trim() || null,
    delivery_address: payload.delivery_address?.trim() || null,
    delivery_map_url: payload.delivery_map_url?.trim() || null,
    delivery_reference: payload.delivery_reference?.trim() || null,
    delivery_schedule: payload.delivery_schedule?.trim() || null,
    payment_method: payload.payment_method?.trim() || null,
    amount_received: cleanNumber(payload.amount_received)
  }
}

export async function getAdminSales(filters = {}) {
  requireSupabase()
  let query = supabase
    .from('sales')
    .select(SALE_SELECT)
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.reseller_id) query = query.eq('reseller_id', filters.reseller_id)
  if (filters.product_id) query = query.eq('product_id', filters.product_id)
  if (filters.date_from) query = query.gte('created_at', `${filters.date_from}T00:00:00`)
  if (filters.date_to) query = query.lte('created_at', `${filters.date_to}T23:59:59`)

  const { data, error } = await query
  if (error) throw error

  const search = String(filters.search || '').trim().toLowerCase()
  const city = String(filters.city || '').trim().toLowerCase()
  return (data || []).filter((sale) => {
    const haystack = [
      sale.product_name_snapshot,
      sale.customer?.full_name,
      sale.customer?.phone,
      sale.reseller?.full_name,
      sale.reseller?.reseller_code
    ].join(' ').toLowerCase()
    const cityMatch = !city || String(sale.customer?.city || sale.delivery_city || '').toLowerCase().includes(city)
    return (!search || haystack.includes(search)) && cityMatch
  })
}

export async function getAdminSaleById(id) {
  requireSupabase()
  const { data, error } = await supabase
    .from('sales')
    .select(SALE_SELECT)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function getSaleEvents(saleId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('sale_events')
    .select('*')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createSale(payload) {
  requireSupabase()
  const session = await getCurrentSession()
  const createdBy = session?.user?.id
  if (!createdBy) throw new Error('Sesion no valida.')

  const clean = {
    ...cleanSalePayload(payload),
    created_by: createdBy
  }
  const { data, error } = await supabase.from('sales').insert(clean).select('id').single()
  if (error) throw error
  return data
}

export async function updateSale(id, payload) {
  requireSupabase()
  const clean = cleanSalePayload(payload)
  const { data, error } = await supabase.from('sales').update(clean).eq('id', id).select('id').single()
  if (error) throw error
  return data
}

export async function updateSaleStatus(id, status, notes = '') {
  requireSupabase()
  const { data, error } = await supabase
    .from('sales')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id,status')
    .single()
  if (error) throw error

  if (notes.trim()) {
    await supabase.from('sale_events').insert({
      sale_id: id,
      event_type: 'status_note',
      to_status: status,
      notes: notes.trim()
    })
  }

  return data
}

export async function getSalesSummary(filters = {}) {
  const sales = await getAdminSales(filters)
  return {
    totalSales: sales.length,
    deliveredSales: sales.filter((sale) => sale.status === 'delivered_paid').length,
    totalCollected: sales
      .filter((sale) => sale.status === 'delivered_paid')
      .reduce((sum, sale) => sum + Number(sale.total_collected || 0), 0),
    totalCommissions: sales
      .filter((sale) => sale.status === 'delivered_paid')
      .reduce((sum, sale) => sum + Number(sale.reseller_commission || 0), 0),
    netProfit: sales
      .filter((sale) => sale.status === 'delivered_paid')
      .reduce((sum, sale) => sum + Number(sale.camaraza_net_profit || 0), 0)
  }
}
