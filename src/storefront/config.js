export const STORE_NAME = 'Camaraza Store'
export const STORE_ORIGIN = 'https://www.camarazastore.com'
const WARRANTY_COPY = '48 horas por falla de fabrica'
const DELIVERY_COPY = 'Envios coordinados por WhatsApp'

export const STORE_COPY = {
  tagline: 'Electronica, tecnologia y mas',
  delivery: 'Delivery a coordinar por WhatsApp',
  payment: 'Forma de pago a coordinar por WhatsApp',
  defaultWarranty: WARRANTY_COPY,
  trust: [
    { key: 'delivery', title: 'Delivery', text: DELIVERY_COPY },
    { key: 'warranty', title: 'Garantia', text: WARRANTY_COPY },
    { key: 'support', title: 'Atencion directa', text: 'Consultanos por WhatsApp' }
  ]
}

export function getPublicProductUrl(slug) {
  return `${STORE_ORIGIN}/producto/${encodeURIComponent(String(slug || '').trim())}`
}

export function getPublicCategoryUrl(slug) {
  return `${STORE_ORIGIN}/categoria/${encodeURIComponent(String(slug || '').trim())}`
}
