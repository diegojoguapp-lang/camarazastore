// Configuración global de Camaraza Store.
// En V1 todo se controla desde acá y desde variables de entorno.

export const STORE = {
  name: 'Camaraza Store',
  tagline: 'Productos físicos para revender desde tu celular.',
  // Número en formato internacional sin "+", ej: 595981123456
  whatsappNumber: import.meta.env.VITE_WHATSAPP_NUMBER || '595000000000',
  domain: 'camarazastore.com',
}

// Estados públicos -> etiqueta visible + estilo de badge
export const PUBLIC_STATUS = {
  disponible:       { label: 'Disponible',        tone: 'ok' },
  consultar_stock:  { label: 'Consultar stock',   tone: 'info' },
  ultimas_unidades: { label: 'Últimas unidades',  tone: 'warn' },
  agotado:          { label: 'Agotado',           tone: 'muted' },
}

export const INTERNAL_STATUS = {
  active:   'Activo',
  hidden:   'Oculto',
  sold_out: 'Agotado',
}

export const CATEGORIES = [
  'Barbería',
  'Hogar',
  'Tecnología',
  'Belleza',
  'Iluminación',
  'Audio',
  'Otros',
]
