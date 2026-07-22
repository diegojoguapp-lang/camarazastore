import { supabase, isSupabaseConfigured } from './supabase'
import { COMMISSION_CONFIRMED_STATUS, COMMISSION_ESTIMATED_STATUSES } from './salesConstants'

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

function normalizeSale(row) {
  return {
    id: row.sale_id,
    sale_id: row.sale_id,
    product_name_snapshot: row.product_name,
    product_model_snapshot: row.product_model,
    quantity: row.quantity,
    status: row.status,
    reseller_visible_notes: row.reseller_visible_notes,
    product_sale_price: row.product_sale_price,
    delivery_charged: row.delivery_charged,
    total_collected: row.total_collected,
    reseller_commission: row.reseller_commission,
    ordered_at: row.ordered_at,
    delivered_at: row.delivered_at,
    created_at: row.created_at,
    delivery_city: row.delivery_city,
    customer_name: row.customer_name,
    customer_phone_masked: row.customer_phone_masked,
    customer_city: row.customer_city,
    commission_paid: row.commission_paid,
    commission_paid_at: row.commission_paid_at
  }
}

function statusForFilter(filter) {
  const map = {
    pending: 'pending_contact',
    delivered: COMMISSION_CONFIRMED_STATUS
  }
  if (filter === 'process' || filter === 'cancelled' || filter === 'all') return null
  return map[filter] || filter || null
}

export function commissionState(sale) {
  if (sale.commission_paid) return 'Pagada'
  if (sale.status === COMMISSION_CONFIRMED_STATUS) return 'Confirmada pendiente'
  if (COMMISSION_ESTIMATED_STATUSES.includes(sale.status)) return 'Estimada'
  return 'No aplica'
}

export async function getMySales(filters = {}) {
  requireSupabase()
  const { data, error } = await supabase.rpc('get_my_sales', {
    p_status: statusForFilter(filters.status),
    p_search: filters.search?.trim() || null,
    p_limit: filters.limit || 100,
    p_offset: filters.offset || 0,
    p_date_from: filters.date_from || null,
    p_date_to: filters.date_to || null
  })
  if (error) throw error

  const rows = (data || []).map(normalizeSale)
  if (filters.group === 'process') {
    return rows.filter((sale) => COMMISSION_ESTIMATED_STATUSES.includes(sale.status))
  }
  if (filters.group === 'cancelled') {
    return rows.filter((sale) => ['cancelled', 'failed_delivery', 'returned'].includes(sale.status))
  }
  return rows
}

export async function getMyRecentSales() {
  return getMySales({ limit: 5 })
}

export async function getMySalesSummary() {
  requireSupabase()
  const { data: dashboardRows, error: dashboardError } = await supabase.rpc('get_my_reseller_dashboard')
  if (dashboardError) throw dashboardError

  const dashboard = dashboardRows?.[0] || {}
  const pipeline = {
    pending_contact: Number(dashboard.pending_contact_sales || 0),
    confirmed: Number(dashboard.confirmed_sales || 0),
    preparing: Number(dashboard.preparing_sales || 0),
    out_for_delivery: Number(dashboard.out_for_delivery_sales || 0),
    delivered_paid: Number(dashboard.total_delivered_sales || 0),
    cancelled_group: Number(dashboard.cancelled_or_failed_sales || 0)
  }

  return {
    estimatedCommission: Number(dashboard.estimated_commission || 0),
    unpaidConfirmedCommission: Number(dashboard.unpaid_confirmed_commission || 0),
    currentPeriodCommission: Number(dashboard.current_period_commission || 0),
    currentPeriodDeliveredSales: Number(dashboard.current_period_delivered_sales || 0),
    totalDeliveredSales: Number(dashboard.total_delivered_sales || 0),
    totalHistoricalCommission: Number(dashboard.total_historical_commission || 0),
    totalPaidCommission: Number(dashboard.total_paid_commission || 0),
    totalPendingPayments: Number(dashboard.total_pending_payments || 0),
    nextPaymentDate: dashboard.next_payment_date,
    periodStart: dashboard.current_period_start,
    periodEnd: dashboard.current_period_end,
    pipeline
  }
}
