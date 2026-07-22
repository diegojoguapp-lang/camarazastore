const allowedHeaders = 'authorization, x-client-info, apikey, content-type'
const allowedMethods = 'POST, OPTIONS'
const vercelPreviewSuffix = '.vercel.app'
const vercelProjectPrefix = 'camarazastore-'

function configuredOrigins() {
  return (Deno.env.get('ALLOWED_ORIGIN') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function isAllowedVercelPreview(origin: string) {
  try {
    const url = new URL(origin)
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith(vercelPreviewSuffix) &&
      url.hostname.startsWith(vercelProjectPrefix)
    )
  } catch {
    return false
  }
}

export function isCorsOriginAllowed(req: Request) {
  const origin = req.headers.get('origin')
  if (!origin) return true
  return configuredOrigins().includes(origin) || isAllowedVercelPreview(origin)
}

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': allowedHeaders,
    'Access-Control-Allow-Methods': allowedMethods,
    'Vary': 'Origin'
  }

  if (origin && isCorsOriginAllowed(req)) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  return headers
}
