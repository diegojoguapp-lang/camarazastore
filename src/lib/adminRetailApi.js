import { supabase, isSupabaseConfigured } from './supabase'
import { slugify } from './utils'

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase no esta configurado.')
}

function readableError(error) {
  const message = error?.message || ''
  if (/retail_categories_slug_unique_idx|duplicate key/i.test(message)) return new Error('Ya existe una categoría con ese slug.')
  if (/foreign key|still referenced/i.test(message)) return new Error('No se puede eliminar una categoría que tiene productos o subcategorías.')
  return new Error(message || 'No se pudo guardar la categoría.')
}

export async function getAdminRetailCategories() {
  requireSupabase()
  const [categoriesResult, productsResult] = await Promise.all([
    supabase.from('retail_categories').select('*').order('home_sort_order', { ascending: true }).order('name', { ascending: true }),
    supabase.from('product_admin_details').select('product_id,retail_category_id').not('retail_category_id', 'is', null)
  ])
  if (categoriesResult.error) throw categoriesResult.error
  if (productsResult.error) throw productsResult.error
  const productCounts = (productsResult.data || []).reduce((counts, row) => {
    counts[row.retail_category_id] = (counts[row.retail_category_id] || 0) + 1
    return counts
  }, {})
  const childCounts = (categoriesResult.data || []).reduce((counts, row) => {
    if (row.parent_id) counts[row.parent_id] = (counts[row.parent_id] || 0) + 1
    return counts
  }, {})
  return (categoriesResult.data || []).map((category) => ({
    ...category,
    product_count: productCounts[category.id] || 0,
    child_count: childCounts[category.id] || 0
  }))
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
  if (!Number.isInteger(clean.home_sort_order)) throw new Error('El orden en Home debe ser un numero entero.')
  const query = payload.id
    ? supabase.from('retail_categories').update(clean).eq('id', payload.id)
    : supabase.from('retail_categories').insert(clean)
  const { data, error } = await query.select('*').single()
  if (error) throw readableError(error)
  return data
}

export async function deleteRetailCategory(id) {
  requireSupabase()
  const [productsResult, childrenResult] = await Promise.all([
    supabase.from('product_admin_details').select('product_id').eq('retail_category_id', id),
    supabase.from('retail_categories').select('id').eq('parent_id', id)
  ])
  if (productsResult.error) throw productsResult.error
  if (childrenResult.error) throw childrenResult.error
  if (productsResult.data?.length) throw new Error('Esta categoría tiene productos asignados. Desactivala o reasigna los productos antes de eliminarla.')
  if (childrenResult.data?.length) throw new Error('Esta categoría tiene subcategorías. Desactivalas o reasignalas antes de eliminarla.')
  const { error } = await supabase.from('retail_categories').delete().eq('id', id)
  if (error) throw readableError(error)
}

export async function setRetailCategoryActive(id, isActive) {
  requireSupabase()
  const { data, error } = await supabase
    .from('retail_categories')
    .update({ is_active: Boolean(isActive), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw readableError(error)
  return data
}
