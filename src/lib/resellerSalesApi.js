import { supabase, isSupabaseConfigured } from './supabase'
import { COMMISSION_ESTIMATED_STATUSES, COMMISSION_CONFIRMED_STATUS } from './salesConstants'
import { getCurrentCommissionPeriod } from './dateUtils'

const RESELLER_SALES_FIELDS = [
  'id',
  'reseller_id',
  'product_id',
  'product_name_snapshot',
  'product_model_snapshot',
  'quantity',
  'status',
  'reseller_visible_notes',
  'product_sale_price',
  'delivery_charged',
  'total_collected',
  'reseller_commission',
  'ordered_at',
  'delivered_at',
  'created_at',
  'delivery_city',
  'customer_name',
  'customer_phone_masked',
  'customer_city'
].join(',')

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

export async function getMySales(filters = {}) {
  requireSupabase()
  let query = supabase
    .from('reseller_sales')
    .select(RESELLER_SALES_FIELDS)
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.date_from) query = query.gte('created_at', `${filters.date_from}T00:00:00`)
  if (filters.date_to) query = query.lte('created_at', `${filters.date_to}T23:59:59`)

  const { data, error } = await query
  if (error) throw error

  const search = String(filters.search || '').trim().toLowerCase()
  return (data || []).filter((sale) => {
    if (!search) return true
    return String(sale.product_name_snapshot || '').toLowerCase().includes(search)
  })
}

export async function getMyRecentSales() {
  const sales = await getMySales()
  return sales.slice(0, 5)
}

export async function getMySalesSummary() {
  const sales = await getMySales()
  const { start, end } = getCurrentCommissionPeriod()

  const pendingEstimated = sales
    .filter((sale) => COMMISSION_ESTIMATED_STATUSES.includes(sale.status))
    .reduce((sum, sale) => sum + Number(sale.reseller_commission || 0), 0)

  const delivered = sales.filter((sale) => sale.status === COMMISSION_CONFIRMED_STATUS)
  const deliveredWeek = delivered.filter((sale) => {
    if (!sale.delivered_at) return false
    const deliveredAt = new Date(sale.delivered_at)
    return deliveredAt >= start && deliveredAt <= end
  })

  return {
    periodStart: start,
    periodEnd: end,
    pendingEstimated,
    confirmedWeek: deliveredWeek.reduce((sum, sale) => sum + Number(sale.reseller_commission || 0), 0),
    deliveredWeekCount: deliveredWeek.length,
    deliveredTotalCount: delivered.length,
    historicalEarned: delivered.reduce((sum, sale) => sum + Number(sale.reseller_commission || 0), 0)
  }
}
