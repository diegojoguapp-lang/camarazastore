import { supabase, isSupabaseConfigured } from './supabase'

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

function cleanItems(items = []) {
  return items.map((item) => ({
    product_id: item.product_id,
    quantity: Number(item.quantity || 0),
    unit_cost: Number(item.unit_cost || 0)
  })).filter((item) => item.product_id && item.quantity > 0 && item.unit_cost >= 0)
}

export async function getPurchases(filters = {}) {
  requireSupabase()
  let query = supabase
    .from('purchases')
    .select('*,supplier:suppliers(id,name),account:financial_accounts(id,name),items:purchase_items(*)')
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.supplier_id) query = query.eq('supplier_id', filters.supplier_id)
  if (filters.date_from) query = query.gte('purchase_date', filters.date_from)
  if (filters.date_to) query = query.lte('purchase_date', filters.date_to)
  const { data, error } = await query
  if (error) throw error
  const search = String(filters.search || '').trim().toLowerCase()
  if (!search) return data || []
  return (data || []).filter((row) => [
    row.supplier?.name,
    row.notes,
    ...(row.items || []).map((item) => item.product_name_snapshot)
  ].join(' ').toLowerCase().includes(search))
}

export async function getPurchase(id) {
  requireSupabase()
  const { data, error } = await supabase
    .from('purchases')
    .select('*,supplier:suppliers(id,name),account:financial_accounts(id,name),items:purchase_items(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function savePurchase(payload) {
  requireSupabase()
  const items = cleanItems(payload.items)
  if (!items.length) throw new Error('Agrega al menos un producto.')
  const { data, error } = await supabase.rpc('admin_save_purchase', {
    p_purchase_id: payload.id || null,
    p_supplier_id: payload.supplier_id || null,
    p_purchase_date: payload.purchase_date || null,
    p_notes: payload.notes?.trim() || null,
    p_items: items
  })
  if (error) throw error
  return data
}

export async function confirmPurchase(payload) {
  requireSupabase()
  const { data, error } = await supabase.rpc('admin_confirm_purchase', {
    p_purchase_id: payload.purchase_id,
    p_register_payment: Boolean(payload.register_payment),
    p_financial_account_id: payload.register_payment ? payload.financial_account_id : null
  })
  if (error) throw error
  return data
}

export async function cancelPurchase(id) {
  requireSupabase()
  const { data, error } = await supabase.rpc('admin_cancel_purchase', { p_purchase_id: id })
  if (error) throw error
  return data
}
