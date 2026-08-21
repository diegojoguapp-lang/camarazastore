import { supabase, isSupabaseConfigured } from './supabase'

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

export async function getAdminDashboard() {
  requireSupabase()
  const [{ data, error }, financeResult] = await Promise.all([
    supabase.rpc('get_admin_dashboard'),
    supabase.rpc('get_admin_finance_dashboard').catch(() => ({ data: {}, error: null }))
  ])
  if (error) throw error
  return { ...(data || {}), ...(financeResult.data || {}) }
}

export async function adminGlobalSearch(term) {
  requireSupabase()
  const clean = String(term || '').trim()
  if (clean.length < 2) return []
  const { data, error } = await supabase.rpc('admin_global_search', { p_term: clean })
  if (error) throw error
  return data || []
}
