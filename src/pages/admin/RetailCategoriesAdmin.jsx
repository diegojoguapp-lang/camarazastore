import { ArrowDown, ArrowUp, Edit3, ImagePlus, PackagePlus, Plus, Power, Save, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminPageHeader, AdminStatusBadge } from '../../components/AdminUX'
import {
  bulkAddCategoryProducts, bulkRemoveCategoryProducts, deleteRetailCategory, getAdminRetailCategories,
  getCategoryProducts, removeRetailAsset, saveRetailCategory, searchProductsForCategory,
  setRetailCategoryActive, updateCategoryProductOrder, uploadRetailAsset
} from '../../lib/adminRetailApi'
import { formatGs, getDisplayImageUrl, imageFallback, slugify } from '../../lib/utils'

const empty = { name: '', slug: '', parent_id: '', image_url: '', is_active: true, show_on_home: false, home_sort_order: 0 }

function hierarchy(categories) {
  const children = new Map()
  categories.filter((item) => item.parent_id).forEach((item) => children.set(item.parent_id, [...(children.get(item.parent_id) || []), item]))
  const rows = categories.filter((item) => !item.parent_id).flatMap((root) => [{ ...root, level: 0 }, ...(children.get(root.id) || []).map((child) => ({ ...child, level: 1 }))])
  const included = new Set(rows.map((item) => item.id))
  return [...rows, ...categories.filter((item) => !included.has(item.id)).map((item) => ({ ...item, level: 1 }))]
}

function ImageUpload({ value, onChange, folder = 'categories', label = 'Imagen de categoria', recommendation = 'Recomendado: 600 x 600 px.' }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const upload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true); setError('')
    try { onChange(await uploadRetailAsset(file, folder, value)) } catch (reason) { setError(reason.message) } finally { setUploading(false) }
  }
  const remove = () => { setError(''); onChange('') }
  return <div className="retail-upload-field">
    <span>{label}</span>
    {value ? <img src={value} alt="Vista previa" onError={imageFallback} /> : <div className="retail-upload-placeholder"><ImagePlus size={26} /><span>Sin imagen</span></div>}
    <input ref={inputRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={upload} />
    <div><button className="secondary-button" type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>{uploading ? 'Subiendo...' : value ? 'Reemplazar' : 'Seleccionar archivo'}</button>{value && <button className="secondary-button danger-action" type="button" disabled={uploading} onClick={remove}>Quitar</button>}</div>
    <small>JPG, PNG o WEBP. Maximo 5 MB. {recommendation}</small>
    {error && <small className="field-error">{error}</small>}
  </div>
}

