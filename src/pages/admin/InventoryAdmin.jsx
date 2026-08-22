import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Edit3, Eye, EyeOff, History, MoreHorizontal, Package, Plus, Save, Search, SlidersHorizontal, X } from 'lucide-react'
import { AdminMetric, AdminModal, AdminPageHeader, AdminStatusBadge, Drawer, FilterToolbar, MoneyCell } from '../../components/AdminUX'
import {
  bulkUpdateInventoryProducts,
  createInventoryMovement,
  getInventoryLocations,
  getInventoryProducts,
  getSuppliers,
  inventoryStatus,
  inventoryStatusLabel,
  saveSupplier
} from '../../lib/adminInventoryApi'
import { formatGs, imageFallback } from '../../lib/utils'

const pageSize = 50
const emptyMovement = { product_id: '', movement_type: 'manual_entry', quantity: '', reason: 'Entrada de mercaderia', notes: '' }
const emptySupplierForm = { name: '', contact_name: '', phone: '', email: '', city: '' }

function movementSign(type) {
  return ['manual_entry', 'adjustment_in'].includes(type) ? 1 : -1
}

function statusTone(status) {
  if (status === 'available') return 'success'
  if (status === 'low') return 'warning'
  if (status === 'out') return 'danger'
  return 'neutral'
}

function stockNumbers(product = {}) {
  const physical = Number(product.stock_quantity || 0)
  const reserved = Number(product.reserved_stock_quantity || 0)
  const available = Number(product.available_stock_quantity ?? (physical - reserved))
  return { physical, reserved, available }
}

function supplierLabel(supplier) {
  if (!supplier) return ''
  return supplier.contact_name ? `${supplier.name} - ${supplier.contact_name}` : supplier.name
}

function draftFromProduct(product) {
  return {
    product_id: product.id,
    sku: product.admin_details?.sku || '',
    supplier_id: product.admin_details?.supplier_id || null,
    supplier_query: supplierLabel(product.supplier),
    target_stock: String(Number(product.stock_quantity || 0)),
    inventory_hidden: Boolean(product.admin_details?.inventory_hidden)
  }
}

function isDraftChanged(product, draft) {
  if (!draft) return false
  return String(draft.sku || '').trim() !== String(product.admin_details?.sku || '').trim() ||
    (draft.supplier_id || null) !== (product.admin_details?.supplier_id || null) ||
    Number(draft.target_stock) !== Number(product.stock_quantity || 0) ||
    Boolean(draft.inventory_hidden) !== Boolean(product.admin_details?.inventory_hidden)
}

