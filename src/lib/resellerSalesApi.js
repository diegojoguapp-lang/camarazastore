import { supabase, isSupabaseConfigured } from './supabase'
import { COMMISSION_CONFIRMED_STATUS, COMMISSION_ESTIMATED_STATUSES } from './salesConstants'
import { getCurrentCommissionPeriod, getNextCommissionPayment } from './dateUtils'

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
  'commission_paid',
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

function nextDateInputDay(value) {
  const [year, month, day] = String(value).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + 1))
  return date.toISOString().slice(0, 10)
}

export async function getMySales(filters = {}) {
  requireSupabase()
  let query = supabase
    .from('reseller_sales')
    .select(RESELLER_SALES_FIELDS)
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.delivered_from) query = query.gte('delivered_at', filters.delivered_from)
  if (filters.delivered_before) query = query.lt('delivered_at', filters.delivered_before)
  if (filters.date_from) query = query.gte('delivered_at', `${filters.date_from}T00:00:00`)
  if (filters.date_to) query = query.lt('delivered_at', `${nextDateInputDay(filters.date_to)}T00:00:00`)

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
  const { start, endExclusive } = getCurrentCommissionPeriod()
  const nextPayment = getNextCommissionPayment()
  const [sales, delivered, deliveredWeek, payments] = await Promise.all([
    getMySales(),
    getMySales({ status: COMMISSION_CONFIRMED_STATUS }),
    getMySales({
      status: COMMISSION_CONFIRMED_STATUS,
      delivered_from: start.toISOString(),
      delivered_before: endExclusive.toISOString()
    }),
    supabase
      .from('commission_payments')
      .select('net_paid,status')
      .eq('status', 'paid')
  ])
  const paidRows = payments.error ? [] : payments.data || []

  const pendingEstimated = delivered
    .filter((sale) => sale.commission_paid !== true)
    .reduce((sum, sale) => sum + Number(sale.reseller_commission || 0), 0)
  const openEstimated = sales
    .filter((sale) => COMMISSION_ESTIMATED_STATUSES.includes(sale.status))
    .reduce((sum, sale) => sum + Number(sale.reseller_commission || 0), 0)

  return {
    periodStart: start,
    periodEndExclusive: endExclusive,
    nextPaymentDate: nextPayment.date,
    nextPaymentLabel: nextPayment.label,
    nextPaymentHolidayNote: nextPayment.holidayNote,
    openEstimated,
    pendingEstimated,
    confirmedWeek: deliveredWeek.reduce((sum, sale) => sum + Number(sale.reseller_commission || 0), 0),
    deliveredWeekCount: deliveredWeek.length,
    deliveredTotalCount: delivered.length,
    historicalEarned: paidRows.reduce((sum, payment) => sum + Number(payment.net_paid || 0), 0)
  }
}
