import { supabase, isSupabaseConfigured } from './supabase'
import { getAdminCommissionBalances } from './operationApi'

async function call(name, params = {}) {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
  try {
    const { data, error } = await supabase.rpc(name, params)
    if (error) throw normalizeBusinessError(error)
    return data
  } catch (error) {
    throw normalizeBusinessError(error)
  }
}

function normalizeBusinessError(error) {
  if (error?.isBusinessDashboardError) return error

  const message = String(error?.message || '')
  const code = String(error?.code || '')
  const missingRpc = code === 'PGRST202'
    || /could not find the function|function public\.[^(]+\([^)]*\) does not exist/i.test(message)

  if (missingRpc) {
    const normalized = new Error('Las funciones del Dashboard todavía no están disponibles en la base de datos.')
    normalized.code = 'BUSINESS_DASHBOARD_NOT_AVAILABLE'
    normalized.cause = error
    normalized.isBusinessDashboardError = true
    return normalized
  }

  const normalized = new Error(message || 'No se pudieron cargar los indicadores del Dashboard.')
  normalized.code = code || 'BUSINESS_DASHBOARD_ERROR'
  normalized.cause = error
  normalized.isBusinessDashboardError = true
  return normalized
}

export async function getBusinessDashboard(date = null) {
  const [data, balances] = await Promise.all([call('get_admin_business_dashboard', { p_date: date }), getAdminCommissionBalances()])
  return { ...data, finance: { ...data.finance, pending_commissions: balances.reduce((total, row) => total + Number(row.available || 0), 0) } }
}
export const getBusinessResellers = () => call('get_admin_business_resellers')
export const getBusinessReport = ({ period = 'month', from = null, to = null } = {}) =>
  call('get_admin_business_report', { p_from: from || null, p_to: to || null, p_period: period })
export const saveBusinessGoals = (goals) => call('admin_save_business_goals', {
  p_daily: Number(goals.daily_delivered_goal),
  p_weekly: Number(goals.weekly_delivered_goal),
  p_monthly: Number(goals.monthly_delivered_goal)
})
export const closeBusinessDay = (date) => call('admin_close_business_day', { p_date: date })
