export const STORE_NAME = 'Camaraza Store'
export const STORE_ORIGIN = 'https://www.camarazastore.com'

export const STORE_COPY = {
  tagline: 'Electronica, tecnologia y mas',
  delivery: 'Delivery a coordinar por WhatsApp',
  payment: 'Forma de pago a coordinar por WhatsApp',
  defaultWarranty: '48 horas por falla de fabrica'
}

export function getPublicProductUrl(slug) {
  return `${STORE_ORIGIN}/producto/${encodeURIComponent(String(slug || '').trim())}`
}

export function getPublicCategoryUrl(slug) {
  return `${STORE_ORIGIN}/categoria/${encodeURIComponent(String(slug || '').trim())}`
}

