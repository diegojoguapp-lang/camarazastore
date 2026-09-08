import { supabase, isSupabaseConfigured } from './supabase'
import { slugify } from './utils'

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

function readableError(error) {
  const message = error?.message || ''
  if (/retail_categories_slug_unique_idx|duplicate key/i.test(message)) return new Error('Ya existe una categoria con ese slug.')
  if (/foreign key|still referenced/i.test(message)) return new Error('No se puede eliminar una categoria que tiene productos o subcategorias.')
  return new Error(message || 'No se pudo guardar la categoria.')
}

export async function getAdminRetailCategories() {
  requireSupabase()
  const { data, error } = await supabase.from('retail_categories').select('*').order('home_sort_order', { ascending: true }).order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function saveRetailCategory(payload) {
  requireSupabase()
  const name = payload.name?.trim()
  const clean = {
    name,
    slug: slugify(payload.slug || name),
    parent_id: payload.parent_id || null,
    image_url: payload.image_url?.trim() || null,
    is_active: payload.is_active !== false,
    show_on_home: Boolean(payload.show_on_home),
    home_sort_order: Number(payload.home_sort_order || 0),
    updated_at: new Date().toISOString()
  }
  if (!name) throw new Error('El nombre es obligatorio.')
  if (!clean.slug) throw new Error('El slug es obligatorio.')
  const query = payload.id
    ? supabase.from('retail_categories').update(clean).eq('id', payload.id)
    : supabase.from('retail_categories').insert(clean)
  const { data, error } = await query.select('*').single()
  if (error) throw readableError(error)
  return data
}

export async function deleteRetailCategory(id) {
  requireSupabase()
  const { error } = await supabase.from('retail_categories').delete().eq('id', id)
  if (error) throw readableError(error)
}

