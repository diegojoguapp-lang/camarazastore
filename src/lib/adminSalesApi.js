import { supabase, isSupabaseConfigured } from './supabase'
import { getCurrentSession } from './roles'

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

const SALE_SELECT = `
  *,
  customer:customers(id,full_name,phone,city,neighborhood,address,map_url,reference,requires_advance_payment,notes),
  reseller:profiles(id,reseller_code,full_name,email,city),
  product:products(id,name,model,main_image_url),
  account:financial_accounts(id,name,account_type),
  items:sale_items(*)
`

function cleanNumber(value) {
  const number = Number(value || 0)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

function uuidOrNull(value) {
  const clean = String(value || '').trim()
  return clean || null
}

function cleanEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

function cleanSalePayload(payload) {
  const status = payload.status || 'confirmed'
  const items = (payload.items || []).map((item, index) => ({
    product_id: uuidOrNull(item.product_id),
    quantity: Math.max(Number(item.quantity || 1), 1),
    unit_sale_price: cleanNumber(item.unit_sale_price),
    sort_order: index
  }))
  return {
    sale_type: payload.sale_type || 'reseller',
    reseller_id: uuidOrNull(payload.reseller_id),
    customer_id: uuidOrNull(payload.customer_id),
    items,
    status,
    admin_notes: payload.admin_notes?.trim() || null,
    reseller_visible_notes: payload.reseller_visible_notes?.trim() || null,
    delivery_charged: cleanNumber(payload.delivery_charged),
    delivery_city: payload.delivery_city?.trim() || null,
    delivery_reference: payload.delivery_reference?.trim() || null,
    delivery_schedule: payload.delivery_schedule?.trim() || null,
    fulfillment_type: cleanEnum(payload.fulfillment_type, ['delivery', 'shipping', 'pickup', 'transportadora'], 'delivery'),
    payment_method: cleanEnum(payload.payment_method, ['cash', 'transfer', 'qr', 'card', 'other'], 'cash'),
    payment_timing: cleanEnum(payload.payment_timing, ['on_delivery', 'prepaid'], 'on_delivery'),
    customer_name: payload.customer_name?.trim() || null,
    customer_phone: payload.customer_phone?.trim() || null,
    customer_document: payload.customer_document?.trim() || null,
    shipping_carrier_name: payload.shipping_carrier_name?.trim() || null
  }
}

function readableSaleError(error) {
  const message = error?.message || ''
  if (message.includes('invalid input syntax for type uuid')) return new Error('Hay un campo sin seleccionar. Revisá revendedor, cliente, producto o cuenta antes de guardar.')
  if (message.includes('precio de venta no puede ser menor')) return new Error(message)
  if (message.includes('Reseller sale requires an active reseller')) return new Error('Selecciona un revendedor activo.')
  if (message.includes('Customer name is required')) return new Error('El nombre del cliente es obligatorio.')
  if (message.includes('At least one sale item')) return new Error('Agrega al menos un producto.')
  if (message.includes('Stock can be reserved only for open sales')) return new Error('No se pudo reservar el stock necesario para reactivar esta venta.')
  if (message.includes('Stock insuficiente') || message.includes('No hay stock suficiente')) return new Error(message)
  if (message.includes('La venta debe estar confirmada')) return new Error('Para entregar esta venta, primero debe tener stock reservado o reactivarse con stock disponible.')
  if (message.includes('Delivered sales can only move to returned')) return new Error('Una venta entregada solo puede pasar a devolucion.')
  if (message.includes('Returned sales cannot be reopened')) return new Error('Una venta devuelta no puede reabrirse.')
  if (message.includes('Para entregar y cobrar')) return new Error('Para entregar y cobrar selecciona metodo de pago y cuenta financiera.')
  return error
}

function normalizeSale(row) {
  const items = [...(row.items || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  return {
    ...row,
    customer_display_name: row.customer?.full_name || row.customer_name_snapshot || '',
    customer_display_phone: row.customer?.phone || row.customer_phone_snapshot || '',
    customer_display_city: row.customer?.city || row.delivery_city || '',
    items
  }
}

export async function getAdminSales(filters = {}) {
  requireSupabase()
  let query = supabase
    .from('sales')
    .select(SALE_SELECT)
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.reseller_id) query = query.eq('reseller_id', filters.reseller_id)
  if (filters.date_from) query = query.gte('created_at', `${filters.date_from}T00:00:00`)
  if (filters.date_to) query = query.lte('created_at', `${filters.date_to}T23:59:59`)

  const { data, error } = await query
  if (error) throw error

  let productSaleIds = null
  if (filters.product_id) {
    const { data: itemRows, error: itemError } = await supabase
      .from('sale_items')
      .select('sale_id')
      .eq('product_id', filters.product_id)
    if (itemError) throw itemError
    productSaleIds = new Set((itemRows || []).map((item) => item.sale_id))
  }

  const search = String(filters.search || '').trim().toLowerCase()
  const city = String(filters.city || '').trim().toLowerCase()
  return (data || []).map(normalizeSale).filter((sale) => {
    if (productSaleIds && !productSaleIds.has(sale.id)) return false
    const haystack = [
      sale.product_name_snapshot,
      ...(sale.items || []).map((item) => item.product_name_snapshot),
      sale.customer?.full_name,
      sale.customer?.phone,
      sale.customer_name_snapshot,
      sale.customer_phone_snapshot,
      sale.reseller?.full_name,
      sale.reseller?.reseller_code
    ].join(' ').toLowerCase()
    const cityMatch = !city || String(sale.customer_display_city || '').toLowerCase().includes(city)
    return (!search || haystack.includes(search)) && cityMatch
  })
}

export async function getAdminSaleById(id) {
  requireSupabase()
  const { data, error } = await supabase
    .from('sales')
    .select(SALE_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Venta no encontrada o no visible para el admin.')
  return normalizeSale(data)
}

export async function getSaleEvents(saleId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('sale_events')
    .select('*')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createSale(payload) {
  requireSupabase()
  const session = await getCurrentSession()
  const createdBy = session?.user?.id
  if (!createdBy) throw new Error('Sesion no valida.')

  const clean = cleanSalePayload(payload)
  if (!clean.items.length) throw new Error('Agrega al menos un producto.')
  const { data, error } = await supabase.rpc('admin_save_sale', {
    p_sale_id: null,
    p_sale_type: clean.sale_type,
    p_customer_id: clean.customer_id,
    p_reseller_id: clean.sale_type === 'direct' ? null : clean.reseller_id,
    p_items: clean.items,
    p_status: clean.status,
    p_delivery_charged: clean.delivery_charged,
    p_delivery_city: clean.delivery_city,
    p_delivery_reference: clean.delivery_reference,
    p_delivery_schedule: clean.delivery_schedule,
    p_fulfillment_type: clean.fulfillment_type,
    p_payment_method: clean.payment_method,
    p_payment_timing: clean.payment_timing,
    p_admin_notes: clean.admin_notes,
    p_reseller_visible_notes: clean.reseller_visible_notes,
    p_customer_name: clean.customer_name,
    p_customer_phone: clean.customer_phone,
    p_customer_document: clean.customer_document,
    p_shipping_carrier_name: clean.shipping_carrier_name
  })
  if (error) throw readableSaleError(error)
  if (!data) throw new Error('La venta se guardo, pero Supabase no devolvio el registro.')
  return { id: data }
}

export async function updateSale(id, payload) {
  requireSupabase()
  const clean = cleanSalePayload(payload)
  if (!clean.items.length) throw new Error('Agrega al menos un producto.')
  const { data, error } = await supabase.rpc('admin_save_sale', {
    p_sale_id: id,
    p_sale_type: clean.sale_type,
    p_customer_id: clean.customer_id,
    p_reseller_id: clean.sale_type === 'direct' ? null : clean.reseller_id,
    p_items: clean.items,
    p_status: clean.status,
    p_delivery_charged: clean.delivery_charged,
    p_delivery_city: clean.delivery_city,
    p_delivery_reference: clean.delivery_reference,
    p_delivery_schedule: clean.delivery_schedule,
    p_fulfillment_type: clean.fulfillment_type,
    p_payment_method: clean.payment_method,
    p_payment_timing: clean.payment_timing,
    p_admin_notes: clean.admin_notes,
    p_reseller_visible_notes: clean.reseller_visible_notes,
    p_customer_name: clean.customer_name,
    p_customer_phone: clean.customer_phone,
    p_customer_document: clean.customer_document,
    p_shipping_carrier_name: clean.shipping_carrier_name
  })
  if (error) throw readableSaleError(error)
  if (!data) throw new Error('No se pudo confirmar la venta actualizada.')
  return { id: data }
}

export async function updateSaleStatus(id, status, notes = '') {
  requireSupabase()
  const cleanNotes = typeof notes === 'string' ? notes.trim() : notes?.notes?.trim()
  const { data, error } = await supabase.rpc('admin_transition_sale_status', {
    p_sale_id: uuidOrNull(id),
    p_status: status,
    p_notes: cleanNotes || null,
    p_financial_account_id: uuidOrNull(notes?.financial_account_id),
    p_payment_method: notes?.payment_method || null
  })
  if (error) throw readableSaleError(error)
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.id) throw new Error('No se pudo confirmar el cambio de estado. Revisa que la venta exista y sea visible para el admin.')
  return row
}

export async function getSalesSummary(filters = {}) {
  const sales = await getAdminSales(filters)
  return {
    totalSales: sales.length,
    deliveredSales: sales.filter((sale) => sale.status === 'delivered_paid').length,
    totalCollected: sales
      .filter((sale) => sale.status === 'delivered_paid')
      .reduce((sum, sale) => sum + Number(sale.total_collected || 0), 0),
    totalCommissions: sales
      .filter((sale) => sale.status === 'delivered_paid')
      .reduce((sum, sale) => sum + Number(sale.reseller_commission || 0), 0),
    netProfit: sales
      .filter((sale) => sale.status === 'delivered_paid')
      .reduce((sum, sale) => sum + Number(sale.camaraza_net_profit || 0), 0)
  }
}
