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
  items:sale_items(*)
`

function cleanNumber(value) {
  const number = Number(value || 0)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

function cleanEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

function cleanSalePayload(payload) {
  const status = payload.status || 'pending_contact'
  const items = (payload.items || []).map((item, index) => ({
    product_id: item.product_id,
    quantity: Math.max(Number(item.quantity || 1), 1),
    unit_sale_price: cleanNumber(item.unit_sale_price),
    sort_order: index
  }))
  return {
    sale_type: payload.sale_type || 'reseller',
    reseller_id: payload.reseller_id,
    customer_id: payload.customer_id,
    items,
    status,
    admin_notes: payload.admin_notes?.trim() || null,
    reseller_visible_notes: payload.reseller_visible_notes?.trim() || null,
    delivery_charged: cleanNumber(payload.delivery_charged),
    delivery_city: payload.delivery_city?.trim() || null,
    delivery_reference: payload.delivery_reference?.trim() || null,
    delivery_schedule: payload.delivery_schedule?.trim() || null,
    fulfillment_type: cleanEnum(payload.fulfillment_type, ['delivery', 'transportadora'], 'delivery'),
    payment_method: cleanEnum(payload.payment_method, ['cash', 'transfer', 'card'], 'cash'),
    payment_timing: cleanEnum(payload.payment_timing, ['on_delivery', 'prepaid'], 'on_delivery')
  }
}

function normalizeSale(row) {
  const items = [...(row.items || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  return { ...row, items }
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
      sale.reseller?.full_name,
      sale.reseller?.reseller_code
    ].join(' ').toLowerCase()
    const cityMatch = !city || String(sale.customer?.city || sale.delivery_city || '').toLowerCase().includes(city)
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
    p_reseller_visible_notes: clean.reseller_visible_notes
  })
  if (error) throw error
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
    p_reseller_visible_notes: clean.reseller_visible_notes
  })
  if (error) throw error
  if (!data) throw new Error('No se pudo confirmar la venta actualizada.')
  return { id: data }
}

export async function updateSaleStatus(id, status, notes = '') {
  requireSupabase()
  const { data, error } = await supabase
    .from('sales')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id,status,delivered_at,paid_at')
    .maybeSingle()
  if (error) throw error
  if (!data?.id) throw new Error('No se pudo confirmar el cambio de estado. Revisa que la venta exista y sea visible para el admin.')

  if (notes.trim()) {
    await supabase.from('sale_events').insert({
      sale_id: id,
      event_type: 'status_note',
      to_status: status,
      notes: notes.trim()
    })
  }

  return data
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
