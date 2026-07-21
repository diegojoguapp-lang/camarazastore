import { supabase, isSupabaseConfigured } from './supabase'

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no estÃ¡ configurado.')
}

async function functionError(error, fallback) {
  const response = error?.context
  if (response?.json) {
    try {
      const body = await response.json()
      return new Error(body?.error || fallback)
    } catch {
      return new Error(fallback)
    }
  }
  return new Error(error?.message || fallback)
}

export async function getResellers() {
  requireSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .select('id,reseller_code,email,full_name,phone,city,is_active,created_at')
    .eq('role', 'reseller')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createReseller(payload) {
  requireSupabase()
  const { data, error } = await supabase.functions.invoke('create-reseller', {
    body: payload
  })

  if (error) throw await functionError(error, 'No se pudo crear el revendedor.')
  if (data?.error) throw new Error(data.error)
  return data
}

export async function resetResellerPassword(userId, newTemporaryPassword) {
  requireSupabase()
  const { data, error } = await supabase.functions.invoke('manage-reseller', {
    body: {
      action: 'reset-password',
      userId,
      newTemporaryPassword
    }
  })

  if (error) throw await functionError(error, 'No se pudo restablecer la contraseÃ±a.')
  if (data?.error) throw new Error(data.error)
  return data
}

export async function setResellerActive(userId, isActive) {
  requireSupabase()
  const { data, error } = await supabase.functions.invoke('manage-reseller', {
    body: {
      action: 'set-active',
      userId,
      isActive
    }
  })

  if (error) throw await functionError(error, 'No se pudo actualizar el estado.')
  if (data?.error) throw new Error(data.error)
  return data
}