function ProductPicker({ category, open, onClose, onSaved }) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(0)
  const [result, setResult] = useState({ rows: [], total: 0, assignedTotal: 0 })
  const [changes, setChanges] = useState(new Map())
  const [originalAssignments, setOriginalAssignments] = useState(new Map())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pageSize = 50
  useEffect(() => { if (open) { setChanges(new Map()); setOriginalAssignments(new Map()); setQuery(''); setPage(0) } }, [category?.id, open])
  useEffect(() => { const timer = setTimeout(() => { setDebounced(query); setPage(0) }, 300); return () => clearTimeout(timer) }, [query])
  useEffect(() => {
    if (!open || !category) return
    let active = true
    setLoading(true); setError('')
    searchProductsForCategory(category.id, { search: debounced, limit: pageSize, offset: page * pageSize })
      .then((data) => { if (!active) return; setResult(data); setOriginalAssignments((current) => { const next = new Map(current); data.rows.forEach((row) => { if (!next.has(row.id)) next.set(row.id, row.is_assigned) }); return next }) })
      .catch((reason) => active && setError(reason.message)).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [category, debounced, open, page])
  if (!open) return null
  const visibleIds = result.rows.map((row) => row.id)
  const isChecked = (row) => changes.has(row.id) ? changes.get(row.id) : row.is_assigned
  const visibleSelected = result.rows.filter(isChecked).length
  const toggleOne = (row) => setChanges((current) => { const next = new Map(current); next.set(row.id, !isChecked(row)); return next })
  const toggleAll = () => {
    const nextValue = !result.rows.every(isChecked)
    setChanges((current) => { const next = new Map(current); result.rows.forEach((row) => next.set(row.id, nextValue)); return next })
  }
  const selectedTotal = Math.max(0, result.assignedTotal + [...changes].reduce((total, [id, checked]) => total + (checked === originalAssignments.get(id) ? 0 : checked ? 1 : -1), 0))
  const save = async () => {
    setSaving(true); setError('')
    try {
      const add = [...changes].filter(([, checked]) => checked).map(([id]) => id)
      const remove = [...changes].filter(([, checked]) => !checked).map(([id]) => id)
      await Promise.all([bulkAddCategoryProducts(category.id, add), bulkRemoveCategoryProducts(category.id, remove)])
      await onSaved(); onClose()
    } catch (reason) { setError(reason.message) } finally { setSaving(false) }
  }
  return <div className="ax-modal-backdrop" role="presentation"><section className="retail-product-picker" role="dialog" aria-modal="true" aria-label={`Agregar productos a ${category.name}`}>
    <header><div><small>Categoria</small><h2>Agregar productos a "{category.name}"</h2></div><button type="button" onClick={onClose} aria-label="Cerrar"><X size={21} /></button></header>
    <label className="retail-picker-search"><Search size={17} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, codigo, marca o modelo" /></label>
    {error && <div className="error-box">{error}</div>}
    <div className="retail-picker-toolbar"><label><input type="checkbox" checked={visibleIds.length > 0 && result.rows.every(isChecked)} onChange={toggleAll} /> Seleccionar todos los visibles</label><strong>{selectedTotal} productos seleccionados <small>({visibleSelected} visibles)</small></strong></div>
    <div className="retail-picker-table-wrap"><table><thead><tr><th></th><th>Imagen</th><th>Producto</th><th>Codigo</th><th>Precio retail</th><th>Estado</th></tr></thead><tbody>
      {loading ? <tr><td colSpan="6">Buscando productos...</td></tr> : result.rows.map((product) => <tr key={product.id} className={isChecked(product) ? 'is-selected' : ''}>
        <td><input type="checkbox" checked={isChecked(product)} onChange={() => toggleOne(product)} aria-label={`Seleccionar ${product.name}`} /></td>
        <td><img src={getDisplayImageUrl(product.main_image_url, { width: 96, height: 96, resize: 'contain' })} alt="" onError={imageFallback} /></td>
        <td><strong>{product.name}</strong><small>{[product.brand, product.model].filter(Boolean).join(' / ')}</small></td><td>{product.sku || '-'}</td><td>{formatGs(product.retail_price)}</td><td>{product.is_assigned ? <AdminStatusBadge tone="success">Ya agregado</AdminStatusBadge> : product.publish_to_retail ? 'Publicado' : 'No publicado'}</td>
      </tr>)}
      {!loading && !result.rows.length && <tr><td colSpan="6">No se encontraron productos.</td></tr>}
    </tbody></table></div>
    <div className="retail-picker-pagination"><button type="button" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>Anterior</button><span>{result.total ? `${page * pageSize + 1}-${Math.min((page + 1) * pageSize, result.total)} de ${result.total}` : '0 productos'}</span><button type="button" disabled={(page + 1) * pageSize >= result.total || loading} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div>
    <footer><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" type="button" disabled={saving} onClick={save}>{saving ? 'Guardando...' : 'Guardar seleccion'}</button></footer>
  </section></div>
}

