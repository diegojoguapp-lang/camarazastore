import { supabase, BUCKET } from './supabase'
import { slugify } from './utils'

// ---------- Catálogo público ----------

export async function getCatalogo({ search = '', category = '', status = '' } = {}) {
  let query = supabase
    .from('products')
    .select('*')
    .eq('internal_status', 'active')
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)
  if (status) query = query.eq('public_stock_status', status)
  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getProductoBySlug(slug) {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('slug', slug)
    .single()
  if (error) throw error
  return data
}

// ---------- Admin ----------

export async function getAllProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getProductById(id) {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createProduct(payload) {
  if (!payload.slug) payload.slug = slugify(payload.name)
  const { data, error } = await supabase
    .from('products')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProduct(id, payload) {
  payload.updated_at = new Date().toISOString()
  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

// ---------- Imágenes ----------

export async function uploadImage(file) {
  const ext = file.name.split('.').pop()
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function addProductImage(product_id, image_url, sort_order = 0) {
  const { data, error } = await supabase
    .from('product_images')
    .insert({ product_id, image_url, sort_order })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteProductImage(id) {
  const { error } = await supabase.from('product_images').delete().eq('id', id)
  if (error) throw error
}
