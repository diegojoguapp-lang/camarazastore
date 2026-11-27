import { supabase } from './supabase'

const BUCKET = 'product-images'
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`
const RENDER_MARKER = `/storage/v1/render/image/public/${BUCKET}/`
const PAGE_SIZE = 500

export const MAIN_IMAGE_CLEANUP_WARNING = {
  code: 'PRODUCT_MAIN_IMAGE_CLEANUP_FAILED',
  message: 'El producto ya se guardó, pero no se pudo confirmar la eliminación de la imagen principal anterior. Revisá el producto antes de volver a guardar.'
}

function configuredOrigin() {
  return new URL(supabase.storage.from(BUCKET).getPublicUrl('').data.publicUrl).origin
}

function imagePath(url, origin, allowRender = false) {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    if (!allowRender && parsed.origin !== origin) return ''
    const rawPath = String(url).match(/^[a-z][a-z\d+.-]*:\/\/[^/?#]*([^?#]*)/i)?.[1]
    if (rawPath === undefined) return ''
    const decodedRawPath = decodeURIComponent(rawPath).replaceAll('\\', '/')
    if (!allowRender && decodedRawPath.split('/').some((segment) => segment === '.' || segment === '..')) return ''
    const pathname = decodeURIComponent(parsed.pathname)
    const marker = pathname.startsWith(PUBLIC_MARKER) ? PUBLIC_MARKER : allowRender && pathname.startsWith(RENDER_MARKER) ? RENDER_MARKER : ''
    if (!marker) return ''
    const path = pathname.slice(marker.length)
    if (!path.startsWith('main/') || path.split('/').some((segment) => segment === '.' || segment === '..' || segment === '')) return ''
    return path
  } catch { return '' }
}

async function hasImageReference(table, column, path, origin) {
  let offset = 0
  for (;;) {
    const { data, count, error } = await supabase.from(table)
      .select(`id,${column}`, { count: 'exact' })
      .not(column, 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    if (!Array.isArray(data) || !Number.isSafeInteger(count) || count < offset + data.length) {
      throw new Error('No se pudieron comprobar las referencias de imágenes.')
    }
    if (data.some((row) => imagePath(row[column], origin, true) === path)) return true
    offset += data.length
    if (offset === count) return false
    if (!data.length) throw new Error('No se pudieron completar las referencias de imágenes.')
  }
}

export async function removeUnusedMainImage(previousUrl, currentUrl) {
  if (!previousUrl || previousUrl === currentUrl) return
  const origin = configuredOrigin()
  const path = imagePath(previousUrl, origin)
  if (!path) return
  if (supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl !== previousUrl) return
  if (imagePath(currentUrl, origin, true) === path) return
  if (await hasImageReference('products', 'main_image_url', path, origin)) return
  if (await hasImageReference('product_images', 'image_url', path, origin)) return
  const { data, error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
  if (!Array.isArray(data) || !data.some((object) => object.name === path)) {
    throw new Error('No se pudo confirmar la eliminación del archivo anterior.')
  }
}
