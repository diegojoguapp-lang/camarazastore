import { supabase, isSupabaseConfigured } from './supabase'

export const ROLES = {
  admin: 'admin',
  reseller: 'reseller'
}

export async function getCurrentSession() {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function getCurrentProfile() {
  if (!isSupabaseConfigured) return null
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
  if (!userId) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id,reseller_code,role,full_name,phone,city,is_active')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export function hasActiveRole(profile, role) {
  return Boolean(profile?.is_active && profile?.role === role)
}

export function isActiveAdmin(profile) {
  return hasActiveRole(profile, ROLES.admin)
}

export function isActiveReseller(profile) {
  return hasActiveRole(profile, ROLES.reseller)
}

export async function signOut() {
  if (isSupabaseConfigured) await supabase.auth.signOut()
}
