import { supabase } from './supabase'

export function operationError(error) {
  const message = String(error?.message || '')
  if (error?.code === 'PGRST202' || error?.code === 'PGRST204' || /schema cache|Could not find the function/i.test(message)) return new Error('Esta actualizacion todavia no esta disponible en la base de datos. Revisa la migracion Operacion Comercial V2.')
  if (error?.code === '23503') return new Error('El registro tiene operaciones relacionadas. No se puede eliminar.')
  if (error?.code === '23505') return new Error('La operacion ya fue registrada. Actualiza el listado antes de reintentar.')
  if (error?.code === '22P02' || /invalid input syntax|uuid/i.test(message)) return new Error('Revisa los campos seleccionados antes de guardar.')
  if (error?.code === '40001' || error?.code === '40P01') return new Error('Otra operacion modifico estos datos. Actualiza y vuelve a intentar.')
  if (/Failed to fetch|NetworkError|network/i.test(message)) return new Error('No se pudo conectar. Revisa tu conexion y vuelve a intentar.')
  if (/not found or inactive|Selecciona la cuenta|Para entregar y cobrar/i.test(message)) return new Error('Selecciona una cuenta de cobro activa antes de marcar como entregado.')
  if (/stock/i.test(message)) return new Error('No se pudo completar la operacion de stock. Revisa las cantidades y el inventario disponible.')
  if (/Only active|Authenticated|permission denied/i.test(message)) return new Error('Necesitas una sesion autorizada y activa.')
  if (/Reseller sale requires/i.test(message)) return new Error('Selecciona un revendedor activo.')
  if (/Customer name is required/i.test(message)) return new Error('El nombre del cliente es obligatorio.')
  if (/SQL|column|constraint|relation|syntax|function|stack/i.test(message)) return new Error('No se pudo completar la operacion. Revisa la configuracion de esta actualizacion.')
  return new Error(message || 'No se pudo completar la operacion.')
}

export async function operationRpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw operationError(error)
  return data
}

export async function getCollectionSettings() {
  const { data, error } = await supabase.from('business_settings').select('default_cash_account_id,default_transfer_account_id').eq('id', true).single()
  if (error) throw operationError(error)
  if (!data) throw new Error('No se encontro la configuracion de cobros. Revisa la migracion Operacion Comercial V2.')
  return data
}

export async function getDailyOperations(date) {
  // Pagina cada consulta para no truncar silenciosamente en el limite de PostgREST.
  const rows = []
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await supabase.from('sales').select(`id,sale_number,operation_date,status,customer_contacted_at,
      customer_name_snapshot,customer_phone_snapshot,delivery_city,fulfillment_type,sale_type,product_name_snapshot,
      product_sale_price,delivery_charged,total_collected,payment_method,financial_account_id,cash_tendered_amount,
      customer:customers(full_name,phone),account:financial_accounts(name),reseller:profiles(full_name),
      items:sale_items(id,sort_order,quantity,product_name_snapshot,product:products(main_image_url))`)
      .eq('operation_date', date).in('status', ['confirmed', 'out_for_delivery', 'delivered_paid'])
      .order('id').range(offset, offset + 199)
    if (error) throw operationError(error)
    rows.push(...data)
    if (data.length < 200) return rows
  }
}

export const getMyOperationHome = () => operationRpc('get_my_operation_home_v2')
export const getMyCommissionBalances = () => operationRpc('get_my_commission_balances_v2')
export const getAdminCommissionBalances = () => operationRpc('admin_commission_balances_v2')
export const getMyOperationSales = (filters = {}) => operationRpc('get_my_operation_sales_v2', {
  p_from: filters.from || null, p_to: filters.to || null, p_status: filters.status || null,
  p_search: filters.search || null, p_offset: filters.offset || 0, p_limit: 20
})
export const saveOperationSale = (id, payload) => operationRpc('admin_save_sale_v2', { p_sale_id: id || null, p_payload: payload }).then((saleId) => ({ id: saleId }))
