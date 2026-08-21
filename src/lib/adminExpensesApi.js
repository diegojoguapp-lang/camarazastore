import { supabase, isSupabaseConfigured } from './supabase'

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

function positive(value, label = 'El monto') {
  const number = Number(value || 0)
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} debe ser mayor que cero.`)
  return number
}

export async function getExpenseCategories({ includeInactive = false } = {}) {
  requireSupabase()
  let query = supabase.from('expense_categories').select('*').order('sort_order').order('name')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function saveExpenseCategory(payload) {
  requireSupabase()
  const clean = {
    name: payload.name?.trim(),
    is_active: payload.is_active !== false,
    sort_order: Number(payload.sort_order || 0),
    updated_at: new Date().toISOString()
  }
  if (!clean.name) throw new Error('El nombre de la categoria es obligatorio.')
  const query = payload.id
    ? supabase.from('expense_categories').update(clean).eq('id', payload.id)
    : supabase.from('expense_categories').insert(clean)
  const { data, error } = await query.select('*').single()
  if (error) throw error
  return data
}

export async function getExpenses(filters = {}) {
  requireSupabase()
  let query = supabase
    .from('expenses')
    .select('*,category:expense_categories(id,name),account:financial_accounts(id,name)')
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.category_id) query = query.eq('category_id', filters.category_id)
  if (filters.account_id) query = query.eq('account_id', filters.account_id)
  if (filters.date_from) query = query.gte('expense_date', filters.date_from)
  if (filters.date_to) query = query.lte('expense_date', filters.date_to)
  const { data, error } = await query
  if (error) throw error
  const search = String(filters.search || '').trim().toLowerCase()
  if (!search) return data || []
  return (data || []).filter((row) => [
    row.description,
    row.notes,
    row.category?.name,
    row.account?.name
  ].join(' ').toLowerCase().includes(search))
}

export async function createExpense(payload) {
  requireSupabase()
  const { data, error } = await supabase.rpc('admin_create_expense', {
    p_category_id: payload.category_id,
    p_account_id: payload.account_id,
    p_description: payload.description?.trim(),
    p_amount: positive(payload.amount),
    p_expense_date: payload.expense_date || null,
    p_notes: payload.notes?.trim() || null
  })
  if (error) throw error
  return data
}

export async function cancelExpense(id, notes = '') {
  requireSupabase()
  const { data, error } = await supabase.rpc('admin_cancel_expense', {
    p_expense_id: id,
    p_notes: notes?.trim() || null
  })
  if (error) throw error
  return data
}
