export const cancellationReasons = [
  ['customer_changed_mind', 'Cliente se arrepintio'],
  ['no_response', 'Cliente no respondio'],
  ['delivery', 'Delivery'],
  ['price', 'Precio'],
  ['not_available', 'No estaba disponible'],
  ['order_error', 'Error en el pedido'],
  ['out_of_stock', 'Sin stock'],
  ['other', 'Otro']
]

export function cancellationLabel(reason) {
  return cancellationReasons.find(([code]) => code === reason)?.[1] || 'Sin motivo historico'
}

export function saleCode(sale) {
  return sale?.sale_number ? `PED-${String(sale.sale_number).padStart(6, '0')}` : 'Pedido'
}

export function goalProgress(count, goal) {
  const delivered = Math.max(0, Number(count) || 0)
  const target = Number(goal)
  if (!Number.isFinite(target) || target <= 0) return { percent: 0, bar: 0, message: 'Meta sin configurar' }
  const percent = Math.round(delivered / target * 100)
  return {
    percent,
    bar: Math.min(percent, 100),
    message: delivered > target ? `Meta superada · ${percent}%` : delivered === target
      ? 'Meta diaria cumplida' : `Faltan ${target - delivered} pedidos para cumplir la meta de hoy.`
  }
}
