import { supabase, isSupabaseConfigured } from './supabase'
import { getCurrentSession } from './roles'

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

function readableError(error, fallback) {
  const message = error?.message || ''
  if (message.includes('product_admin_details_sku_unique_idx')) return new Error('Ya existe un producto con ese SKU.')
  if (message.includes('Inventory tracking is disabled')) return new Error('El control de inventario esta desactivado para este producto.')
  if (message.includes('negative stock')) return new Error('El movimiento dejaria stock negativo.')
  if (message.includes('Movement reason is required')) return new Error('El motivo es obligatorio.')
  if (message.includes('Producto no encontrado')) return new Error('Producto no encontrado.')
  if (message.includes('Retail price cannot be negative')) return new Error('El precio minorista no puede ser negativo.')
  if (message.includes('Low stock threshold cannot be negative')) return new Error('El stock minimo no puede ser negativo.')
  return new Error(message || fallback)
}

function normalizeSku(value) {
  return String(value || '').trim().replace(/\s+/g, ' ') || null
}

function normalizeMoney(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error('El importe debe ser numerico.')
  if (number < 0) throw new Error('El importe no puede ser negativo.')
  return number
}

function normalizeNonNegativeInteger(value, label) {
  const number = Number(value)
  if (value === '' || value === null || value === undefined) throw new Error(`${label} es obligatorio.`)
  if (!Number.isFinite(number) || !Number.isInteger(number)) throw new Error(`${label} debe ser un numero entero.`)
  if (number < 0) throw new Error(`${label} no puede ser negativo.`)
  return number
}

function normalizePositiveInteger(value, label) {
  const number = normalizeNonNegativeInteger(value, label)
  if (number <= 0) throw new Error(`${label} debe ser mayor que cero.`)
  return number
}

async function currentUserId() {
  const session = await getCurrentSession()
  return session?.user?.id || null
}

export function inventoryStatus(product) {
  const details = product.admin_details || {}
  const stock = Number(product.stock_quantity || 0)
  const threshold = Number(details.low_stock_threshold || 0)
  if (details.track_inventory === false) return 'untracked'
  if (stock <= 0) return 'out'
  if (stock <= threshold) return 'low'
  return 'available'
}

export function inventoryStatusLabel(status) {
  return {
    available: 'Disponible',
    low: 'Stock bajo',
    out: 'Agotado',
    untracked: 'Sin control'
  }[status] || 'Disponible'
}

export function movementTypeLabel(type) {
  return {
    opening_balance: 'Saldo inicial',
    manual_entry: 'Entrada manual',
    manual_exit: 'Salida manual',
    adjustment_in: 'Ajuste positivo',
    adjustment_out: 'Ajuste negativo',
    damaged: 'Producto averiado',
    lost: 'Producto perdido'
  }[type] || type || '-'
}

export async function getInventoryProducts() {
  requireSupabase()
  const [productsResult, detailsResult, suppliersResult] = await Promise.all([
    supabase
      .from('products')
      .select('id,name,slug,brand,model,cost_price,wholesale_price,suggested_price,stock_quantity,internal_status,public_stock_status,main_image_url,created_at')
      .order('name', { ascending: true }),
    supabase
      .from('product_admin_details')
      .select('product_id,sku,retail_price,reseller_commission_amount,supplier_id,track_inventory,low_stock_threshold,updated_at'),
    supabase
      .from('suppliers')
      .select('id,name,is_active')
      .order('name', { ascending: true })
  ])

  if (productsResult.error) throw productsResult.error
  if (detailsResult.error) throw detailsResult.error
  if (suppliersResult.error) throw suppliersResult.error

  const detailMap = new Map((detailsResult.data || []).map((item) => [item.product_id, item]))
  const supplierMap = new Map((suppliersResult.data || []).map((item) => [item.id, item]))

  return (productsResult.data || []).map((product) => {
    const details = detailMap.get(product.id) || {
      product_id: product.id,
      sku: '',
      retail_price: null,
      reseller_commission_amount: 0,
      supplier_id: null,
      track_inventory: true,
      low_stock_threshold: 2
    }
    return {
      ...product,
      stock_quantity: Number(product.stock_quantity || 0),
      admin_details: details,
      supplier: details.supplier_id ? supplierMap.get(details.supplier_id) : null
    }
  })
}

export async function getInventorySummary() {
  const products = await getInventoryProducts()
  return products.reduce((acc, product) => {
    const status = inventoryStatus(product)
    const stock = Number(product.stock_quantity || 0)
    if (product.admin_details?.track_inventory !== false) acc.controlled += 1
    acc.units += stock
    acc.value += stock * Number(product.cost_price || 0)
    if (status === 'low') acc.low += 1
    if (status === 'out') acc.out += 1
    return acc
  }, { controlled: 0, units: 0, low: 0, out: 0, value: 0 })
}

