export const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || '595XXXXXXXXX'

export function formatGs(value) {
  const number = Number(value || 0)
  return `${new Intl.NumberFormat('es-PY').format(number)} Gs.`
}

export function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function calculateProfit(product) {
  return Number(product?.suggested_price || 0) - Number(product?.wholesale_price || 0)
}

export function publicStatusLabel(status) {
  const labels = {
    disponible: '🟢 Hay stock',
    consultar_stock: '🟢 Hay stock',
    ultimas_unidades: '🟢 Hay stock',
    agotado: 'Sin stock'
  }
  return labels[status] || '🟢 Hay stock'
}

export function internalStatusLabel(status) {
  const labels = {
    active: 'Activo',
    hidden: 'Oculto',
    sold_out: 'Agotado'
  }
  return labels[status] || status
}

export function isSoldOut(product) {
  return product?.public_stock_status === 'agotado' || product?.internal_status === 'sold_out'
}

export function isBestSeller(product) {
  return Boolean(
    product?.is_best_seller ||
    product?.best_seller ||
    product?.mas_vendido ||
    product?.featured ||
    product?.is_featured
  )
}

export function buildWhatsappUrl(product) {
  const message = product?.custom_whatsapp_message?.trim() || `Hola, tengo un cliente interesado.\n\nProducto: ${product?.name || ''}\nPrecio sugerido: ${formatGs(product?.suggested_price)}\nPrecio mayorista: ${formatGs(product?.wholesale_price)}\n\nQuiero consultar stock.`
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
}

export function imageFallback(event) {
  event.currentTarget.onerror = null
  event.currentTarget.src = '/placeholder.svg'
}

export function isGoogleDriveUrl(url) {
  return /(^https?:\/\/)?(drive|docs)\.google\.com/i.test(String(url || ''))
}

export function isLikelyImageUrl(url) {
  if (!url) return false
  if (String(url).startsWith('/')) return true
  if (isGoogleDriveUrl(url)) return false
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

export function getDisplayImageUrl(url, { width = 640, height = 640 } = {}) {
  if (!isLikelyImageUrl(url)) return '/placeholder.svg'
  if (String(url).startsWith('/')) return url

  try {
    const parsed = new URL(url)
    const publicMarker = '/storage/v1/object/public/'
    if (parsed.pathname.includes(publicMarker)) {
      parsed.pathname = parsed.pathname.replace(publicMarker, '/storage/v1/render/image/public/')
      parsed.searchParams.set('width', String(width))
      parsed.searchParams.set('height', String(height))
      parsed.searchParams.set('resize', 'cover')
      parsed.searchParams.set('quality', '72')
      return parsed.toString()
    }
  } catch {
    return '/placeholder.svg'
  }

  return url
}

export async function copyToClipboard(text) {
  if (!text) return false
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
  return true
}

export const demoProduct = {
  id: 'demo-ecopower',
  name: 'Máquina profesional para cortar pelo Ecopower EP-2811',
  slug: 'maquina-profesional-ecopower-ep2811',
  brand: 'Ecopower',
  model: 'EP-2811',
  category: 'Barbería',
  internal_status: 'active',
  public_stock_status: 'consultar_stock',
  is_best_seller: true,
  cost_price: 50000,
  wholesale_price: 85000,
  suggested_price: 145000,
  stock_quantity: null,
  delivery_time: 'Dentro de las 24 horas según disponibilidad',
  delivery_included: false,
  delivery_note: 'El delivery no está incluido en el precio mayorista.',
  warranty: '48 horas por falla de fábrica',
  return_policy: 'La comisión se confirma cuando el producto fue entregado correctamente y no hay reclamo pendiente.',
  short_description: 'Máquina profesional para cortar pelo, ideal para uso personal o barbería.',
  long_description: 'Producto nuevo en caja. Cuenta con carga USB, batería de litio, motor potente de 11.000 RPM y cuchilla ajustable Zero Gap. Ideal para cortes, retoques, barba y uso diario.',
  whatsapp_status_text: 'Disponible máquina profesional para cortar pelo. Ideal para barbería o uso personal. Precio: 145.000 Gs. Consultar disponibilidad.',
  marketplace_text: 'Máquina profesional para cortar pelo Ecopower EP-2811. Producto nuevo en caja, carga USB, batería de litio, motor potente y cuchilla ajustable. Ideal para barbería o uso personal. Entrega disponible. Consultar stock.',
  reseller_group_text: 'PRODUCTO DISPONIBLE PARA REVENTA\n\nProducto: Máquina profesional para cortar pelo Ecopower EP-2811\nPrecio mayorista: 85.000 Gs.\nPrecio sugerido: 145.000 Gs.\nPosible ganancia: 60.000 Gs.\nDelivery no incluido. Consultar stock antes de vender.',
  drive_link: 'https://drive.google.com/',
  video_url: '',
  main_image_url: '/demo-ecopower.png',
  created_at: new Date().toISOString()
}
