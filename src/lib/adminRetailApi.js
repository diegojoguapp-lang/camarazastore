import { supabase, isSupabaseConfigured } from './supabase'
import { slugify } from './utils'

const ASSET_BUCKET = 'retail-assets'
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

function readableError(error, fallback = 'No se pudo completar la operacion.') {
  const message = error?.message || ''
  if (/retail_categories_slug_unique_idx|duplicate key/i.test(message)) return new Error('Ya existe una categoria con ese slug.')
  if (/foreign key|still referenced/i.test(message)) return new Error('No se puede eliminar una categoria que tiene subcategorias.')
  if (/row-level security|permission denied|only active admins/i.test(message)) return new Error('Tu sesion no tiene permisos de administrador para esta accion.')
  return new Error(message || fallback)
}

async function validateImage(file) {
  if (!file) throw new Error('Selecciona una imagen.')
  if (!IMAGE_TYPES.has(file.type)) throw new Error('Usa una imagen JPG, PNG o WEBP.')
  if (file.size > MAX_IMAGE_SIZE) throw new Error('La imagen no puede superar 5 MB.')
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  const isWebp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  const valid = file.type === 'image/jpeg' ? isJpeg : file.type === 'image/png' ? isPng : isWebp
  if (!valid) throw new Error('El contenido del archivo no coincide con un JPG, PNG o WEBP valido.')
}

function extensionFor(file) {
  return file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
}

function ownedAssetPath(url, folder) {
  if (!url) return ''
  try {
    const marker = `/storage/v1/object/public/${ASSET_BUCKET}/`
    const parsed = new URL(url)
    const index = parsed.pathname.indexOf(marker)
    if (index < 0) return ''
    const path = decodeURIComponent(parsed.pathname.slice(index + marker.length))
    return path.startsWith(`${folder}/`) ? path : ''
  } catch { return '' }
}

export async function uploadRetailAsset(file, folder, previousUrl = '') {
  requireSupabase()
  await validateImage(file)
  if (!['categories', 'banners'].includes(folder)) throw new Error('Destino de imagen invalido.')
  const path = `${folder}/${crypto.randomUUID()}.${extensionFor(file)}`
  const { error } = await supabase.storage.from(ASSET_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw readableError(error, 'No se pudo subir la imagen.')
  const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) {
    await supabase.storage.from(ASSET_BUCKET).remove([path])
    throw new Error('No se pudo obtener la URL publica de la imagen.')
  }
  return data.publicUrl
}

export async function removeRetailAsset(url, folder) {
  requireSupabase()
  const path = ownedAssetPath(url, folder)
  if (!path) return false
  const { error } = await supabase.storage.from(ASSET_BUCKET).remove([path])
  if (error) throw readableError(error, 'No se pudo quitar la imagen.')
  return true
}

export async function getAdminRetailCategories() {
  requireSupabase()
  const { data, error } = await supabase.rpc('admin_get_retail_categories')
  if (error) throw readableError(error, 'No se pudieron cargar las categorias.')
  return Array.isArray(data) ? data : []
}

export async function saveRetailCategory(payload) {
  requireSupabase()
  const name = payload.name?.trim()
  const clean = {
    name,
    slug: slugify(payload.slug || name),
    parent_id: payload.parent_id || null,
    image_url: payload.image_url?.trim() || null,
    is_active: payload.is_active !== false,
    show_on_home: Boolean(payload.show_on_home),
    home_sort_order: Number(payload.home_sort_order || 0),
    updated_at: new Date().toISOString()
  }
  if (!name) throw new Error('El nombre es obligatorio.')
  if (!clean.slug) throw new Error('El slug es obligatorio.')
  if (!Number.isInteger(clean.home_sort_order)) throw new Error('El orden en Home debe ser un numero entero.')
  const query = payload.id ? supabase.from('retail_categories').update(clean).eq('id', payload.id) : supabase.from('retail_categories').insert(clean)
  const { data, error } = await query.select('*').single()
  if (error) throw readableError(error, 'No se pudo guardar la categoria.')
  return data
}

export async function deleteRetailCategory(id) {
  requireSupabase()
  const { data: children, error: childError } = await supabase.from('retail_categories').select('id').eq('parent_id', id).limit(1)
  if (childError) throw childError
  if (children?.length) throw new Error('Esta categoria tiene subcategorias. Reasignalas o eliminalas antes de continuar.')
  const { error } = await supabase.from('retail_categories').delete().eq('id', id)
  if (error) throw readableError(error, 'No se pudo eliminar la categoria.')
}

export async function setRetailCategoryActive(id, isActive) {
  requireSupabase()
  const { data, error } = await supabase.from('retail_categories').update({ is_active: Boolean(isActive), updated_at: new Date().toISOString() }).eq('id', id).select('*').single()
  if (error) throw readableError(error)
  return data
}

export async function getCategoryProducts(categoryId) {
  requireSupabase()
  const { data, error } = await supabase.rpc('admin_get_retail_category_products', { p_category_id: categoryId })
  if (error) throw readableError(error, 'No se pudieron cargar los productos de la categoria.')
  return Array.isArray(data) ? data : []
}

