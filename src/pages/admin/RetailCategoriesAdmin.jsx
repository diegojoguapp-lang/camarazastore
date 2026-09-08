import { Edit3, Plus, Power, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AdminPageHeader, AdminStatusBadge } from '../../components/AdminUX'
import { deleteRetailCategory, getAdminRetailCategories, saveRetailCategory, setRetailCategoryActive } from '../../lib/adminRetailApi'
import { slugify } from '../../lib/utils'

const empty = {
  name: '',
  slug: '',
  parent_id: '',
  image_url: '',
  is_active: true,
  show_on_home: false,
  home_sort_order: 0
}

function hierarchy(categories) {
  const roots = categories.filter((item) => !item.parent_id)
  const children = new Map()
  categories.filter((item) => item.parent_id).forEach((item) => {
    children.set(item.parent_id, [...(children.get(item.parent_id) || []), item])
  })
  const rows = roots.flatMap((root) => [
    { ...root, level: 0 },
    ...(children.get(root.id) || []).map((child) => ({ ...child, level: 1 }))
  ])
  const included = new Set(rows.map((item) => item.id))
  return [...rows, ...categories.filter((item) => !included.has(item.id)).map((item) => ({ ...item, level: 1 }))]
}

export function RetailCategoriesAdmin() {
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(empty)
  const [open, setOpen] = useState(false)
  const [slugEdited, setSlugEdited] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const parents = useMemo(
    () => categories.filter((item) => !item.parent_id && item.id !== form.id),
    [categories, form.id]
  )
  const parentById = useMemo(() => new Map(categories.map((item) => [item.id, item])), [categories])
  const rows = useMemo(() => hierarchy(categories), [categories])

  const load = async () => {
    setLoading(true)
    try {
      setCategories(await getAdminRetailCategories())
    } catch (reason) {
      setError(reason.message || 'No se pudieron cargar las categorías.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openForm = (category = null) => {
    setError('')
    setSuccess('')
    setSlugEdited(Boolean(category))
    setForm(category
      ? { ...empty, ...category, parent_id: category.parent_id || '', image_url: category.image_url || '' }
      : { ...empty })
    setOpen(true)
  }

  const closeForm = () => {
    if (saving) return
    setOpen(false)
    setForm(empty)
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    const wasEditing = Boolean(form.id)
    try {
      await saveRetailCategory(form)
      setOpen(false)
      setForm(empty)
      await load()
      setSuccess(wasEditing ? 'Categoría actualizada correctamente.' : 'Categoría creada correctamente.')
    } catch (reason) {
      setError(reason.message || 'No se pudo guardar la categoría.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (category) => {
    setBusyId(category.id)
    setError('')
    setSuccess('')
    try {
      await setRetailCategoryActive(category.id, !category.is_active)
      await load()
      setSuccess(category.is_active ? 'Categoría desactivada correctamente.' : 'Categoría activada correctamente.')
    } catch (reason) {
      setError(reason.message || 'No se pudo cambiar el estado.')
    } finally {
      setBusyId('')
    }
  }

  const remove = async (category) => {
    setError('')
    setSuccess('')
    if (category.product_count > 0) {
      setError('Esta categoría tiene productos asignados. Desactivala o reasigna los productos antes de eliminarla.')
      return
    }
    if (category.child_count > 0) {
      setError('Esta categoría tiene subcategorías. Desactivalas o reasignalas antes de eliminarla.')
      return
    }
    if (!window.confirm('¿Eliminar la categoría ' + category.name + '? Esta acción no se puede deshacer.')) return
    setBusyId(category.id)
    try {
      await deleteRetailCategory(category.id)
      await load()
      setSuccess('Categoría eliminada correctamente.')
    } catch (reason) {
      setError(reason.message || 'No se pudo eliminar la categoría.')
    } finally {
      setBusyId('')
    }
  }

  const newCategoryButton = (
    <button className="primary-button" type="button" onClick={() => openForm()}>
      <Plus size={17} /> Nueva categoría
    </button>
  )

  return (
    <div className="admin-page ax-page retail-categories-admin">
      <AdminPageHeader
        title="Categorías de la tienda"
        description="Organiza la navegación de Camaraza Store para clientes finales."
        actions={newCategoryButton}
      />

      {success && <div className="toast" role="status">{success}</div>}
      {error && <div className="error-box" role="alert">{error}</div>}

      {loading ? (
        <div className="ds-skeleton-card"><span /><strong /><p /></div>
      ) : !categories.length ? (
        <section className="retail-category-empty">
          <strong>Todavía no hay categorías retail.</strong>
          <p>Crea la primera categoría para ordenar los productos de Camaraza Store.</p>
          <button className="primary-button" type="button" onClick={() => openForm()}>
            <Plus size={17} /> Crear primera categoría
          </button>
        </section>
      ) : (
        <div className="retail-category-table-wrap">
          <table className="retail-category-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Padre</th>
                <th>Activa</th>
                <th>Home</th>
                <th>Orden</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((category) => (
                <tr key={category.id} className={category.level ? 'is-child' : ''}>
                  <td data-label="Nombre">
                    <div className="retail-category-name">
                      {category.level > 0 && <span aria-hidden="true">└</span>}
                      <div>
                        <strong>{category.name}</strong>
                        <small>/{category.slug}</small>
                      </div>
                    </div>
                  </td>
                  <td data-label="Tipo">{category.parent_id ? 'Subcategoría' : 'Principal'}</td>
                  <td data-label="Padre">{category.parent_id ? parentById.get(category.parent_id)?.name || 'No disponible' : '-'}</td>
                  <td data-label="Activa"><AdminStatusBadge tone={category.is_active ? 'success' : 'neutral'}>{category.is_active ? 'Si' : 'No'}</AdminStatusBadge></td>
                  <td data-label="Home"><AdminStatusBadge tone={category.show_on_home ? 'success' : 'neutral'}>{category.show_on_home ? 'Si' : 'No'}</AdminStatusBadge></td>
                  <td data-label="Orden">{category.home_sort_order}</td>
                  <td data-label="Acciones">
                    <div className="retail-category-actions">
                      <button className="secondary-button" type="button" disabled={busyId === category.id} onClick={() => openForm(category)}><Edit3 size={15} /> Editar</button>
                      <button className="secondary-button" type="button" disabled={busyId === category.id} onClick={() => toggleActive(category)}><Power size={15} /> {category.is_active ? 'Desactivar' : 'Activar'}</button>
                      <button className="secondary-button danger-action" type="button" disabled={busyId === category.id} onClick={() => remove(category)} title={category.product_count || category.child_count ? 'Primero reasigna sus productos o subcategorías.' : 'Eliminar categoría'}><Trash2 size={15} /> Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="ax-modal-backdrop" role="presentation">
          <form className="ax-status-modal retail-category-modal" role="dialog" aria-modal="true" aria-label={form.id ? 'Editar categoría' : 'Nueva categoría'} onSubmit={submit}>
            <header>
              <h2>{form.id ? 'Editar categoría' : 'Nueva categoría'}</h2>
              <button type="button" onClick={closeForm} disabled={saving}>Cerrar</button>
            </header>
            <div className="form-grid">
              <label>Nombre *
                <input
                  value={form.name}
                  autoFocus
                  maxLength="100"
                  onChange={(event) => setForm((value) => ({
                    ...value,
                    name: event.target.value,
                    slug: slugEdited ? value.slug : slugify(event.target.value)
                  }))}
                  required
                />
              </label>
              <label>Slug *
                <input
                  value={form.slug}
                  maxLength="120"
                  onChange={(event) => {
                    setSlugEdited(true)
                    setForm((value) => ({ ...value, slug: slugify(event.target.value) }))
                  }}
                  required
                />
                <small>Debe ser unico. Se usa en la URL publica.</small>
              </label>
              <label>Categoría padre
                <select value={form.parent_id} onChange={(event) => setForm((value) => ({ ...value, parent_id: event.target.value }))}>
                  <option value="">Ninguna / Categoría principal</option>
                  {parents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label>Imagen URL
                <input type="url" value={form.image_url} onChange={(event) => setForm((value) => ({ ...value, image_url: event.target.value }))} placeholder="Opcional" />
              </label>
              <label>Orden en Home
                <input type="number" step="1" value={form.home_sort_order} onChange={(event) => setForm((value) => ({ ...value, home_sort_order: event.target.value }))} />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((value) => ({ ...value, is_active: event.target.checked }))} /> Activa
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={form.show_on_home} onChange={(event) => setForm((value) => ({ ...value, show_on_home: event.target.checked }))} /> Mostrar en Home
              </label>
            </div>
            <div className="ax-modal-actions">
              <button className="secondary-button" type="button" onClick={closeForm} disabled={saving}>Cancelar</button>
              <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar categoría'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
