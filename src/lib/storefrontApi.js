import { supabase, isSupabaseConfigured } from './supabase'
import { demoProduct, whatsappNumber } from './utils'

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

function retailDemoProduct() {
  return normalizeRetailProduct({
    ...demoProduct,
    retail_price: 145000,
    public_description: demoProduct.long_description,
    available_stock_quantity: 3,
    track_inventory: true,
    stock_label: '3 disponibles',
    gallery_images: []
  })
}

export function getStoredCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredCart(items) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
}

export async function getRetailProducts() {
  if (!isSupabaseConfigured) return [retailDemoProduct()]
  const { data, error } = await supabase.rpc('get_retail_catalog')
  if (error) throw error
  return (data || []).map(normalizeRetailProduct)
}

export async function getFeaturedRetailProducts() {
  const products = await getRetailProducts()
  return products.filter((product) => product.is_featured).slice(0, 6)
}

export async function getRetailProductBySlug(slug) {
  if (!isSupabaseConfigured) return slug === demoProduct.slug ? retailDemoProduct() : null
  const { data, error } = await supabase.rpc('get_retail_product', { p_slug: slug })
  if (error) throw error
  const product = Array.isArray(data) ? data[0] : data
  return product ? normalizeRetailProduct(product) : null
}

export async function validateRetailCart(items) {
  const cleanItems = items.map((item) => ({
    product_id: item.id,
    quantity: Number(item.quantity || 0)
  }))
  if (!isSupabaseConfigured) {
    return items.map((item) => ({
      ...item,
      requested_quantity: item.quantity,
      is_available: !item.track_inventory || Number(item.available_stock_quantity || 0) >= Number(item.quantity || 0),
      issue: null
    }))
  }
  const { data, error } = await supabase.rpc('validate_retail_cart', { p_items: cleanItems })
  if (error) throw error
  return (data || []).map(normalizeRetailProduct)
}

function extractPhone(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.includes('wa.me/') || raw.includes('whatsapp')) return raw.replace(/\D/g, '')
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
