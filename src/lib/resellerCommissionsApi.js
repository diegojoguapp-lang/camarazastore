import { supabase, isSupabaseConfigured } from './supabase'
import { getCurrentProfile } from './roles'

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

export async function getMyBankAccount() {
  requireSupabase()
  const profile = await getCurrentProfile()
  if (!profile?.id) throw new Error('Perfil no disponible.')
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('reseller_id', profile.id)
    .eq('is_primary', true)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveMyBankAccount(payload) {
  requireSupabase()
  const profile = await getCurrentProfile()
  if (!profile?.id) throw new Error('Perfil no disponible.')
  const existing = await getMyBankAccount()
  const clean = {
    reseller_id: profile.id,
    bank_name: payload.bank_name?.trim(),
    bank_alias: payload.bank_alias?.trim() || null,
    bank_holder: payload.bank_holder?.trim(),
    bank_document: payload.bank_document?.trim() || null,
    account_type: payload.account_type?.trim() || null,
    is_primary: true,
    created_by: profile.id
  }
  const query = existing?.id
    ? supabase.from('bank_accounts').update(clean).eq('id', existing.id).select('*').single()
    : supabase.from('bank_accounts').insert(clean).select('*').single()
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getMyCommissionPayments() {
  requireSupabase()
  const { data, error } = await supabase
    .from('commission_payments')
    .select('*,batch:commission_batches(period_start,period_end,payment_day,status)')
    .order('payment_date', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getMyCommissionPayment(id) {
  requireSupabase()
  const { data, error } = await supabase
    .from('commission_payments')
    .select('*,batch:commission_batches(period_start,period_end,payment_day,status)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function getMyCommissionPaymentItems(paymentId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('commission_payment_items')
    .select('*,sale:sales(id,product_name_snapshot,delivered_at)')
    .eq('payment_id', paymentId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}
