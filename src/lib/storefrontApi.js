import { supabase, isSupabaseConfigured } from './supabase'
import { whatsappNumber } from './utils'

const CART_STORAGE_KEY = 'camaraza_store_cart_v1'
const CUSTOMER_STORAGE_KEY = 'camaraza_store_customer_v1'

function requireStore() {
  if (!isSupabaseConfigured) throw new Error('La tienda no esta disponible en este momento.')
}

function normalizeRetailProduct(product) {
  const categories = Array.isArray(product?.categories) ? product.categories : []
  const primaryCategory = categories[0]
  return {
    ...product,
    retail_price: Number(product?.retail_price || 0),
    retail_compare_at_price: product?.retail_compare_at_price == null ? null : Number(product.retail_compare_at_price),
    available_stock_quantity: Number(product?.available_stock_quantity || 0),
    track_inventory: product?.track_inventory !== false,
    gallery_images: Array.isArray(product?.gallery_images) ? product.gallery_images : [],
    categories,
    category_name: product?.category_name || primaryCategory?.name || null,
    category_slug: product?.category_slug || primaryCategory?.slug || null,
    parent_category_name: product?.parent_category_name || primaryCategory?.parent_name || null,
    parent_category_slug: product?.parent_category_slug || primaryCategory?.parent_slug || null
  }
}

function isMissingRpc(error) {
  return ['PGRST202', '42883'].includes(error?.code) || /function .* does not exist|schema cache/i.test(error?.message || '')
}

export function getStoredCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    const seen = new Set()
    return parsed.filter((item) => {
      if (!item || typeof item.id !== 'string' || seen.has(item.id)) return false
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) return false
      seen.add(item.id)
      return true
    }).map(normalizeRetailProduct)
  } catch {
    return []
  }
}

export function saveStoredCart(items) {
  try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)) } catch { /* Storage can be disabled. */ }
}

export function getStoredCustomer() {
  try {
    const value = JSON.parse(localStorage.getItem(CUSTOMER_STORAGE_KEY) || '{}')
    return { name: String(value.name || ''), city: String(value.city || '') }
  } catch {
    return { name: '', city: '' }
  }
}

export function saveStoredCustomer({ name, city }) {
  try { localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({ name: name.trim(), city: city.trim() })) } catch { /* Optional convenience only. */ }
}

export async function getRetailHome() {
  requireStore()
  const { data, error } = await supabase.rpc('get_retail_home_v3')
  if (!error) {
    return {
      banner: data?.banner || null,
      categories: Array.isArray(data?.categories) ? data.categories : [],
      featured: (data?.featured || []).map(normalizeRetailProduct),
      sections: (data?.sections || []).map((section) => ({ ...section, products: (section.products || []).map(normalizeRetailProduct) }))
    }
  }
  if (!isMissingRpc(error)) throw error
  const legacy = await supabase.rpc('get_retail_home_v2')
  if (!legacy.error) return { banner: null, categories: legacy.data?.categories || [], featured: (legacy.data?.featured || []).map(normalizeRetailProduct), sections: (legacy.data?.sections || []).map((section) => ({ ...section, products: (section.products || []).map(normalizeRetailProduct) })) }
  const products = await getRetailProducts()
  return { banner: null, categories: [], featured: products.filter((item) => item.is_featured).slice(0, 12), sections: [] }
}

export async function getRetailCategories() {
  requireStore()
  const { data, error } = await supabase.rpc('get_retail_categories_v3')
  if (error) {
    if (isMissingRpc(error)) {
      const legacy = await supabase.rpc('get_retail_categories_v2')
      if (!legacy.error) return Array.isArray(legacy.data) ? legacy.data : []
      return []
    }
    throw error
  }
  return Array.isArray(data) ? data : []
}

export async function getRetailProducts(filters = {}) {
  requireStore()
  const params = {
    p_category_slug: filters.categorySlug || null,
    p_search: filters.search?.trim().slice(0, 80) || null,
    p_min_price: filters.minPrice === '' || filters.minPrice == null ? null : Number(filters.minPrice),
    p_max_price: filters.maxPrice === '' || filters.maxPrice == null ? null : Number(filters.maxPrice),
    p_available_only: Boolean(filters.availableOnly),
    p_order: filters.order || 'relevant'
  }
  const { data, error } = await supabase.rpc('get_retail_catalog_v3', params)
  if (!error) return (Array.isArray(data) ? data : []).map(normalizeRetailProduct)
  if (!isMissingRpc(error)) throw error
  const v2 = await supabase.rpc('get_retail_catalog_v2', params)
  if (!v2.error) return (v2.data || []).map(normalizeRetailProduct)
  const legacy = await supabase.rpc('get_retail_catalog')
  if (legacy.error) throw legacy.error
  const term = params.p_search?.toLowerCase()
  return (legacy.data || []).map(normalizeRetailProduct).filter((item) => !term || [item.name, item.brand, item.model, item.category].join(' ').toLowerCase().includes(term))
}

export async function getRetailProductBySlug(slug) {
  requireStore()
  const { data, error } = await supabase.rpc('get_retail_product_v3', { p_slug: slug })
  if (!error) return data?.product ? { product: normalizeRetailProduct(data.product), related: (data.related || []).map(normalizeRetailProduct) } : null
  if (!isMissingRpc(error)) throw error
  const v2 = await supabase.rpc('get_retail_product_v2', { p_slug: slug })
  if (!v2.error) return v2.data?.product ? { product: normalizeRetailProduct(v2.data.product), related: (v2.data.related || []).map(normalizeRetailProduct) } : null
  const legacy = await supabase.rpc('get_retail_product', { p_slug: slug })
  if (legacy.error) throw legacy.error
  const product = Array.isArray(legacy.data) ? legacy.data[0] : legacy.data
  return product ? { product: normalizeRetailProduct(product), related: [] } : null
}

export async function validateRetailCart(items) {
  if (!items.length || items.length > 100 || items.some((item) => !Number.isSafeInteger(item.quantity) || item.quantity < 1)) throw new Error('Revisa las cantidades del carrito.')
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error('Hay productos repetidos en el carrito.')
  requireStore()
  const requested = items.map((item) => ({ product_id: item.id, quantity: item.quantity }))
  const { data, error } = await supabase.rpc('validate_retail_cart', { p_items: requested })
  if (error) throw error
  const rows = (data || []).map(normalizeRetailProduct)
  return items.map((item) => rows.find((row) => row.id === item.id) || {
    ...item, is_available: false, issue: 'Este producto ya no esta disponible.',
    available_stock_quantity: 0, track_inventory: true, retail_price: 0
  })
}

function extractPhone(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      if (['wa.me', 'www.wa.me'].includes(url.hostname)) return url.pathname.replace(/\D/g, '')
      if (['api.whatsapp.com', 'web.whatsapp.com'].includes(url.hostname)) return (url.searchParams.get('phone') || '').replace(/\D/g, '')
      return ''
    } catch { return '' }
  }
  return raw.replace(/\D/g, '')
}

export async function getStorefrontWhatsapp() {
  if (!isSupabaseConfigured) return extractPhone(whatsappNumber)
  const { data, error } = await supabase.from('social_links').select('url').eq('network', 'whatsapp').maybeSingle()
  return extractPhone(error ? whatsappNumber : data?.url || whatsappNumber)
}
