import { formatGs } from './utils'

export const ORDER_STATUS_META = {
  pending_contact: { label: 'Pendiente de coordinacion', tone: 'pending' },
  confirmed: { label: 'Coordinado con el cliente', tone: 'confirmed' },
  preparing: { label: 'Preparando pedido', tone: 'preparing' },
  out_for_delivery: { label: 'Entrega en curso', tone: 'delivery' },
  delivered_paid: { label: 'Entregado y cobrado', tone: 'success' },
  cancelled: { label: 'Cancelado', tone: 'danger' },
  failed_delivery: { label: 'Entrega fallida', tone: 'danger' },
  returned: { label: 'Devuelto', tone: 'returned' }
}

export const ORDER_STEPS = [
  ['pending_contact', 'Pendiente'],
  ['confirmed', 'Coordinado'],
  ['preparing', 'Preparando'],
  ['out_for_delivery', 'En reparto'],
  ['delivered_paid', 'Entregado y cobrado']
]

export const ACHIEVEMENT_META = {
  first_sale: { title: 'Primera venta', description: 'Completa tu primera venta entregada.' },
  sales_5: { title: '5 ventas', description: 'Alcanza 5 ventas entregadas.' },
  sales_10: { title: '10 ventas', description: 'Alcanza 10 ventas entregadas.' },
  sales_25: { title: '25 ventas', description: 'Alcanza 25 ventas entregadas.' },
  sales_50: { title: '50 ventas', description: 'Alcanza 50 ventas entregadas.' },
  sales_100: { title: '100 ventas', description: 'Alcanza 100 ventas entregadas.' },
  first_paid_commission: { title: 'Primera comision cobrada', description: 'Recibe tu primer pago de comision.' },
  commission_500k: { title: '500.000 Gs generados', description: 'Genera 500.000 Gs en comisiones.' },
  commission_1m: { title: '1.000.000 Gs generados', description: 'Genera 1.000.000 Gs en comisiones.' },
  weekly_goal_completed: { title: 'Objetivo semanal completado', description: 'Completa tu objetivo semanal.' },
  four_active_weeks: { title: '4 semanas con ventas', description: 'Completa cuatro semanas con al menos una venta.' }
}

export function orderStatusMeta(status) {
  return ORDER_STATUS_META[status] || { label: status || '-', tone: 'neutral' }
}

export function achievementMeta(key) {
  return ACHIEVEMENT_META[key] || { title: key || 'Logro', description: '' }
}

export function shortOrderId(id) {
  return `#${String(id || '').replaceAll('-', '').slice(0, 6).toUpperCase() || '------'}`
}

export function deliveryLine(sale) {
  if (sale?.delivered_at) return `Entregado: ${new Intl.DateTimeFormat('es-PY', { dateStyle: 'short' }).format(new Date(sale.delivered_at))}`
  return 'Entrega por coordinar'
}

export function humanActivity(item) {
  if (item.activity_type === 'achievement') {
    const meta = achievementMeta(item.detail)
    return {
      title: 'Logro desbloqueado',
      detail: meta.title,
      amount: null
    }
  }

  if (item.activity_type === 'payment') {
    return {
      title: 'Pago registrado',
      detail: item.detail || 'Comision depositada',
      amount: item.amount
    }
  }

  const rawStatus = String(item.detail || '').split(' - ').pop()
  const meta = orderStatusMeta(rawStatus)
  return {
    title: meta.label.includes('Entregado') ? 'Pedido entregado y cobrado' : meta.label,
    detail: String(item.detail || '').replace(` - ${rawStatus}`, ''),
    amount: item.amount ? `Comision estimada: ${formatGs(item.amount)}` : null
  }
}
