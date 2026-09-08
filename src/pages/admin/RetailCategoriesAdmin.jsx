import { Edit3, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AdminPageHeader } from '../../components/AdminUX'
import { deleteRetailCategory, getAdminRetailCategories, saveRetailCategory } from '../../lib/adminRetailApi'
import { imageFallback, slugify } from '../../lib/utils'

const empty = { name: '', slug: '', parent_id: '', image_url: '', is_active: true, show_on_home: false, home_sort_order: 0 }

export function RetailCategoriesAdmin() {
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(empty)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const parents = useMemo(() => categories.filter((item) => !item.parent_id && item.id !== form.id), [categories, form.id])
  const parentById = useMemo(() => new Map(categories.map((item) => [item.id, item])), [categories])

  const load = async () => {
    setLoading(true); setError('')
    try { setCategories(await getAdminRetailCategories()) } catch (reason) { setError(reason.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const edit = (category = empty) => {
    setForm({ ...empty, ...category, parent_id: category.parent_id || '', image_url: category.image_url || '' })
    setOpen(true)
  }
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('')
    try { await saveRetailCategory(form); setOpen(false); setForm(empty); await load() } catch (reason) { setError(reason.message) } finally { setSaving(false) }
  }
  const remove = async (category) => {
    if (!window.confirm('Eliminar la categoria ' + category.name + '?')) return
    try { await deleteRetailCategory(category.id); await load() } catch (reason) { setError(reason.message) }
  }

  return <div className="admin-page ax-page retail-categories-admin">
    <AdminPageHeader title="Categorias de la tienda" description="Organiza la navegacion de Camaraza Store para clientes finales.">
      <button className="primary-button" type="button" onClick={() => edit()}><Plus size={17} /> Nueva categoria</button>
    </AdminPageHeader>
    {error && <div className="error-box">{error}</div>}
    {loading ? <div className="ds-skeleton-card"><span /><strong /><p /></div> : !categories.length ? <div className="empty-state">Todavia no hay categorias retail.</div> : <div className="retail-category-admin-list">
      {categories.map((category) => <article key={category.id}>
        <img src={category.image_url || '/placeholder.svg'} alt="" width="64" height="64" loading="lazy" decoding="async" onError={imageFallback} />
        <div><strong>{category.name}</strong><span>{category.parent_id ? 'Subcategoria de ' + (parentById.get(category.parent_id)?.name || 'categoria') : 'Categoria principal'}</span><small>/{category.slug} · {category.is_active ? 'Activa' : 'Inactiva'} · {category.show_on_home ? 'Visible en Home' : 'Fuera de Home'} · Orden {category.home_sort_order}</small></div>
        <button className="icon-button" type="button" aria-label={'Editar ' + category.name} onClick={() => edit(category)}><Edit3 size={17} /></button>
        <button className="icon-button danger-action" type="button" aria-label={'Eliminar ' + category.name} onClick={() => remove(category)}><Trash2 size={17} /></button>
      </article>)}
    </div>}
    {open && <div className="ax-modal-backdrop" role="presentation"><form className="ax-status-modal retail-category-modal" role="dialog" aria-modal="true" aria-label="Categoria retail" onSubmit={submit}>
      <header><h2>{form.id ? 'Editar categoria' : 'Nueva categoria'}</h2><button type="button" onClick={() => setOpen(false)}>Cerrar</button></header>
      <div className="form-grid">
        <label>Nombre *<input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value, slug: value.id ? value.slug : slugify(event.target.value) }))} required /></label>
        <label>Slug *<input value={form.slug} onChange={(event) => setForm((value) => ({ ...value, slug: slugify(event.target.value) }))} required /></label>
        <label>Categoria superior<select value={form.parent_id} onChange={(event) => setForm((value) => ({ ...value, parent_id: event.target.value }))}><option value="">Ninguna</option>{parents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>URL de imagen<input type="url" value={form.image_url} onChange={(event) => setForm((value) => ({ ...value, image_url: event.target.value }))} placeholder="Opcional" /></label>
        <label>Orden en Home<input type="number" step="1" value={form.home_sort_order} onChange={(event) => setForm((value) => ({ ...value, home_sort_order: event.target.value }))} /></label>
        <label className="checkbox-label"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((value) => ({ ...value, is_active: event.target.checked }))} /> Categoria activa</label>
        <label className="checkbox-label"><input type="checkbox" checked={form.show_on_home} onChange={(event) => setForm((value) => ({ ...value, show_on_home: event.target.checked }))} /> Mostrar carrusel en Home</label>
      </div>
      <div className="ax-modal-actions"><button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar categoria'}</button></div>
    </form></div>}
  </div>
}
