import { supabase, isSupabaseConfigured } from './supabase'
import { normalizePhone } from './privacy'

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

const CUSTOMER_FIELDS = 'id,full_name,phone,normalized_phone,city,neighborhood,address,map_url,reference,requires_advance_payment,notes,created_at,updated_at'

export async function getCustomers(search = '') {
  requireSupabase()
  const term = String(search || '').trim()
  let query = supabase
    .from('customers')
    .select(CUSTOMER_FIELDS)
    .order('created_at', { ascending: false })
    .limit(80)

  if (term) {
    const phone = normalizePhone(term)
    query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,normalized_phone.ilike.%${phone}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getCustomerById(id) {
  requireSupabase()
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_FIELDS)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function getCustomerByPhone(phone) {
  requireSupabase()
  const normalized = normalizePhone(phone)
  if (!normalized) return null
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_FIELDS)
    .eq('normalized_phone', normalized)
    .order('created_at', { ascending: false })
    .limit(5)
  if (error) throw error
  return data || []
}

export async function createCustomer(payload) {
  requireSupabase()
  const clean = {
    ...payload,
    full_name: payload.full_name?.trim(),
    phone: payload.phone?.trim(),
    normalized_phone: normalizePhone(payload.phone || payload.normalized_phone),
    city: payload.city?.trim() || null,
    neighborhood: payload.neighborhood?.trim() || null,
    address: payload.address?.trim() || null,
    map_url: payload.map_url?.trim() || null,
    reference: payload.reference?.trim() || null,
    notes: payload.notes?.trim() || null,
    requires_advance_payment: Boolean(payload.requires_advance_payment)
  }
  const { data, error } = await supabase.from('customers').insert(clean).select(CUSTOMER_FIELDS).single()
  if (error) throw error
  return data
}

export async function updateCustomer(id, payload) {
  requireSupabase()
  const clean = {
    ...payload,
    full_name: payload.full_name?.trim(),
    phone: payload.phone?.trim(),
    normalized_phone: normalizePhone(payload.phone || payload.normalized_phone),
    city: payload.city?.trim() || null,
    neighborhood: payload.neighborhood?.trim() || null,
    address: payload.address?.trim() || null,
    map_url: payload.map_url?.trim() || null,
    reference: payload.reference?.trim() || null,
    notes: payload.notes?.trim() || null,
    requires_advance_payment: Boolean(payload.requires_advance_payment)
  }
  const { data, error } = await supabase.from('customers').update(clean).eq('id', id).select(CUSTOMER_FIELDS).single()
  if (error) throw error
  return data
}
