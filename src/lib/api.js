import { supabase, isSupabaseConfigured } from './supabase'
import { demoProduct, slugify } from './utils'

const BUCKET = 'product-images'

export async function getProducts({ includeHidden = false } = {}) {
  if (!isSupabaseConfigured) return [demoProduct]
  let query = supabase.from('products').select('*').order('created_at', { ascending: false })
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
  if (!data?.publicUrl) throw new Error('No se pudo generar la URL pública de la imagen.')
  return data.publicUrl
}

export async function createProduct(payload, imageFiles = []) {
  if (!isSupabaseConfigured) throw new Error('Supabase no está configurado.')
  const mainImage = imageFiles.main ? await uploadImage(imageFiles.main, 'main') : payload.main_image_url
  const productPayload = {
    ...payload,
    main_image_url: mainImage || payload.main_image_url || null,
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
  if (!isSupabaseConfigured) throw new Error('Supabase no está configurado.')
  const mainImage = imageFiles.main ? await uploadImage(imageFiles.main, 'main') : payload.main_image_url
  const productPayload = {
    ...payload,
    main_image_url: mainImage || payload.main_image_url || null,
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
  if (!isSupabaseConfigured) throw new Error('Supabase no está configurado.')
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
  if (!isSupabaseConfigured) throw new Error('Supabase no está configurado.')
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}
