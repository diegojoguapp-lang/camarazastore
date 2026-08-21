import { supabase, isSupabaseConfigured } from './supabase'

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

function money(value) {
  const number = Number(value || 0)
  if (!Number.isFinite(number) || number < 0) throw new Error('El monto no puede ser negativo.')
  return number
}

function uuidOrNull(value) {
  const clean = String(value || '').trim()
  return clean || null
}

export async function getFinancialDashboard() {
  requireSupabase()
  const { data, error } = await supabase.rpc('get_admin_finance_dashboard')
  if (error) throw error
  return data || {}
}

export async function getFinancialAccounts() {
  requireSupabase()
  const { data, error } = await supabase.rpc('get_financial_account_balances')
  if (error) throw error
  return data || []
}

export async function saveFinancialAccount(payload) {
  requireSupabase()
  const { data, error } = await supabase.rpc('admin_save_financial_account', {
    p_account_id: uuidOrNull(payload.id),
    p_name: payload.name?.trim(),
    p_account_type: payload.account_type || 'cash',
    p_bank_name: payload.bank_name?.trim() || null,
    p_account_number: payload.account_number?.trim() || null,
    p_account_holder: payload.account_holder?.trim() || null,
    p_initial_balance: money(payload.initial_balance),
    p_is_active: payload.is_active !== false,
    p_is_cash_account: Boolean(payload.is_cash_account),
    p_sort_order: Number(payload.sort_order || 0)
  })
  if (error) throw error
  return data
}

export async function getFinancialMovements(filters = {}) {
  requireSupabase()
  let query = supabase
    .from('financial_movements')
    .select('*,account:financial_accounts(id,name,account_type)')
    .order('occurred_at', { ascending: false })
    .limit(200)
  if (filters.account_id) query = query.eq('account_id', filters.account_id)
  if (filters.direction) query = query.eq('direction', filters.direction)
  if (filters.movement_type) query = query.eq('movement_type', filters.movement_type)
  if (filters.date_from) query = query.gte('occurred_at', `${filters.date_from}T00:00:00`)
  if (filters.date_to) query = query.lt('occurred_at', `${filters.date_to}T23:59:59`)
  const { data, error } = await query
  if (error) throw error
  const search = String(filters.search || '').trim().toLowerCase()
  if (!search) return data || []
  return (data || []).filter((row) => [
    row.description,
    row.reference,
    row.source_type,
    row.account?.name
  ].join(' ').toLowerCase().includes(search))
}

export async function createManualMovement(payload) {
  requireSupabase()
  const { data, error } = await supabase.rpc('admin_create_financial_movement', {
    p_account_id: uuidOrNull(payload.account_id),
    p_direction: payload.direction,
    p_amount: money(payload.amount),
    p_description: payload.description?.trim(),
    p_movement_type: payload.movement_type || null,
    p_occurred_at: payload.occurred_at ? new Date(payload.occurred_at).toISOString() : null,
    p_reference: payload.reference?.trim() || null
  })
  if (error) throw error
  return data
}

export async function createAccountTransfer(payload) {
  requireSupabase()
  const { data, error } = await supabase.rpc('admin_create_account_transfer', {
    p_from_account_id: uuidOrNull(payload.from_account_id),
    p_to_account_id: uuidOrNull(payload.to_account_id),
    p_amount: money(payload.amount),
    p_description: payload.description?.trim() || null,
    p_occurred_at: payload.occurred_at ? new Date(payload.occurred_at).toISOString() : null
  })
  if (error) throw error
  return data
}

export async function getCashSessions() {
  requireSupabase()
  const { data, error } = await supabase
    .from('cash_sessions')
    .select('*,account:financial_accounts(id,name,account_type)')
    .order('opened_at', { ascending: false })
    .limit(100)
  if (error) throw error
  const accounts = await getFinancialAccounts()
  const balanceMap = new Map(accounts.map((account) => [account.id, account]))
  return (data || []).map((session) => ({
    ...session,
    account: {
      ...(session.account || {}),
      current_balance: balanceMap.get(session.financial_account_id)?.current_balance
    }
  }))
}

export async function openCashSession(payload) {
  requireSupabase()
  const { data, error } = await supabase.rpc('admin_open_cash_session', {
    p_financial_account_id: uuidOrNull(payload.financial_account_id),
    p_counted_balance: money(payload.counted_balance),
    p_register_difference: Boolean(payload.register_difference),
    p_notes: payload.notes?.trim() || null
  })
  if (error) throw error
  return data
}

export async function closeCashSession(payload) {
  requireSupabase()
  const { data, error } = await supabase.rpc('admin_close_cash_session', {
    p_session_id: uuidOrNull(payload.session_id),
    p_counted_balance: money(payload.counted_balance),
    p_register_difference: Boolean(payload.register_difference),
    p_notes: payload.notes?.trim() || null
  })
  if (error) throw error
  return data
}
