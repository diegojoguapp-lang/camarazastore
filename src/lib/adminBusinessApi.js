import { supabase, isSupabaseConfigured } from './supabase'

async function call(name, params = {}) {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw error
  return data
}

export const getBusinessDashboard = (date = null) => call('get_admin_business_dashboard', { p_date: date })
export const getBusinessResellers = () => call('get_admin_business_resellers')
export const getBusinessReport = ({ period = 'month', from = null, to = null } = {}) =>
  call('get_admin_business_report', { p_from: from || null, p_to: to || null, p_period: period })
export const saveBusinessGoals = (goals) => call('admin_save_business_goals', {
  p_daily: Number(goals.daily_delivered_goal),
  p_weekly: Number(goals.weekly_delivered_goal),
  p_monthly: Number(goals.monthly_delivered_goal)
})
export const closeBusinessDay = (date) => call('admin_close_business_day', { p_date: date })
