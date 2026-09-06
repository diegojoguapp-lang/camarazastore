import { supabase, isSupabaseConfigured } from './supabase'
import { whatsappNumber } from './utils'

const CART_STORAGE_KEY = 'camaraza_store_cart_v1'

function normalizeRetailProduct(product) {
  return {
    ...product,
    retail_price: Number(product?.retail_price || 0),
    available_stock_quantity: Number(product?.available_stock_quantity || 0),
    track_inventory: product?.track_inventory !== false,
    gallery_images: Array.isArray(product?.gallery_images) ? product.gallery_images : []
  }
}

export function getStoredCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    const seen = new Set()
    return parsed.filter((item) => {
      if (!item || typeof item.id !== 'string' || seen.has(item.id) || !Number.isSafeInteger(item.quantity) || item.quantity < 1) return false
      seen.add(item.id)
      return true
    }).map(normalizeRetailProduct)
  } catch {
    return []
  }
}

export function saveStoredCart(items) {
  try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)) } catch { /* El carrito sigue disponible en esta sesion. */ }
}

export async function getRetailProducts() {
  if (!isSupabaseConfigured) throw new Error('La tienda no esta disponible en este momento.')
  const { data, error } = await supabase.rpc('get_retail_catalog')
  if (error) throw error
  return (data || []).map(normalizeRetailProduct)
}

export async function getFeaturedRetailProducts() {
  const products = await getRetailProducts()
  return products.filter((product) => product.is_featured).slice(0, 6)
}

export async function getRetailProductBySlug(slug) {
  if (!isSupabaseConfigured) throw new Error('La tienda no esta disponible en este momento.')
  const { data, error } = await supabase.rpc('get_retail_product', { p_slug: slug })
  if (error) throw error
  const product = Array.isArray(data) ? data[0] : data
  return product ? normalizeRetailProduct(product) : null
}

export async function validateRetailCart(items) {
  if (!items.length || items.length > 100 || items.some((item) => !Number.isSafeInteger(item.quantity) || item.quantity < 1)) throw new Error('Revisa las cantidades del carrito.')
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error('Hay productos repetidos en el carrito.')
  const cleanItems = items.map((item) => ({
    product_id: item.id,
    quantity: Number(item.quantity || 0)
  }))
  if (!isSupabaseConfigured) throw new Error('No se pudo verificar el stock. Intenta nuevamente.')
  const { data, error } = await supabase.rpc('validate_retail_cart', { p_items: cleanItems })
  if (error) throw error
  const rows = (data || []).map(normalizeRetailProduct)
  return items.map((item) => rows.find((row) => row.id === item.id) || {
    id: item.id, name: item.name, is_available: false, issue: 'Producto no disponible',
    available_stock_quantity: 0, track_inventory: true, retail_price: 0
  })
}

function extractPhone(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      if (url.hostname === 'wa.me' || url.hostname === 'www.wa.me') return url.pathname.replace(/\D/g, '')
      if (url.hostname === 'api.whatsapp.com' || url.hostname === 'web.whatsapp.com') return (url.searchParams.get('phone') || '').replace(/\D/g, '')
      return ''
    } catch { return '' }
  }
  return raw.replace(/\D/g, '')
}

export async function getStorefrontWhatsapp() {
  if (!isSupabaseConfigured) return extractPhone(whatsappNumber)
  const { data, error } = await supabase
    .from('social_links')
    .select('url')
    .eq('network', 'whatsapp')
    .maybeSingle()
  if (error) return extractPhone(whatsappNumber)
  return extractPhone(data?.url || whatsappNumber)
}