export async function getProductAdminDetails(productId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('product_admin_details')
    .select('*')
    .eq('product_id', productId)
    .maybeSingle()
  if (error) throw error
  return data || {
    product_id: productId,
    sku: '',
    retail_price: null,
    reseller_commission_amount: 0,
    supplier_id: null,
    track_inventory: true,
    low_stock_threshold: 2
  }
}

export async function saveProductAdminDetails(productId, payload) {
  requireSupabase()
  const lowStockThreshold = normalizeNonNegativeInteger(payload.low_stock_threshold, 'El stock minimo')
  const clean = {
    product_id: productId,
    sku: normalizeSku(payload.sku),
    retail_price: normalizeMoney(payload.retail_price),
    reseller_commission_amount: normalizeMoney(payload.reseller_commission_amount) ?? 0,
    supplier_id: payload.supplier_id || null,
    track_inventory: payload.track_inventory !== false,
    low_stock_threshold: lowStockThreshold,
    updated_at: new Date().toISOString()
  }
  const { data, error } = await supabase
    .from('product_admin_details')
    .upsert(clean, { onConflict: 'product_id' })
    .select('*')
    .single()
  if (error) throw readableError(error, 'No se pudieron guardar los datos internos.')
  return data
}

export async function getInventoryHistory(productId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*,product:products(id,name,model),location:inventory_locations(id,name,code)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = data || []
  const actorIds = [...new Set(rows.map((row) => row.created_by).filter(Boolean))]
  if (!actorIds.length) return rows

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id,full_name,email')
    .in('id', actorIds)
  if (profileError) throw profileError

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]))
  return rows.map((row) => {
    const profile = profileMap.get(row.created_by)
    return {
      ...row,
      actor_name: profile?.full_name || profile?.email || (row.created_by ? 'Administrador' : null)
    }
  })
}

export async function createInventoryMovement(payload) {
  requireSupabase()
  const { data, error } = await supabase.rpc('admin_create_inventory_movement', {
    p_product_id: payload.product_id,
    p_movement_type: payload.movement_type,
    p_quantity: normalizePositiveInteger(payload.quantity, 'La cantidad'),
    p_reason: payload.reason?.trim() || '',
    p_notes: payload.notes?.trim() || null,
    p_location_id: payload.location_id || null,
    p_unit_cost_snapshot: normalizeMoney(payload.unit_cost_snapshot),
    p_source_type: 'manual',
    p_source_id: null
  })
  if (error) throw readableError(error, 'No se pudo registrar el movimiento.')
  return Array.isArray(data) ? data[0] : data
}

export async function getInventoryLocations() {
  requireSupabase()
  const { data, error } = await supabase
    .from('inventory_locations')
    .select('*')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function getSuppliers({ includeInactive = false, search = '' } = {}) {
  requireSupabase()
  let query = supabase
    .from('suppliers')
    .select('*')
    .order('created_at', { ascending: false })
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error

  const term = search.trim().toLowerCase()
  if (!term) return data || []
  return (data || []).filter((supplier) => [
    supplier.name,
    supplier.contact_name,
    supplier.phone,
    supplier.email,
    supplier.city
  ].join(' ').toLowerCase().includes(term))
}

export async function getSupplierProductCounts() {
  requireSupabase()
  const { data, error } = await supabase
    .from('product_admin_details')
    .select('supplier_id')
    .not('supplier_id', 'is', null)
  if (error) throw error
  return (data || []).reduce((acc, item) => {
    acc[item.supplier_id] = (acc[item.supplier_id] || 0) + 1
    return acc
  }, {})
}

export async function saveSupplier(payload) {
  requireSupabase()
  const clean = {
    name: payload.name?.trim(),
    contact_name: payload.contact_name?.trim() || null,
    phone: payload.phone?.trim() || null,
    email: payload.email?.trim() || null,
    city: payload.city?.trim() || null,
    address: payload.address?.trim() || null,
    notes: payload.notes?.trim() || null,
    is_active: payload.is_active !== false,
    updated_at: new Date().toISOString()
  }
  if (!clean.name) throw new Error('El nombre del proveedor es obligatorio.')

  let query
  if (payload.id) {
    query = supabase.from('suppliers').update(clean).eq('id', payload.id)
  } else {
    query = supabase.from('suppliers').insert({ ...clean, created_by: await currentUserId() })
  }
  const { data, error } = await query.select('*').single()
  if (error) throw readableError(error, 'No se pudo guardar el proveedor.')
  return data
}

export async function setSupplierActive(id, isActive) {
  requireSupabase()
  const { data, error } = await supabase
    .from('suppliers')
    .update({ is_active: Boolean(isActive), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw readableError(error, 'No se pudo actualizar el proveedor.')
  return data
}