export function InventoryAdmin() {
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [locations, setLocations] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [supplierId, setSupplierId] = useState('all')
  const [sort, setSort] = useState('name_asc')
  const [page, setPage] = useState(1)
  const [quickEdit, setQuickEdit] = useState(false)
  const [drafts, setDrafts] = useState({})
  const [rowErrors, setRowErrors] = useState({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [movementForm, setMovementForm] = useState(emptyMovement)
  const [quickViewProduct, setQuickViewProduct] = useState(null)
  const [supplierModalProductId, setSupplierModalProductId] = useState(null)
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const supplierOptions = useMemo(() => suppliers.filter((supplier) => supplier.is_active !== false), [suppliers])
  const supplierMap = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers])

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const [productRows, supplierRows, locationRows] = await Promise.all([
        getInventoryProducts(),
        getSuppliers({ includeInactive: true }),
        getInventoryLocations()
      ])
      setProducts(productRows)
      setSuppliers(supplierRows)
      setLocations(locationRows)
    } catch (err) {
      setError(err.message || 'No se pudo cargar el inventario.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [search, status, supplierId, sort])

  const counts = useMemo(() => products.reduce((acc, product) => {
    const details = product.admin_details || {}
    const hidden = Boolean(details.inventory_hidden)
    const productStatus = inventoryStatus(product)
    const { physical, reserved, available } = stockNumbers(product)
    acc.all += hidden ? 0 : 1
    acc.hidden += hidden ? 1 : 0
    acc.units += physical
    acc.reserved += reserved
    acc.available += available
    acc.value += physical * Number(product.cost_price || 0)
    if (!hidden && available > 0) acc.with_stock += 1
    if (!hidden && available <= 0) acc.out += 1
    if (!hidden && productStatus === 'low') acc.low += 1
    if (!hidden && (!details.sku || !details.supplier_id)) acc.incomplete += 1
    return acc
  }, { all: 0, with_stock: 0, out: 0, low: 0, hidden: 0, incomplete: 0, units: 0, reserved: 0, available: 0, value: 0 }), [products])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return [...products].filter((product) => {
      const details = product.admin_details || {}
      const hidden = Boolean(details.inventory_hidden)
      const productStatus = inventoryStatus(product)
      const { available } = stockNumbers(product)
      const supplier = product.supplier || supplierMap.get(details.supplier_id)
      const haystack = [
        details.sku,
        product.name,
        product.brand,
        product.model,
        supplier?.name,
        supplier?.contact_name
      ].join(' ').toLowerCase()
      const statusMatch =
        status === 'hidden' ? hidden :
          status === 'with_stock' ? !hidden && available > 0 :
            status === 'out' ? !hidden && available <= 0 :
              status === 'low' ? !hidden && productStatus === 'low' :
                status === 'incomplete' ? !hidden && (!details.sku || !details.supplier_id) :
                  !hidden
      return (!term || haystack.includes(term)) &&
        statusMatch &&
        (supplierId === 'all' || details.supplier_id === supplierId)
    }).sort((a, b) => {
      const aStock = stockNumbers(a).available
      const bStock = stockNumbers(b).available
      if (status === 'incomplete' && aStock !== bStock) return bStock - aStock
      if (sort === 'stock_desc') return bStock - aStock
      if (sort === 'stock_asc') return aStock - bStock
      if (sort === 'value_desc') return Number(b.stock_quantity || 0) * Number(b.cost_price || 0) - Number(a.stock_quantity || 0) * Number(a.cost_price || 0)
      return String(a.name || '').localeCompare(String(b.name || ''))
    })
  }, [products, search, status, supplierId, sort, supplierMap])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pendingProducts = useMemo(() => products.filter((product) => isDraftChanged(product, drafts[product.id])), [products, drafts])

  const startQuickEdit = () => {
    const nextDrafts = {}
    products.forEach((product) => { nextDrafts[product.id] = drafts[product.id] || draftFromProduct(product) })
    setDrafts(nextDrafts)
    setRowErrors({})
    setMessage('')
    setError('')
    setQuickEdit(true)
  }

  const cancelQuickEdit = () => {
    setQuickEdit(false)
    setDrafts({})
    setRowErrors({})
    setMessage('')
  }

  const updateDraft = (productId, patch) => {
    const product = products.find((item) => item.id === productId)
    if (!product) return
    setDrafts((prev) => ({ ...prev, [productId]: { ...(prev[productId] || draftFromProduct(product)), ...patch } }))
    setRowErrors((prev) => {
      if (!prev[productId]) return prev
      const next = { ...prev }
      delete next[productId]
      return next
    })
  }

  const resolveSupplierQuery = (query) => {
    const clean = String(query || '').trim()
    if (!clean) return { supplier_id: null, supplier_query: '' }
    const match = supplierOptions.find((supplier) => supplierLabel(supplier).toLowerCase() === clean.toLowerCase() || supplier.name.toLowerCase() === clean.toLowerCase())
    return { supplier_id: match?.id || '', supplier_query: clean }
  }

  const validateDrafts = (items = pendingProducts) => {
    const nextErrors = {}
    const skuOwner = new Map()
    products.forEach((product) => {
      const draft = drafts[product.id] || draftFromProduct(product)
      const sku = String(draft.sku || '').trim().toLowerCase()
      if (sku) {
        if (skuOwner.has(sku) && skuOwner.get(sku) !== product.id) {
          nextErrors[product.id] = 'Codigo duplicado en esta carga.'
          nextErrors[skuOwner.get(sku)] = 'Codigo duplicado en esta carga.'
        }
        skuOwner.set(sku, product.id)
      }
    })
    items.forEach((product) => {
      const draft = drafts[product.id] || draftFromProduct(product)
      const targetStock = Number(draft.target_stock)
      const { reserved } = stockNumbers(product)
      if (!Number.isFinite(targetStock) || !Number.isInteger(targetStock) || targetStock < 0) {
        nextErrors[product.id] = 'Stock fisico invalido.'
      } else if (targetStock < reserved) {
        nextErrors[product.id] = `No podes dejar el stock fisico en ${targetStock} porque existen ${reserved} unidades reservadas.`
      } else if (draft.supplier_query && !draft.supplier_id) {
        nextErrors[product.id] = 'Proveedor invalido. Elegi uno de la lista o dejalo vacio.'
      } else if (product.admin_details?.track_inventory === false && targetStock !== Number(product.stock_quantity || 0)) {
        nextErrors[product.id] = 'Este producto no tiene control de inventario.'
      }
    })
    setRowErrors(nextErrors)
    return nextErrors
  }

  const mergeInventoryUpdates = (rows) => {
    const updates = new Map((rows || []).map((row) => [row.product_id, row]))
    setProducts((prev) => prev.map((product) => {
      const update = updates.get(product.id)
      if (!update) return product
      const physical = Number(update.stock_after ?? product.stock_quantity ?? 0)
      const reserved = Number(product.reserved_stock_quantity || 0)
      const supplier = update.supplier_id ? supplierMap.get(update.supplier_id) || null : null
      return {
        ...product,
        stock_quantity: physical,
        available_stock_quantity: physical - reserved,
        admin_details: {
          ...product.admin_details,
          sku: update.sku || '',
          supplier_id: update.supplier_id || null,
          inventory_hidden: Boolean(update.inventory_hidden)
        },
        supplier
      }
    }))
  }

  const saveQuickChanges = async () => {
    if (!pendingProducts.length) return
    const validation = validateDrafts()
    if (Object.keys(validation).length) {
      setError('Corregi las filas marcadas antes de guardar.')
      return
    }
    try {
      setSaving(true)
      setError('')
      setMessage('')
      const payload = pendingProducts.map((product) => {
        const draft = drafts[product.id]
        return {
          product_id: product.id,
          sku: draft.sku,
          supplier_id: draft.supplier_id || null,
          target_stock: Number(draft.target_stock),
          inventory_hidden: Boolean(draft.inventory_hidden)
        }
      })
      const rows = await bulkUpdateInventoryProducts(payload)
      mergeInventoryUpdates(rows)
      setMessage(`${rows.length} productos actualizados correctamente.`)
      setQuickEdit(false)
      setDrafts({})
      setRowErrors({})
    } catch (err) {
      setError(err.message || 'No se pudieron guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  const openMovement = (product, type = 'manual_entry') => {
    setMovementForm({ ...emptyMovement, product_id: product.id, movement_type: type })
    setMessage('')
    setError('')
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    if (saving) return
    setDrawerOpen(false)
    setMovementForm(emptyMovement)
  }

  const selectedProduct = products.find((product) => product.id === movementForm.product_id)
  const movementQuantity = Number(movementForm.quantity || 0)
  const movementQuantityIsInteger = Number.isInteger(movementQuantity)
  const movementDelta = movementQuantity > 0 ? movementQuantity * movementSign(movementForm.movement_type) : 0
  const selectedStock = stockNumbers(selectedProduct || {})
  const nextStock = selectedStock.physical + movementDelta
  const nextAvailable = nextStock - selectedStock.reserved
  const movementBlocked = !selectedProduct ||
    selectedProduct.admin_details?.track_inventory === false ||
    movementQuantity <= 0 ||
    !movementQuantityIsInteger ||
    !movementForm.reason.trim() ||
    nextStock < 0 ||
    nextAvailable < 0

  const submitMovement = async (event) => {
    event.preventDefault()
    if (movementBlocked) return
    try {
      setSaving(true)
      setError('')
      setMessage('')
      const movement = await createInventoryMovement({
        ...movementForm,
        quantity: movementQuantity,
        location_id: locations[0]?.id || null,
        unit_cost_snapshot: selectedProduct?.cost_price || null
      })
      const physical = Number(movement?.stock_after ?? nextStock)
      const reserved = selectedStock.reserved
      setProducts((prev) => prev.map((product) => product.id === selectedProduct.id
        ? { ...product, stock_quantity: physical, available_stock_quantity: physical - reserved }
        : product))
      setMessage('Movimiento registrado correctamente.')
      setDrawerOpen(false)
      setMovementForm(emptyMovement)
    } catch (err) {
      setError(err.message || 'No se pudo registrar el movimiento.')
    } finally {
      setSaving(false)
    }
  }

  const toggleInventoryHidden = async (product, hidden) => {
    const draft = drafts[product.id] || draftFromProduct(product)
    try {
      setSaving(true)
      setError('')
      const rows = await bulkUpdateInventoryProducts([{
        product_id: product.id,
        sku: draft.sku,
        supplier_id: draft.supplier_id || null,
        target_stock: Number(draft.target_stock),
        inventory_hidden: hidden
      }])
      mergeInventoryUpdates(rows)
      setMessage(hidden ? 'Producto ocultado del inventario.' : 'Producto visible en inventario.')
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la visibilidad.')
    } finally {
      setSaving(false)
    }
  }

  const createSupplierInline = async (event) => {
    event.preventDefault()
    try {
      setSaving(true)
      const supplier = await saveSupplier(supplierForm)
      setSuppliers((prev) => [supplier, ...prev.filter((item) => item.id !== supplier.id)])
      if (supplierModalProductId) {
        updateDraft(supplierModalProductId, { supplier_id: supplier.id, supplier_query: supplierLabel(supplier) })
      }
      setSupplierForm(emptySupplierForm)
      setSupplierModalProductId(null)
      setMessage('Proveedor creado correctamente.')
    } catch (err) {
      setError(err.message || 'No se pudo crear el proveedor.')
    } finally {
      setSaving(false)
    }
  }

  const renderProductCell = (product) => (
    <button className="inventory-product-cell" type="button" onClick={() => setQuickViewProduct(product)}>
      <img src={product.main_image_url || '/placeholder.svg'} alt={product.name} width="64" height="64" loading="lazy" decoding="async" onError={imageFallback} />
      <span>
        <strong>{product.name}</strong>
        <em>{[product.brand, product.model].filter(Boolean).join(' ') || 'Sin marca/modelo'}</em>
      </span>
    </button>
  )

  const renderSupplierEditor = (product) => {
    const draft = drafts[product.id] || draftFromProduct(product)
    return (
      <div className="inventory-supplier-editor">
        <input
          className="inventory-inline-input"
          list="inventory-supplier-options"
          value={draft.supplier_query || ''}
          placeholder="Sin proveedor"
          onChange={(event) => updateDraft(product.id, resolveSupplierQuery(event.target.value))}
        />
        <div>
          <button type="button" onClick={() => updateDraft(product.id, { supplier_id: null, supplier_query: '' })}>Sin proveedor</button>
          <button type="button" onClick={() => setSupplierModalProductId(product.id)}>+ Nuevo</button>
        </div>
      </div>
    )
  }

  const statusFilters = [
    ['all', `Todos (${counts.all})`],
    ['with_stock', `Con stock (${counts.with_stock})`],
    ['out', `Sin stock (${counts.out})`],
    ['low', `Stock bajo (${counts.low})`],
    ['incomplete', `Datos incompletos (${counts.incomplete})`],
    ['hidden', `Ocultos (${counts.hidden})`]
  ]

  return (
    <div className="admin-page ax-page ax-inventory-page">
      <AdminPageHeader
        eyebrow="Catalogo"
        title="Inventario"
        description="Carga rapida de stock, codigos y proveedores."
        actions={quickEdit ? (
          <>
            <button className="secondary-button" type="button" onClick={cancelQuickEdit} disabled={saving}><X size={16} /> Cancelar edicion</button>
            <button className="primary-button" type="button" onClick={saveQuickChanges} disabled={saving || !pendingProducts.length}><Save size={16} /> {saving ? 'Guardando...' : 'Guardar cambios'}</button>
          </>
        ) : (
          <>
            <button className="secondary-button" type="button" onClick={startQuickEdit}><Edit3 size={16} /> Editar inventario</button>
            <button className="primary-button" type="button" onClick={() => setDrawerOpen(true)}><Package size={16} /> Registrar movimiento</button>
          </>
        )}
      />
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <div className="inventory-kpis">
        <AdminMetric label="Productos" value={counts.all} />
        <AdminMetric label="Fisico" value={counts.units} />
        <AdminMetric label="Reservado" value={counts.reserved} />
        <AdminMetric label="Disponible" value={counts.available} />
        <AdminMetric label="Stock bajo" value={counts.low} />
        <AdminMetric label="Agotados" value={counts.out} />
        <AdminMetric label="Valor inventario" value={formatGs(counts.value)} featured />
      </div>

      <FilterToolbar>
        <label className="ax-search-field"><Search size={15} /><input placeholder="Buscar codigo, nombre, marca, modelo o proveedor" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="ax-quick-filters inventory-tabs">
          {statusFilters.map(([key, label]) => <button className={status === key ? 'active' : ''} type="button" key={key} onClick={() => setStatus(key)}>{label}</button>)}
        </div>
        <label>Proveedor
          <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="all">Todos</option>
            {supplierOptions.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </label>
        <label>Orden
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="name_asc">Nombre</option>
            <option value="stock_asc">Stock ascendente</option>
            <option value="stock_desc">Stock descendente</option>
            <option value="value_desc">Mayor valor</option>
          </select>
        </label>
      </FilterToolbar>

      {quickEdit && (
        <div className="inventory-edit-bar">
          <strong>{pendingProducts.length} cambios pendientes</strong>
          <span>Edita codigo, proveedor y stock fisico de muchos productos. Guardas una sola vez.</span>
          <button className="secondary-button" type="button" onClick={cancelQuickEdit} disabled={saving}>Cancelar</button>
          <button className="primary-button" type="button" onClick={saveQuickChanges} disabled={saving || !pendingProducts.length}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      )}

      <datalist id="inventory-supplier-options">
        {supplierOptions.map((supplier) => <option key={supplier.id} value={supplierLabel(supplier)} />)}
      </datalist>

      <div className="inventory-table-shell">
        {loading && <div className="ax-table-loading">Cargando...</div>}
        {!loading && !visibleRows.length && <div className="ax-empty">No hay productos para mostrar.</div>}
        {!loading && !!visibleRows.length && (
          <table className="inventory-table">
            <colgroup>
              <col className="col-product" />
              <col className="col-code" />
              <col className="col-supplier" />
              <col className="col-money" />
              <col className="col-stock" />
              <col className="col-stock" />
              <col className="col-stock" />
              <col className="col-status" />
              <col className="col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Codigo</th>
                <th>Proveedor</th>
                <th className="right">Costo</th>
                <th className="right">Fisico</th>
                <th className="right">Reservado</th>
                <th className="right">Disponible</th>
                <th>Estado</th>
                <th className="sticky-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((product) => {
                const details = product.admin_details || {}
                const currentStatus = inventoryStatus(product)
                const { physical, reserved, available } = stockNumbers(product)
                const draft = drafts[product.id] || draftFromProduct(product)
                const rowChanged = isDraftChanged(product, draft)
                const rowError = rowErrors[product.id]
                return (
                  <tr key={product.id} className={`${rowChanged ? 'is-edited' : ''} ${rowError ? 'has-error' : ''}`}>
                    <td>{renderProductCell(product)}{rowError && <small className="inventory-row-error">{rowError}</small>}</td>
                    <td>{quickEdit ? <input className="inventory-inline-input" value={draft.sku || ''} placeholder="Codigo" onChange={(event) => updateDraft(product.id, { sku: event.target.value })} /> : (details.sku || <span className="inventory-muted">Sin codigo</span>)}</td>
                    <td>{quickEdit ? renderSupplierEditor(product) : (product.supplier?.name || <span className="inventory-muted">Sin proveedor</span>)}</td>
                    <td className="right"><MoneyCell value={product.cost_price} /></td>
                    <td className="right">{quickEdit ? <input className="inventory-stock-input" type="number" min="0" step="1" value={draft.target_stock} onChange={(event) => updateDraft(product.id, { target_stock: event.target.value })} /> : physical}</td>
                    <td className="right">{reserved}</td>
                    <td className="right">{available}</td>
                    <td><AdminStatusBadge tone={statusTone(currentStatus)}>{inventoryStatusLabel(currentStatus)}</AdminStatusBadge>{details.inventory_hidden && <AdminStatusBadge>Oculto</AdminStatusBadge>}</td>
                    <td className="sticky-actions">
                      {quickEdit ? (
                        <label className="inventory-hide-toggle">
                          <input type="checkbox" checked={Boolean(draft.inventory_hidden)} onChange={(event) => updateDraft(product.id, { inventory_hidden: event.target.checked })} />
                          Oculto
                        </label>
                      ) : (
                        <div className="inventory-actions">
                          <button type="button" disabled={details.track_inventory === false} onClick={() => openMovement(product, 'manual_entry')}><Plus size={14} /> Entrada</button>
                          <details>
                            <summary><MoreHorizontal size={16} /></summary>
                            <div>
                              <button type="button" disabled={details.track_inventory === false} onClick={() => openMovement(product, 'adjustment_in')}><SlidersHorizontal size={14} /> Ajustar stock</button>
                              <button type="button" onClick={() => setQuickViewProduct(product)}><Eye size={14} /> Vista rapida</button>
                              <Link to={`/admin/inventario/${product.id}`}><History size={14} /> Historial</Link>
                              <Link to={`/admin/productos/${product.id}/editar`}>Editar producto</Link>
                              {details.inventory_hidden
                                ? <button type="button" onClick={() => toggleInventoryHidden(product, false)}><Eye size={14} /> Mostrar en inventario</button>
                                : <button type="button" onClick={() => toggleInventoryHidden(product, true)}><EyeOff size={14} /> Ocultar</button>}
                            </div>
                          </details>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="inventory-pagination">
        <span>{filtered.length} productos - Pagina {currentPage} de {pageCount}</span>
        <div>
          <button type="button" disabled={currentPage <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Anterior</button>
          <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>Siguiente</button>
        </div>
      </div>

      <Drawer open={drawerOpen} title="Registrar entrada o ajuste" onClose={closeDrawer}>
        <form className="ax-drawer-form inventory-movement-form" onSubmit={submitMovement}>
          <label>Producto
            <select value={movementForm.product_id} onChange={(event) => setMovementForm((prev) => ({ ...prev, product_id: event.target.value }))} required>
              <option value="">Seleccionar producto</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </label>
          {selectedProduct && (
            <div className="inventory-drawer-product">
              <img src={selectedProduct.main_image_url || '/placeholder.svg'} alt={selectedProduct.name} width="72" height="72" loading="lazy" decoding="async" onError={imageFallback} />
              <div>
                <strong>{selectedProduct.name}</strong>
                <span>Codigo: {selectedProduct.admin_details?.sku || 'Sin codigo'}</span>
                <span>Fisico {selectedStock.physical} - Reservado {selectedStock.reserved} - Disponible {selectedStock.available}</span>
              </div>
            </div>
          )}
          <label>Tipo
            <select value={movementForm.movement_type} onChange={(event) => setMovementForm((prev) => ({ ...prev, movement_type: event.target.value }))}>
              <option value="manual_entry">Entrada</option>
              <option value="adjustment_in">Ajuste positivo</option>
              <option value="adjustment_out">Ajuste negativo</option>
              <option value="manual_exit">Salida manual</option>
            </select>
          </label>
          <label>Cantidad que ingresa o se ajusta
            <input type="number" min="1" step="1" value={movementForm.quantity} onChange={(event) => setMovementForm((prev) => ({ ...prev, quantity: event.target.value }))} required />
          </label>
          <label>Motivo
            <input value={movementForm.reason} onChange={(event) => setMovementForm((prev) => ({ ...prev, reason: event.target.value }))} required />
          </label>
          <label>Nota opcional
            <textarea value={movementForm.notes} onChange={(event) => setMovementForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </label>
          <div className={`inventory-stock-result ${nextStock < 0 || nextAvailable < 0 ? 'danger' : ''}`}>
            <span>Fisico: <strong>{selectedStock.physical}</strong> -&gt; <strong>{selectedProduct ? nextStock : '-'}</strong></span>
            <span>Disponible: <strong>{selectedStock.available}</strong> -&gt; <strong>{selectedProduct ? nextAvailable : '-'}</strong></span>
          </div>
          {movementForm.quantity && !movementQuantityIsInteger && <div className="error-box">La cantidad debe ser un numero entero.</div>}
          {nextAvailable < 0 && <div className="error-box">No se puede bajar el stock fisico por debajo de lo reservado.</div>}
          <button className="primary-button" type="submit" disabled={saving || movementBlocked}>{saving ? 'Guardando...' : 'Registrar entrada'}</button>
        </form>
      </Drawer>

      <AdminModal open={Boolean(quickViewProduct)} title="Vista rapida" onClose={() => setQuickViewProduct(null)} size="lg" footer={<button className="secondary-button" type="button" onClick={() => setQuickViewProduct(null)}>Cerrar</button>}>
        {quickViewProduct && (
          <div className="inventory-quick-view">
            <img src={quickViewProduct.main_image_url || '/placeholder.svg'} alt={quickViewProduct.name} width="280" height="280" loading="lazy" decoding="async" onError={imageFallback} />
            <div>
              <h3>{quickViewProduct.name}</h3>
              <dl>
                <div><dt>Codigo</dt><dd>{quickViewProduct.admin_details?.sku || 'Sin codigo'}</dd></div>
                <div><dt>Proveedor</dt><dd>{quickViewProduct.supplier?.name || 'Sin proveedor'}</dd></div>
                <div><dt>Costo</dt><dd>{formatGs(quickViewProduct.cost_price)}</dd></div>
                <div><dt>Precio mayorista</dt><dd>{formatGs(quickViewProduct.wholesale_price)}</dd></div>
                <div><dt>Precio minorista</dt><dd>{quickViewProduct.admin_details?.retail_price ? formatGs(quickViewProduct.admin_details.retail_price) : '-'}</dd></div>
                <div><dt>Fisico</dt><dd>{stockNumbers(quickViewProduct).physical}</dd></div>
                <div><dt>Reservado</dt><dd>{stockNumbers(quickViewProduct).reserved}</dd></div>
                <div><dt>Disponible</dt><dd>{stockNumbers(quickViewProduct).available}</dd></div>
              </dl>
              <Link className="primary-button" to={`/admin/productos/${quickViewProduct.id}/editar`}>Editar producto</Link>
            </div>
          </div>
        )}
      </AdminModal>

      <AdminModal
        open={Boolean(supplierModalProductId)}
        title="Nuevo proveedor"
        onClose={() => setSupplierModalProductId(null)}
        footer={
          <>
            <button className="secondary-button" type="button" onClick={() => setSupplierModalProductId(null)}>Cancelar</button>
            <button className="primary-button" type="submit" form="inventory-supplier-form" disabled={saving}>{saving ? 'Guardando...' : 'Crear proveedor'}</button>
          </>
        }
      >
        <form id="inventory-supplier-form" className="ax-modal-form-grid" onSubmit={createSupplierInline}>
          <label>Nombre<input value={supplierForm.name} onChange={(event) => setSupplierForm((prev) => ({ ...prev, name: event.target.value }))} required /></label>
          <label>Contacto<input value={supplierForm.contact_name} onChange={(event) => setSupplierForm((prev) => ({ ...prev, contact_name: event.target.value }))} /></label>
          <label>Telefono<input value={supplierForm.phone} onChange={(event) => setSupplierForm((prev) => ({ ...prev, phone: event.target.value }))} /></label>
          <label>Email<input value={supplierForm.email} onChange={(event) => setSupplierForm((prev) => ({ ...prev, email: event.target.value }))} /></label>
          <label>Ciudad<input value={supplierForm.city} onChange={(event) => setSupplierForm((prev) => ({ ...prev, city: event.target.value }))} /></label>
        </form>
      </AdminModal>
    </div>
  )
}
