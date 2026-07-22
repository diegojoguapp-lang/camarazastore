import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, isCorsOriginAllowed } from '../_shared/cors.ts'

type ManagePayload = {
  action?: 'reset-password' | 'set-active'
  userId?: string
  newTemporaryPassword?: string
  isActive?: boolean
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

function jsonResponse(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(request),
      'Content-Type': 'application/json'
    }
  })
}

function isUuid(value?: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
}

async function getRequesterAdminId(request: Request) {
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data: userData, error: userError } = await adminClient.auth.getUser(token)
  if (userError || !userData.user) return null

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id,role,is_active')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError || profile?.role !== 'admin' || profile?.is_active !== true) return null
  return userData.user.id
}

async function getTargetReseller(userId: string) {
  const { data, error } = await adminClient
    .from('profiles')
    .select('id,role,is_active')
    .eq('id', userId)
    .maybeSingle()

  if (error || data?.role !== 'reseller') return null
  return data
}

Deno.serve(async (request) => {
  if (!isCorsOriginAllowed(request)) {
    return jsonResponse(request, { error: 'Origen no permitido.' }, 403)
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) })
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Metodo no permitido.' }, 405)
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(request, { error: 'Funcion no configurada.' }, 500)
  }

  const adminId = await getRequesterAdminId(request)
  if (!adminId) {
    return jsonResponse(request, { error: 'No tenes permiso para administrar revendedores.' }, 403)
  }

  let payload: ManagePayload
  try {
    payload = await request.json()
  } catch {
    return jsonResponse(request, { error: 'Datos invalidos.' }, 400)
  }

  if (!isUuid(payload.userId)) {
    return jsonResponse(request, { error: 'Revendedor invalido.' }, 400)
  }

  const userId = String(payload.userId)
  const target = await getTargetReseller(userId)
  if (!target) {
    return jsonResponse(request, { error: 'Revendedor no encontrado.' }, 404)
  }

  if (payload.action === 'reset-password') {
    const newPassword = String(payload.newTemporaryPassword || '')
    if (newPassword.length < 8) {
      return jsonResponse(request, { error: 'La contrasena temporal debe tener minimo 8 caracteres.' }, 400)
    }

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword
    })

    if (error) return jsonResponse(request, { error: error.message || 'No se pudo restablecer la contrasena.' }, 400)
    return jsonResponse(request, { ok: true })
  }

  if (payload.action === 'set-active') {
    if (typeof payload.isActive !== 'boolean') {
      return jsonResponse(request, { error: 'Estado invalido.' }, 400)
    }

    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        is_active: payload.isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .eq('role', 'reseller')

    if (profileError) return jsonResponse(request, { error: 'No se pudo actualizar el estado.' }, 500)

    const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
      ban_duration: payload.isActive ? 'none' : '876000h'
    })

    if (authError) {
      await adminClient
        .from('profiles')
        .update({
          is_active: target.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .eq('role', 'reseller')
      return jsonResponse(request, { error: 'El perfil se actualizo, pero no se pudo actualizar el acceso Auth.' }, 500)
    }

    return jsonResponse(request, { ok: true, isActive: payload.isActive })
  }

  return jsonResponse(request, { error: 'Accion no soportada.' }, 400)
})
