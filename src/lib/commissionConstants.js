export const BATCH_STATUSES = ['draft', 'ready', 'paid', 'cancelled']
export const PAYMENT_STATUSES = ['pending', 'paid', 'cancelled']

export const BATCH_STATUS_LABELS = {
  draft: 'Borrador',
  ready: 'Listo',
  paid: 'Pagado',
  cancelled: 'Cancelado'
}

export const PAYMENT_STATUS_LABELS = {
  pending: 'Pendiente',
  paid: 'Pagado',
  cancelled: 'Cancelado'
}

export function batchStatusLabel(status) {
  return BATCH_STATUS_LABELS[status] || status || '-'
}

export function paymentStatusLabel(status) {
  return PAYMENT_STATUS_LABELS[status] || status || '-'
}

export function calculateNetPaid({ gross_commission = 0, adjustments = 0, discounts = 0 } = {}) {
  return Math.max(Number(gross_commission || 0) + Number(adjustments || 0) - Number(discounts || 0), 0)
}
