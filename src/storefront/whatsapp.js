import { formatGs } from '../lib/utils'
import { getPublicProductUrl } from './config'

export function buildStoreOrderMessage(items, customer) {
  const lines = ['Hola, quiero hacer este pedido en Camaraza Store:', '']
  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.name}`)
    lines.push(`Cantidad: ${item.quantity}`)
    lines.push(`Precio: ${formatGs(item.retail_price)}`)
    lines.push(`Subtotal: ${formatGs(item.retail_price * item.quantity)}`)
    lines.push('Ver producto:')
    lines.push(getPublicProductUrl(item.slug))
    lines.push('')
  })
  lines.push(`Total: ${formatGs(items.reduce((sum, item) => sum + item.retail_price * item.quantity, 0))}`)
  if (customer.name?.trim()) lines.push('', `Nombre: ${customer.name.trim()}`)
  if (customer.phone?.trim()) lines.push(`WhatsApp: ${customer.phone.trim()}`)
  if (customer.city?.trim()) lines.push(`Ciudad/Zona: ${customer.city.trim()}`)
  if (customer.note?.trim()) lines.push(`Nota: ${customer.note.trim()}`)
  lines.push('', 'Quiero coordinar la entrega.')
  return lines.join('\n')
}

export function buildWhatsappUrl(phone, message) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
