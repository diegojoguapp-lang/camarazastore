import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisá tu archivo .env'
  )
}

export const supabase = createClient(url, anonKey)

// Nombre del bucket de Storage para las imágenes de productos
export const BUCKET = 'product-images'
