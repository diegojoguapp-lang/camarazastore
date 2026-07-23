import { supabase, isSupabaseConfigured } from './supabase'

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] : data
}

export async function getMyGoals() {
  requireSupabase()
  const { data, error } = await supabase.rpc('get_my_goals')
  if (error) throw error
  return firstRow(data) || { weekly_sales_goal: 10, weekly_commission_goal: 500000 }
}

export async function updateMyGoals({ weekly_sales_goal, weekly_commission_goal }) {
  requireSupabase()
  const { data, error } = await supabase.rpc('update_my_goals', {
    p_weekly_sales_goal: Number(weekly_sales_goal || 0),
    p_weekly_commission_goal: Number(weekly_commission_goal || 0)
  })
  if (error) throw error
  return firstRow(data)
}

export async function getMyActivity(limit = 30) {
  requireSupabase()
  const { data, error } = await supabase.rpc('get_my_activity', { p_limit: limit })
  if (error) throw error
  return data || []
}

export async function getMyAchievements() {
  requireSupabase()
  const { data, error } = await supabase.rpc('get_my_achievements')
  if (error) throw error
  return data || []
}

export async function getMyPerformance() {
  requireSupabase()
  const { data, error } = await supabase.rpc('get_my_performance')
  if (error) throw error
  return data || {}
}

