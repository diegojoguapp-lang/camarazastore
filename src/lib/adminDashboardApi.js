import { supabase, isSupabaseConfigured } from './supabase'

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

export async function getAdminDashboard() {
  requireSupabase()
  const [dashboardResult, financeResult] = await Promise.all([
    supabase.rpc('get_admin_dashboard'),
    getOptionalFinanceDashboard()
  ])
  const { data, error } = dashboardResult
  if (error) throw error
  return { ...(data || {}), ...(financeResult.data || {}) }
}

async function getOptionalFinanceDashboard() {
  try {
    const result = await supabase.rpc('get_admin_finance_dashboard')
    return result?.error ? { data: {}, error: result.error } : result
  } catch (error) {
    return { data: {}, error }
  }
}

export async function adminGlobalSearch(term) {
  requireSupabase()
  const clean = String(term || '').trim()
  if (clean.length < 2) return []
  const { data, error } = await supabase.rpc('admin_business_search', { p_term: clean })
  if (error) throw error
  return data || []
}
