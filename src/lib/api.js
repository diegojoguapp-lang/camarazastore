import { supabase, isSupabaseConfigured } from './supabase'
import { demoProduct, isLikelyImageUrl, slugify } from './utils'

const BUCKET = 'product-images'
const PRODUCT_LIST_FIELDS = 'id,name,slug,category,internal_status,public_stock_status,wholesale_price,suggested_price,main_image_url,created_at'
const defaultHelpVideos = []

const defaultSocialLinks = {
  instagram: '',
  whatsapp: '',
  tiktok: '',
  facebook: ''
}

export async function getProducts({ includeHidden = false } = {}) {
  if (!isSupabaseConfigured) return [demoProduct]
  let query = supabase
    .from('products')
    .select(includeHidden ? '*' : PRODUCT_LIST_FIELDS)
    .order('created_at', { ascending: false })
  if (!includeHidden) query = query.eq('internal_status', 'active')
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getProductBySlug(slug) {
  if (!isSupabaseConfigured) return slug === demoProduct.slug ? { product: demoProduct, images: [] } : null
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error) throw error
  const { data: images, error: imageError } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', product.id)
    .order('sort_order', { ascending: true })
  if (imageError) throw imageError
  return { product, images: images || [] }
}

export async function getProductById(id) {
  if (!isSupabaseConfigured) return { product: demoProduct, images: [] }
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  const { data: images, error: imageError } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', id)
    .order('sort_order', { ascending: true })
  if (imageError) throw imageError
  return { product, images: images || [] }
}

export async function uploadImage(file, folder = 'products') {
  if (!file || !isSupabaseConfigured) return null
  const ext = file.name.split('.').pop()
  const filePath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(filePath, file, {
    cacheControl: '3600',
    upsert: false
  })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
  if (!data?.publicUrl) throw new Error('No se pudo generar la URL p√∫blica de la imagen.')
  return data.publicUrl
}

export async function createProduct(payload, imageFiles = []) {
  if (!isSupabaseConfigured) throw new Error('Supabase no est√° configurado.')
  const mainImage = imageFiles.main ? await uploadImage(imageFiles.main, 'main') : payload.main_image_url
  const productPayload = {
    ...payload,
    main_image_url: isLikelyImageUrl(mainImage) ? mainImage : null,
    slug: payload.slug || slugify(payload.name),
    updated_at: new Date().toISOString()
  }
  const { data, error } = await supabase.from('products').insert(productPayload).select().single()
  if (error) throw error
  if (imageFiles.gallery?.length) {
    const rows = []
    for (let index = 0; index < imageFiles.gallery.length; index += 1) {
      const url = await uploadImage(imageFiles.gallery[index], 'gallery')
      rows.push({ product_id: data.id, image_url: url, sort_order: index })
    }
    const { error: imageError } = await supabase.from('product_images').insert(rows)
    if (imageError) throw imageError
  }
  return data
}

export async function updateProduct(id, payload, imageFiles = [], imagesToDelete = []) {
  if (!isSupabaseConfigured) throw new Error('Supabase no est√° configurado.')
  const mainImage = imageFiles.main ? await uploadImage(imageFiles.main, 'main') : payload.main_image_url
  const productPayload = {
    ...payload,
    main_image_url: isLikelyImageUrl(mainImage) ? mainImage : null,
    slug: payload.slug || slugify(payload.name),
    updated_at: new Date().toISOString()
  }
  const { data, error } = await supabase.from('products').update(productPayload).eq('id', id).select().single()
  if (error) throw error
  if (imagesToDelete.length) {
    const { error: deleteError } = await supabase.from('product_images').delete().in('id', imagesToDelete)
    if (deleteError) throw deleteError
  }
  if (imageFiles.gallery?.length) {
    const rows = []
    for (let index = 0; index < imageFiles.gallery.length; index += 1) {
      const url = await uploadImage(imageFiles.gallery[index], 'gallery')
      rows.push({ product_id: id, image_url: url, sort_order: Date.now() + index })
    }
    const { error: imageError } = await supabase.from('product_images').insert(rows)
    if (imageError) throw imageError
  }
  return data
}

export async function updateProductStatus(id, status) {
  if (!isSupabaseConfigured) throw new Error('Supabase no est√° configurado.')
  const payload = {
    internal_status: status === 'sold_out' ? 'active' : status,
    public_stock_status: status === 'sold_out' ? 'agotado' : undefined,
    updated_at: new Date().toISOString()
  }
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key])
  const { error } = await supabase.from('products').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteProduct(id) {
  if (!isSupabaseConfigured) throw new Error('Supabase no est√° configurado.')
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function getHelpVideos({ includeHidden = false } = {}) {
  if (!isSupabaseConfigured) return defaultHelpVideos
  const { data, error } = await supabase
    .from('help_videos')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('No se pudieron cargar videos administrables:', error.message)
    return defaultHelpVideos
  }
  return (data || []).filter((video) => includeHidden || video.is_visible !== false)
}

export async function saveHelpVideo(payload) {
  if (!isSupabaseConfigured) throw new Error('Supabase no est· configurado.')
  const clean = {
    title: payload.title?.trim(),
    video_url: payload.video_url?.trim(),
    duration: payload.duration?.trim() || null,
    thumbnail_url: payload.thumbnail_url?.trim() || null,
    is_visible: payload.is_visible !== false,
    sort_order: Number(payload.sort_order || 0),
    updated_at: new Date().toISOString()
  }
  if (!clean.title || !clean.video_url) throw new Error('TÌtulo y URL son obligatorios.')
  const query = payload.id
    ? supabase.from('help_videos').update(clean).eq('id', payload.id)
    : supabase.from('help_videos').insert(clean)
  const { error } = await query
  if (error) throw error
}

export async function deleteHelpVideo(id) {
  if (!isSupabaseConfigured) throw new Error('Supabase no est· configurado.')
  const { error } = await supabase.from('help_videos').delete().eq('id', id)
  if (error) throw error
}

export async function getSocialLinks() {
  if (!isSupabaseConfigured) return defaultSocialLinks
  const { data, error } = await supabase.from('social_links').select('network,url')
  if (error) {
    console.warn('No se pudieron cargar redes administrables:', error.message)
    return defaultSocialLinks
  }
  return (data || []).reduce((acc, row) => ({ ...acc, [row.network]: row.url || '' }), defaultSocialLinks)
}

export async function saveSocialLinks(links) {
  if (!isSupabaseConfigured) throw new Error('Supabase no est· configurado.')
  const rows = Object.entries(links).map(([network, url]) => ({
    network,
    url: url?.trim() || '',
    updated_at: new Date().toISOString()
  }))
  const { error } = await supabase.from('social_links').upsert(rows, { onConflict: 'network' })
  if (error) throw error
}
