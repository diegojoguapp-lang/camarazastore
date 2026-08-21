import { supabase, isSupabaseConfigured } from './supabase'

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

export async function getAdminReports({ date_from, date_to } = {}) {
  requireSupabase()
  const from = date_from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const to = date_to || new Date().toISOString().slice(0, 10)
  const [salesResult, itemsResult, paymentsResult, movementsResult, productsResult] = await Promise.all([
    supabase
      .from('sales')
      .select('id,sale_type,status,total_collected,camaraza_net_profit,reseller_commission,delivered_at,reseller:profiles(id,full_name,reseller_code)')
      .eq('status', 'delivered_paid')
      .gte('delivered_at', `${from}T00:00:00`)
      .lt('delivered_at', `${to}T23:59:59`),
    supabase
      .from('sale_items')
      .select('product_id,product_name_snapshot,quantity,line_subtotal,line_cost_total,line_commission_total,sale:sales(status,delivered_at)')
      .gte('sale.delivered_at', `${from}T00:00:00`)
      .lt('sale.delivered_at', `${to}T23:59:59`),
    supabase
      .from('commission_payments')
      .select('reseller_id,net_paid,status,reseller:profiles(id,full_name,reseller_code)')
      .eq('status', 'paid'),
    supabase
      .from('financial_movements')
      .select('*')
      .gte('occurred_at', `${from}T00:00:00`)
      .lt('occurred_at', `${to}T23:59:59`),
    supabase
      .from('products')
      .select('id,name,stock_quantity,cost_price')
  ])
  if (salesResult.error) throw salesResult.error
  if (itemsResult.error) throw itemsResult.error
  if (paymentsResult.error) throw paymentsResult.error
  if (movementsResult.error) throw movementsResult.error
  if (productsResult.error) throw productsResult.error

  return {
    sales: salesResult.data || [],
    items: (itemsResult.data || []).filter((item) => item.sale?.status === 'delivered_paid'),
    payments: paymentsResult.data || [],
    movements: movementsResult.data || [],
    products: productsResult.data || []
  }
}
