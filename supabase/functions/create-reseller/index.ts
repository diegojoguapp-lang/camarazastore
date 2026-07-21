import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type CreatePayload = {
  email?: string
  temporaryPassword?: string
  fullName?: string
  phone?: string
  city?: string
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*'

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? ''
  const allowed = allowedOrigin.split(',').map((item) => item.trim()).filter(Boolean)
  const allowOrigin = allowedOrigin === '*'
    ? '*'
    : allowed.includes(origin)
      ? origin
      : allowed[0] ?? ''

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  }
}

function isOriginAllowed(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin || allowedOrigin === '*') return true
  return allowedOrigin.split(',').map((item) => item.trim()).includes(origin)
}

function jsonResponse(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json'
    }
  })
}

function cleanText(value?: string) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function normalizeEmail(value?: string) {
  return String(value || '').trim().toLowerCase()
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(request) })
  }

  if (!isOriginAllowed(request)) {
    return jsonResponse(request, { error: 'Origen no permitido.' }, 403)
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Metodo no permitido.' }, 405)
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(request, { error: 'Funcion no configurada.' }, 500)
  }

  const adminId = await getRequesterAdminId(request)
  if (!adminId) {
    return jsonResponse(request, { error: 'No tenes permiso para crear revendedores.' }, 403)
  }

  let payload: CreatePayload
  try {
    payload = await request.json()
  } catch {
    return jsonResponse(request, { error: 'Datos invalidos.' }, 400)
  }

  const email = normalizeEmail(payload.email)
  const temporaryPassword = String(payload.temporaryPassword || '')
  const fullName = cleanText(payload.fullName)
  const phone = cleanText(payload.phone) || null
  const city = cleanText(payload.city) || null

  if (!isEmail(email)) return jsonResponse(request, { error: 'Correo electronico invalido.' }, 400)
  if (temporaryPassword.length < 8) return jsonResponse(request, { error: 'La contrasena temporal debe tener minimo 8 caracteres.' }, 400)
  if (!fullName) return jsonResponse(request, { error: 'El nombre completo es obligatorio.' }, 400)

  const { data: existingProfile, error: existingError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingError) return jsonResponse(request, { error: 'No se pudo validar el correo.' }, 500)
  if (existingProfile) return jsonResponse(request, { error: 'Ya existe un revendedor con ese correo.' }, 409)

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: 'reseller'
    }
  })

  if (authError || !authData.user?.id) {
    return jsonResponse(request, { error: authError?.message || 'No se pudo crear el usuario.' }, 400)
  }

  const userId = authData.user.id
  if (!isUuid(userId)) {
    return jsonResponse(request, { error: 'Usuario creado con identificador invalido.' }, 500)
  }

  const { data: resellerCode, error: codeError } = await adminClient.rpc('next_reseller_code')
  if (codeError || !resellerCode) {
    await adminClient.auth.admin.deleteUser(userId)
    return jsonResponse(request, { error: 'No se pudo generar el codigo de revendedor.' }, 500)
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .insert({
      id: userId,
      email,
      reseller_code: resellerCode,
      role: 'reseller',
      full_name: fullName,
      phone,
      city,
      is_active: true,
      created_by: adminId,
      updated_at: new Date().toISOString()
    })
    .select('id,reseller_code,email,full_name,is_active')
    .single()

  if (profileError || !profile) {
    await adminClient.auth.admin.deleteUser(userId)
    return jsonResponse(request, { error: 'No se pudo crear el perfil del revendedor.' }, 500)
  }

  return jsonResponse(request, {
    id: profile.id,
    resellerCode: profile.reseller_code,
    email: profile.email,
    fullName: profile.full_name,
    isActive: profile.is_active
  })
})
