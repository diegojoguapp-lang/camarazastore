export const SALE_STATUSES = [
  'pending_contact',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered_paid',
  'cancelled',
  'failed_delivery',
  'returned'
]

export const SALE_STATUS_LABELS = {
  pending_contact: 'Pendiente de contacto',
  confirmed: 'Confirmada',
  preparing: 'En preparacion',
  out_for_delivery: 'En reparto',
  delivered_paid: 'Entregada y cobrada',
  cancelled: 'Cancelada',
  failed_delivery: 'Entrega fallida',
  returned: 'Devuelta'
}

export const COMMISSION_ESTIMATED_STATUSES = ['confirmed', 'preparing', 'out_for_delivery']
export const COMMISSION_CONFIRMED_STATUS = 'delivered_paid'

export function saleStatusLabel(status) {
  return SALE_STATUS_LABELS[status] || status || '-'
}

export function calculateSaleTotals(values) {
  const productSalePrice = Number(values.product_sale_price || 0)
  const productCost = Number(values.product_cost || 0)
  const deliveryCharged = Number(values.delivery_charged || 0)
  const deliveryCost = Number(values.delivery_cost || 0)
  const resellerCommission = Number(values.reseller_commission || 0)
  const otherCosts = Number(values.other_costs || 0)

  return {
    total_collected: productSalePrice + deliveryCharged,
    camaraza_net_profit: productSalePrice - productCost - resellerCommission + deliveryCharged - deliveryCost - otherCosts
  }
}
