import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { History, Minus, Package, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { AdminDataTable, AdminMetric, AdminPageHeader, AdminStatusBadge, Drawer, FilterToolbar, MoneyCell, RowActions } from '../../components/AdminUX'
import {
  createInventoryMovement,
  getInventoryLocations,
  getInventoryProducts,
  getSuppliers,
  inventoryStatus,
  inventoryStatusLabel,
  movementTypeLabel
} from '../../lib/adminInventoryApi'
import { formatGs, imageFallback } from '../../lib/utils'

const movementOptions = [
  ['manual_entry', 'Entrada manual'],
  ['manual_exit', 'Salida manual'],
  ['adjustment_in', 'Ajuste positivo'],
  ['adjustment_out', 'Ajuste negativo'],
  ['damaged', 'Producto averiado'],
  ['lost', 'Producto perdido']
]

function movementSign(type) {
  return ['manual_entry', 'adjustment_in'].includes(type) ? 1 : -1
}

function statusTone(status) {
  if (status === 'available') return 'success'
  if (status === 'low') return 'warning'
  if (status === 'out') return 'danger'
  return 'neutral'
}

const emptyMovement = {
  product_id: '',
  movement_type: 'manual_entry',
  quantity: '',
  reason: '',
  notes: ''
}

export function InventoryAdmin() {
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [locations, setLocations] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [supplierId, setSupplierId] = useState('all')
  const [sort, setSort] = useState('stock_asc')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [movementForm, setMovementForm] = useState(emptyMovement)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return [...products].filter((product) => {
      const details = product.admin_details || {}
      const productStatus = inventoryStatus(product)
      const haystack = [
        product.name,
        product.model,
        product.brand,
        details.sku
      ].join(' ').toLowerCase()
      return (!term || haystack.includes(term)) &&
        (status === 'all' || productStatus === status) &&
        (supplierId === 'all' || details.supplier_id === supplierId)
    }).sort((a, b) => {
      if (sort === 'stock_desc') return Number(b.available_stock_quantity ?? b.stock_quantity ?? 0) - Number(a.available_stock_quantity ?? a.stock_quantity ?? 0)
      if (sort === 'value_desc') return Number(b.stock_quantity || 0) * Number(b.cost_price || 0) - Number(a.stock_quantity || 0) * Number(a.cost_price || 0)
      return Number(a.available_stock_quantity ?? a.stock_quantity ?? 0) - Number(b.available_stock_quantity ?? b.stock_quantity ?? 0)
    })
  }, [products, search, status, supplierId, sort])

  const summary = useMemo(() => products.reduce((acc, product) => {
    const productStatus = inventoryStatus(product)
    const stock = Number(product.stock_quantity || 0)
    const reserved = Number(product.reserved_stock_quantity || 0)
    const available = Number(product.available_stock_quantity ?? stock - reserved)
    if (product.admin_details?.track_inventory !== false) acc.controlled += 1
    acc.units += stock
    acc.reserved += reserved
    acc.available += available
    acc.value += stock * Number(product.cost_price || 0)
    if (productStatus === 'low') acc.low += 1
    if (productStatus === 'out') acc.out += 1
    return acc
  }, { controlled: 0, units: 0, reserved: 0, available: 0, low: 0, out: 0, value: 0 }), [products])

  const selectedProduct = products.find((product) => product.id === movementForm.product_id)
  const movementQuantity = Number(movementForm.quantity || 0)
  const movementQuantityIsInteger = Number.isInteger(movementQuantity)
  const delta = movementQuantity > 0 ? movementQuantity * movementSign(movementForm.movement_type) : 0
  const nextStock = Number(selectedProduct?.stock_quantity || 0) + delta
  const selectedReserved = Number(selectedProduct?.reserved_stock_quantity || 0)
  const nextAvailable = nextStock - selectedReserved
  const movementBlocked = !selectedProduct ||
    selectedProduct.admin_details?.track_inventory === false ||
    movementQuantity <= 0 ||
    !movementQuantityIsInteger ||
    !movementForm.reason.trim() ||
    nextStock < 0 ||
    nextAvailable < 0

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

  const submitMovement = async (event) => {
    event.preventDefault()
    if (movementBlocked) return
    try {
      setSaving(true)
      setError('')
      setMessage('')
      await createInventoryMovement({
        ...movementForm,
        quantity: movementQuantity,
        location_id: locations[0]?.id || null,
        unit_cost_snapshot: selectedProduct?.cost_price || null
      })
      setMessage('Movimiento registrado correctamente.')
      setDrawerOpen(false)
      setMovementForm(emptyMovement)
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo registrar el movimiento.')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { key: 'product', label: 'Producto', render: (product) => (
      <div className="table-product">
        <img src={product.main_image_url || '/placeholder.svg'} alt={product.name} width="44" height="44" loading="lazy" decoding="async" onError={imageFallback} />
        <div><strong>{product.name}</strong><span>{product.brand} {product.model}</span></div>
      </div>
    ) },
    { key: 'sku', label: 'SKU', render: (product) => product.admin_details?.sku || '-' },
    { key: 'supplier', label: 'Proveedor', render: (product) => product.supplier?.name || '-' },
    { key: 'cost', label: 'Costo unitario', align: 'right', render: (product) => <MoneyCell value={product.cost_price} /> },
    { key: 'retail', label: 'Precio minorista', align: 'right', render: (product) => product.admin_details?.retail_price ? <MoneyCell value={product.admin_details.retail_price} /> : '-' },
    { key: 'stock', label: 'Fisico', align: 'right', render: (product) => Number(product.stock_quantity || 0) },
    { key: 'reserved', label: 'Reservado', align: 'right', render: (product) => Number(product.reserved_stock_quantity || 0) },
    { key: 'available', label: 'Disponible', align: 'right', render: (product) => Number(product.available_stock_quantity ?? (Number(product.stock_quantity || 0) - Number(product.reserved_stock_quantity || 0))) },
    { key: 'min', label: 'Stock minimo', align: 'right', render: (product) => product.admin_details?.low_stock_threshold ?? 2 },
    { key: 'status', label: 'Estado', render: (product) => {
      const current = inventoryStatus(product)
      return <AdminStatusBadge tone={statusTone(current)}>{inventoryStatusLabel(current)}</AdminStatusBadge>
    } },
    { key: 'value', label: 'Valor en inventario', align: 'right', render: (product) => <MoneyCell value={Number(product.stock_quantity || 0) * Number(product.cost_price || 0)} /> },
    { key: 'actions', label: 'Acciones', render: (product) => (
      <RowActions>
        <button type="button" disabled={product.admin_details?.track_inventory === false} onClick={() => openMovement(product, 'manual_entry')}><Plus size={14} /> Entrada</button>
        <button type="button" disabled={product.admin_details?.track_inventory === false} onClick={() => openMovement(product, 'manual_exit')}><Minus size={14} /> Salida</button>
        <button type="button" disabled={product.admin_details?.track_inventory === false} onClick={() => openMovement(product, 'adjustment_in')}><SlidersHorizontal size={14} /> Ajuste</button>
        <Link to={`/admin/inventario/${product.id}`}><History size={14} /> Historial</Link>
        <Link to={`/admin/productos/${product.id}/editar`}>Editar</Link>
      </RowActions>
    ) }
  ]

  return (
    <div className="admin-page ax-page ax-inventory-page">
      <AdminPageHeader
        eyebrow="Catalogo"
        title="Inventario"
        description="Control de existencias y movimientos de productos."
        actions={<button className="primary-button" type="button" onClick={() => setDrawerOpen(true)}><Package size={16} /> Registrar movimiento</button>}
      />
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <div className="ax-metric-grid">
        <AdminMetric label="Productos controlados" value={summary.controlled} />
        <AdminMetric label="Stock fisico" value={summary.units} />
        <AdminMetric label="Stock reservado" value={summary.reserved} />
        <AdminMetric label="Disponible" value={summary.available} />
        <AdminMetric label="Stock bajo" value={summary.low} />
        <AdminMetric label="Agotados" value={summary.out} />
        <AdminMetric label="Valor aproximado" value={formatGs(summary.value)} featured />
      </div>

      <FilterToolbar>
        <label className="ax-search-field"><Search size={15} /><input placeholder="Buscar producto, modelo o SKU" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="ax-quick-filters">
          {[
            ['all', 'Todos'],
            ['available', 'Disponibles'],
            ['low', 'Stock bajo'],
            ['out', 'Agotados'],
            ['untracked', 'Sin control']
          ].map(([key, label]) => <button className={status === key ? 'active' : ''} type="button" key={key} onClick={() => setStatus(key)}>{label}</button>)}
        </div>
        <label>Proveedor
          <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="all">Todos</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </label>
        <label>Orden
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="stock_asc">Stock ascendente</option>
            <option value="stock_desc">Stock descendente</option>
            <option value="value_desc">Mayor valor</option>
          </select>
        </label>
      </FilterToolbar>

      <AdminDataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        empty="No hay productos para mostrar."
      />

      <Drawer open={drawerOpen} title="Registrar movimiento" onClose={closeDrawer}>
        <form className="ax-drawer-form" onSubmit={submitMovement}>
          <label>Producto
            <select value={movementForm.product_id} onChange={(event) => setMovementForm((prev) => ({ ...prev, product_id: event.target.value }))} required>
              <option value="">Seleccionar producto</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </label>
          {selectedProduct && (
            <div className="ax-stock-preview">
              <span>Fisico: <strong>{Number(selectedProduct.stock_quantity || 0)}</strong></span>
              <span>Reservado: <strong>{Number(selectedProduct.reserved_stock_quantity || 0)}</strong></span>
              <span>Disponible: <strong>{Number(selectedProduct.available_stock_quantity ?? (Number(selectedProduct.stock_quantity || 0) - Number(selectedProduct.reserved_stock_quantity || 0)))}</strong></span>
              {selectedProduct.admin_details?.track_inventory === false && <AdminStatusBadge>Sin control de inventario</AdminStatusBadge>}
            </div>
          )}
          <label>Tipo de movimiento
            <select value={movementForm.movement_type} onChange={(event) => setMovementForm((prev) => ({ ...prev, movement_type: event.target.value }))}>
              {movementOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Cantidad
            <input type="number" min="1" step="1" value={movementForm.quantity} onChange={(event) => setMovementForm((prev) => ({ ...prev, quantity: event.target.value }))} required />
          </label>
          <label>Motivo
            <input value={movementForm.reason} onChange={(event) => setMovementForm((prev) => ({ ...prev, reason: event.target.value }))} required />
          </label>
          <label>Observacion opcional
            <textarea value={movementForm.notes} onChange={(event) => setMovementForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </label>
          <div className={`ax-stock-result ${nextStock < 0 || nextAvailable < 0 ? 'danger' : ''}`}>
            <span>Fisico actual: {Number(selectedProduct?.stock_quantity || 0)}</span>
            <span>Reservado: {selectedReserved}</span>
            <span>Movimiento: {delta > 0 ? `+${delta}` : delta}</span>
            <strong>Nuevo disponible: {selectedProduct ? nextAvailable : '-'}</strong>
          </div>
          {movementForm.quantity && !movementQuantityIsInteger && <div className="error-box">La cantidad debe ser un numero entero.</div>}
          {nextStock < 0 && <div className="error-box">No se puede dejar stock negativo.</div>}
          {nextAvailable < 0 && <div className="error-box">No se puede bajar el stock fisico por debajo de lo reservado.</div>}
          <button className="primary-button" type="submit" disabled={saving || movementBlocked}>{saving ? 'Guardando...' : 'Registrar movimiento'}</button>
        </form>
      </Drawer>
    </div>
  )
}
