import { STORE } from '../config/site'

// 85000 -> "85.000 Gs"
export function formatGs(value) {
  const n = Number(value) || 0
  return n.toLocaleString('es-PY').replace(/,/g, '.') + ' Gs'
}

// Ganancia estimada
export function ganancia(suggested, wholesale) {
  return (Number(suggested) || 0) - (Number(wholesale) || 0)
}

// "Máquina para Cortar Pelo" -> "maquina-para-cortar-pelo"
export function slugify(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// Link de WhatsApp con mensaje precargado
export function waLink(message, number = STORE.whatsappNumber) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

// Mensaje por defecto para consultar stock
export function mensajeConsultaStock(p) {
  if (p.custom_whatsapp_message) return p.custom_whatsapp_message
  return (
    `Hola, quiero consultar stock de este producto:\n\n` +
    `Producto: ${p.name}\n` +
    `Precio mayorista: ${formatGs(p.wholesale_price)}\n` +
    `Precio sugerido: ${formatGs(p.suggested_price)}\n\n` +
    `Vengo desde el catálogo de Reventa Camaraza Store.`
  )
}

// Copiar al portapapeles con fallback
export async function copiar(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      return true
    } catch {
      return false
    } finally {
      document.body.removeChild(ta)
    }
  }
}