export async function searchProductsForCategory(categoryId, { search = '', limit = 50, offset = 0 } = {}) {
  requireSupabase()
  const { data, error } = await supabase.rpc('admin_search_retail_products', { p_category_id: categoryId, p_search: search.trim() || null, p_limit: Math.min(Math.max(limit, 1), 100), p_offset: Math.max(offset, 0) })
  if (error) throw readableError(error, 'No se pudieron buscar los productos.')
  return { rows: Array.isArray(data?.rows) ? data.rows : [], total: Number(data?.total || 0), assignedTotal: Number(data?.assigned_total || 0) }
}

async function runProductBatch(name, categoryId, productIds, fallback) {
  requireSupabase()
  const unique = [...new Set(productIds)].filter(Boolean)
  if (!unique.length) return 0
  const { data, error } = await supabase.rpc(name, { p_category_id: categoryId, p_product_ids: unique })
  if (error) throw readableError(error, fallback)
  return Number(data || 0)
}

export const bulkAddCategoryProducts = (categoryId, ids) => runProductBatch('admin_add_retail_category_products', categoryId, ids, 'No se pudieron agregar los productos.')
export const bulkRemoveCategoryProducts = (categoryId, ids) => runProductBatch('admin_remove_retail_category_products', categoryId, ids, 'No se pudieron quitar los productos.')

export async function updateCategoryProductOrder(categoryId, rows) {
  requireSupabase()
  const items = rows.map((row, index) => ({ product_id: row.product_id || row.id, sort_order: Number.isFinite(Number(row.sort_order)) ? Math.max(0, Math.trunc(Number(row.sort_order))) : index }))
  const { data, error } = await supabase.rpc('admin_update_retail_category_product_order', { p_category_id: categoryId, p_items: items })
  if (error) throw readableError(error, 'No se pudo guardar el orden.')
  return Number(data || 0)
}

export async function getRetailProductCategoryIds(productId, legacyCategoryId = null) {
  requireSupabase()
  const { data, error } = await supabase.from('retail_product_categories').select('category_id').eq('product_id', productId)
  if (error) throw readableError(error, 'No se pudieron cargar las categorias del producto.')
  const ids = (data || []).map((row) => row.category_id)
  return ids.length ? ids : legacyCategoryId ? [legacyCategoryId] : []
}

export async function saveRetailProductCategories(productId, categoryIds) {
  requireSupabase()
  const unique = [...new Set(categoryIds)].filter(Boolean)
  const { error } = await supabase.rpc('admin_set_retail_product_categories', { p_product_id: productId, p_category_ids: unique })
  if (error) throw readableError(error, 'No se pudieron guardar las categorias retail.')
}

function validateTargetUrl(value) {
  const target = String(value || '').trim()
  if (!target) return null
  if (target.startsWith('/') && !target.startsWith('//')) return target
  try {
    const parsed = new URL(target)
    if (['http:', 'https:'].includes(parsed.protocol)) return parsed.toString()
  } catch { /* handled below */ }
  throw new Error('El destino debe ser una ruta interna o una URL http/https valida.')
}

export async function getRetailBanners() {
  requireSupabase()
  const { data, error } = await supabase.from('retail_banners').select('*').order('sort_order').order('created_at')
  if (error) throw readableError(error, 'No se pudieron cargar los banners.')
  return data || []
}

export async function saveRetailBanner(payload) {
  requireSupabase()
  const clean = {
    title: payload.title?.trim(), subtitle: payload.subtitle?.trim() || null, button_text: payload.button_text?.trim() || null,
    target_url: validateTargetUrl(payload.target_url), mobile_image_url: payload.mobile_image_url?.trim(), desktop_image_url: payload.desktop_image_url?.trim() || null,
    is_active: payload.is_active !== false, sort_order: Number(payload.sort_order || 0), updated_at: new Date().toISOString()
  }
  if (!clean.title) throw new Error('El titulo es obligatorio.')
  if (!clean.mobile_image_url) throw new Error('La imagen mobile es obligatoria.')
  if (!Number.isInteger(clean.sort_order)) throw new Error('El orden debe ser un numero entero.')
  const query = payload.id ? supabase.from('retail_banners').update(clean).eq('id', payload.id) : supabase.from('retail_banners').insert(clean)
  const { data, error } = await query.select('*').single()
  if (error) throw readableError(error, 'No se pudo guardar el banner.')
  return data
}

export async function setRetailBannerActive(id, isActive) {
  requireSupabase()
  const { error } = await supabase.from('retail_banners').update({ is_active: Boolean(isActive), updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw readableError(error, 'No se pudo cambiar el estado del banner.')
}

export async function deleteRetailBanner(id) {
  requireSupabase()
  const { error } = await supabase.from('retail_banners').delete().eq('id', id)
  if (error) throw readableError(error, 'No se pudo eliminar el banner.')
}
