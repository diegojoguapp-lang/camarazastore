import { supabase, isSupabaseConfigured } from './supabase'
import { getCurrentProfile } from './roles'
import { operationRpc } from './operationApi'

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
  const rows = []
  for (let offset = 0; ; offset += 100) {
    const page = await operationRpc('get_my_payment_receipts_v2', { p_offset: offset })
    rows.push(...page)
    if (page.length < 100) return rows
  }
}

export async function getMyCommissionPayment(id) {
  requireSupabase()
  const rows = await operationRpc('get_my_payment_receipts_v2', { p_id: id })
  if (!rows.length) throw new Error('Liquidacion no encontrada.')
  return rows[0]
}

export async function getMyCommissionPaymentItems(paymentId) {
  return (await getMyCommissionPayment(paymentId)).items
}

export async function getMyCommissionPaymentAdjustments(paymentId) {
  return (await getMyCommissionPayment(paymentId)).applied_adjustments
}