export function RetailCategoriesAdmin() {
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(empty)
  const [open, setOpen] = useState(false)
  const [slugEdited, setSlugEdited] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [categoryProducts, setCategoryProducts] = useState([])
  const [selectedProducts, setSelectedProducts] = useState(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const rows = useMemo(() => hierarchy(categories), [categories])
  const parentById = useMemo(() => new Map(categories.map((item) => [item.id, item])), [categories])
  const parents = useMemo(() => categories.filter((item) => !item.parent_id && item.id !== form.id), [categories, form.id])

  const load = async () => { setLoading(true); try { setCategories(await getAdminRetailCategories()) } catch (reason) { setError(reason.message) } finally { setLoading(false) } }
  const loadProducts = async (category = selectedCategory) => {
    if (!category) return
    const products = await getCategoryProducts(category.id)
    setCategoryProducts(products); setSelectedProducts(new Set())
  }
  useEffect(() => { load() }, [])

  const openForm = (category = null) => { setError(''); setSlugEdited(Boolean(category)); setForm(category ? { ...empty, ...category, parent_id: category.parent_id || '', image_url: category.image_url || '' } : { ...empty }); setOpen(true) }
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('')
    try { const previousImage = form.id ? categories.find((item) => item.id === form.id)?.image_url : ''; const saved = await saveRetailCategory(form); if (previousImage && previousImage !== saved.image_url) await removeRetailAsset(previousImage, 'categories'); setOpen(false); await load(); setSuccess(form.id ? 'Categoria actualizada correctamente.' : 'Categoria creada correctamente.'); if (selectedCategory?.id === saved.id) setSelectedCategory(saved) } catch (reason) { setError(reason.message) } finally { setSaving(false) }
  }
  const manage = async (category) => { setSelectedCategory(category); setError(''); try { await loadProducts(category) } catch (reason) { setError(reason.message) } }
  const toggleActive = async (category) => { setBusyId(category.id); try { await setRetailCategoryActive(category.id, !category.is_active); await load(); setSuccess(category.is_active ? 'Categoria desactivada.' : 'Categoria activada.') } catch (reason) { setError(reason.message) } finally { setBusyId('') } }
  const remove = async (category) => {
    if (category.child_count) { setError('Esta categoria tiene subcategorias. Reasignalas antes de eliminarla.'); return }
    const warning = category.product_count ? `Se quitaran ${category.product_count} relaciones de esta categoria, pero ningun producto sera eliminado.` : 'Esta accion no se puede deshacer.'
    if (!window.confirm(`Eliminar "${category.name}"?\n\n${warning}`)) return
    setBusyId(category.id); try { await deleteRetailCategory(category.id); await removeRetailAsset(category.image_url, 'categories'); if (selectedCategory?.id === category.id) setSelectedCategory(null); await load(); setSuccess('Categoria eliminada sin eliminar productos.') } catch (reason) { setError(reason.message) } finally { setBusyId('') }
  }
  const removeProducts = async (ids) => {
    if (!ids.length || !window.confirm(`Quitar ${ids.length} producto${ids.length === 1 ? '' : 's'} solamente de esta categoria?`)) return
    setSaving(true); try { await bulkRemoveCategoryProducts(selectedCategory.id, ids); await Promise.all([loadProducts(), load()]); setSuccess('Productos quitados de la categoria.') } catch (reason) { setError(reason.message) } finally { setSaving(false) }
  }
  const move = (index, direction) => setCategoryProducts((current) => { const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next.map((row, order) => ({ ...row, sort_order: order })) })
  const saveOrder = async () => { setSaving(true); try { await updateCategoryProductOrder(selectedCategory.id, categoryProducts); await loadProducts(); setSuccess('Orden guardado correctamente.') } catch (reason) { setError(reason.message) } finally { setSaving(false) } }

  return <div className="admin-page ax-page retail-categories-admin">
    <AdminPageHeader title="Categorias de la tienda" description="Categorias y colecciones comerciales administradas manualmente." actions={<button className="primary-button" type="button" onClick={() => openForm()}><Plus size={17} /> Nueva categoria</button>} />
    {success && <div className="toast" role="status">{success}</div>}{error && <div className="error-box" role="alert">{error}</div>}
    {loading ? <div className="ds-skeleton-card"><span /><strong /><p /></div> : !categories.length ? <section className="retail-category-empty"><strong>Todavia no hay categorias retail.</strong><p>Crea la primera categoria o coleccion comercial.</p><button className="primary-button" type="button" onClick={() => openForm()}><Plus size={17} /> Crear primera categoria</button></section> : <div className="retail-category-table-wrap"><table className="retail-category-table"><thead><tr><th>Nombre</th><th>Tipo</th><th>Padre</th><th>Productos</th><th>Activa</th><th>Home</th><th>Orden</th><th>Acciones</th></tr></thead><tbody>{rows.map((category) => <tr key={category.id} className={category.level ? 'is-child' : ''}><td><div className="retail-category-name">{category.level > 0 && <span aria-hidden="true">└</span>}<div><strong>{category.name}</strong><small>/{category.slug}</small></div></div></td><td>{category.parent_id ? 'Subcategoria' : 'Principal'}</td><td>{category.parent_id ? parentById.get(category.parent_id)?.name || '-' : '-'}</td><td>{category.product_count}</td><td><AdminStatusBadge tone={category.is_active ? 'success' : 'neutral'}>{category.is_active ? 'Si' : 'No'}</AdminStatusBadge></td><td>{category.show_on_home ? 'Si' : 'No'}</td><td>{category.home_sort_order}</td><td><div className="retail-category-actions"><button className="secondary-button" type="button" onClick={() => manage(category)}><PackagePlus size={15} /> Productos</button><button className="secondary-button" type="button" onClick={() => openForm(category)}><Edit3 size={15} /> Editar</button><button className="secondary-button" disabled={busyId === category.id} type="button" onClick={() => toggleActive(category)}><Power size={15} /> {category.is_active ? 'Desactivar' : 'Activar'}</button><button className="secondary-button danger-action" disabled={busyId === category.id || category.child_count > 0} type="button" onClick={() => remove(category)}><Trash2 size={15} /> Eliminar</button></div></td></tr>)}</tbody></table></div>}

    {selectedCategory && <section className="retail-category-products"><header><div><small>Gestion comercial</small><h2>{selectedCategory.name}</h2><p>{categoryProducts.length} productos. El orden es independiente para esta categoria.</p></div><div><button className="secondary-button" type="button" onClick={() => setSelectedCategory(null)}><X size={16} /> Cerrar</button><button className="primary-button" type="button" onClick={() => setPickerOpen(true)}><PackagePlus size={17} /> Agregar productos</button></div></header>
      {!!selectedProducts.size && <div className="retail-products-bulk"><strong>{selectedProducts.size} seleccionados</strong><button className="secondary-button danger-action" type="button" onClick={() => removeProducts([...selectedProducts])}>Quitar seleccionados</button></div>}
      {categoryProducts.length ? <div className="retail-category-product-list">{categoryProducts.map((product, index) => <article key={product.product_id}><input type="checkbox" checked={selectedProducts.has(product.product_id)} onChange={() => setSelectedProducts((current) => { const next = new Set(current); next.has(product.product_id) ? next.delete(product.product_id) : next.add(product.product_id); return next })} aria-label={`Seleccionar ${product.name}`} /><img src={getDisplayImageUrl(product.main_image_url, { width: 100, height: 100, resize: 'contain' })} alt="" onError={imageFallback} /><div><strong>{product.name}</strong><small>{product.sku || 'Sin codigo'} · {formatGs(product.retail_price)}</small></div><span>Orden {index + 1}</span><div><button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Subir"><ArrowUp size={16} /></button><button type="button" disabled={index === categoryProducts.length - 1} onClick={() => move(index, 1)} aria-label="Bajar"><ArrowDown size={16} /></button><button type="button" onClick={() => removeProducts([product.product_id])} aria-label="Quitar"><Trash2 size={16} /></button></div></article>)}</div> : <div className="retail-category-empty compact"><strong>Esta categoria todavia no tiene productos.</strong><button className="primary-button" type="button" onClick={() => setPickerOpen(true)}><Plus size={16} /> Agregar productos</button></div>}
      {!!categoryProducts.length && <footer><button className="primary-button" disabled={saving} type="button" onClick={saveOrder}><Save size={16} /> {saving ? 'Guardando...' : 'Guardar orden'}</button></footer>}
    </section>}

    {open && <div className="ax-modal-backdrop"><form className="ax-status-modal retail-category-modal" role="dialog" aria-modal="true" onSubmit={submit}><header><h2>{form.id ? 'Editar categoria' : 'Nueva categoria'}</h2><button type="button" onClick={() => setOpen(false)}><X size={20} /></button></header><div className="form-grid"><label>Nombre *<input autoFocus required maxLength="100" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value, slug: slugEdited ? value.slug : slugify(event.target.value) }))} /></label><label>Slug *<input required maxLength="120" value={form.slug} onChange={(event) => { setSlugEdited(true); setForm((value) => ({ ...value, slug: slugify(event.target.value) })) }} /><small>Unico; se utiliza en la URL publica.</small></label><label>Categoria padre<select value={form.parent_id} onChange={(event) => setForm((value) => ({ ...value, parent_id: event.target.value }))}><option value="">Ninguna / Categoria principal</option>{parents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Orden en Home<input type="number" step="1" value={form.home_sort_order} onChange={(event) => setForm((value) => ({ ...value, home_sort_order: event.target.value }))} /></label><label className="checkbox-label"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((value) => ({ ...value, is_active: event.target.checked }))} /> Activa</label><label className="checkbox-label"><input type="checkbox" checked={form.show_on_home} onChange={(event) => setForm((value) => ({ ...value, show_on_home: event.target.checked }))} /> Mostrar en Home</label><ImageUpload value={form.image_url} onChange={(image_url) => setForm((value) => ({ ...value, image_url }))} /></div><div className="ax-modal-actions"><button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" disabled={saving} type="submit">{saving ? 'Guardando...' : 'Guardar categoria'}</button></div></form></div>}
    <ProductPicker category={selectedCategory} open={pickerOpen} onClose={() => setPickerOpen(false)} onSaved={async () => { await Promise.all([loadProducts(), load()]); setSuccess('Asignacion actualizada correctamente.') }} />
  </div>
}
