import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Pencil, Plus, Search } from 'lucide-react'
import { AdminDataTable, AdminPageHeader, FilterToolbar, MoneyCell, RowActions } from '../../components/AdminUX'
import { getAdminSales, updateSaleStatus } from '../../lib/adminSalesApi'
import { getProducts } from '../../lib/api'
import { getResellers } from '../../lib/resellerApi'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'
import { SALE_STATUSES, saleStatusLabel } from '../../lib/salesConstants'

const emptyFilters = {
  date_from: '',
  date_to: '',
  status: '',
  reseller_id: '',
  product_id: '',
  city: '',
  search: ''
}

const quickFilters = [
  ['today', 'Hoy'],
  ['yesterday', 'Ayer'],
  ['week', 'Esta semana'],
  ['month', 'Este mes'],
  ['pending_contact', 'Pendientes'],
  ['out_for_delivery', 'En reparto'],
  ['delivered_paid', 'Entregadas']
]

function dateISO(offset = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

function weekStartISO() {
  const date = new Date()
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return date.toISOString().slice(0, 10)
}

function monthStartISO() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

export function SalesAdmin() {
  const [sales, setSales] = useState([])
  const [resellers, setResellers] = useState([])
  const [products, setProducts] = useState([])
  const [filters, setFilters] = useState(emptyFilters)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [statusModalSale, setStatusModalSale] = useState(null)
  const [nextStatus, setNextStatus] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)

  const totals = useMemo(() => ({
    commissions: sales.reduce((sum, sale) => sum + Number(sale.reseller_commission || 0), 0),
    net: sales.reduce((sum, sale) => sum + Number(sale.camaraza_net_profit || 0), 0)
  }), [sales])

  const load = async (nextFilters = filters) => {
    try {
      setLoading(true)
      setError('')
      const [saleRows, resellerRows, productRows] = await Promise.all([
        getAdminSales(nextFilters),
        getResellers(),
        getProducts({ includeHidden: true })
      ])
      setSales(saleRows)
      setResellers(resellerRows)
      setProducts(productRows)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las ventas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(emptyFilters) }, [])

  const setFilter = (field, value) => setFilters((prev) => ({ ...prev, [field]: value }))

  const applyQuick = (key) => {
    let next = { ...filters, date_from: '', date_to: '', status: '' }
    if (key === 'today') next = { ...next, date_from: dateISO(), date_to: dateISO() }
    else if (key === 'yesterday') next = { ...next, date_from: dateISO(-1), date_to: dateISO(-1) }
    else if (key === 'week') next = { ...next, date_from: weekStartISO() }
    else if (key === 'month') next = { ...next, date_from: monthStartISO() }
    else next = { ...next, status: key }
    setFilters(next)
    load(next)
  }

  const submitFilters = (event) => {
    event.preventDefault()
    load(filters)
  }

  const openStatusModal = (sale) => {
    setStatusModalSale(sale)
    setNextStatus(sale.status)
    setStatusNote('')
    setError('')
    setMessage('')
  }

  const closeStatusModal = () => {
    if (statusSaving) return
    setStatusModalSale(null)
    setNextStatus('')
    setStatusNote('')
  }

  const changeStatus = async (event) => {
    event.preventDefault()
    if (!statusModalSale || !nextStatus || nextStatus === statusModalSale.status) {
      closeStatusModal()
      return
    }
    try {
      setStatusSaving(true)
      setMessage('')
      setError('')
      await updateSaleStatus(statusModalSale.id, nextStatus, statusNote)
      setMessage('Estado actualizado.')
      setStatusModalSale(null)
      setNextStatus('')
      setStatusNote('')
      await load(filters)
    } catch (err) {
      setError(err.message || 'No se pudo cambiar el estado.')
    } finally {
      setStatusSaving(false)
    }
  }

  const columns = [
    { key: 'date', label: 'Fecha', render: (sale) => formatDatePy(sale.created_at) },
    { key: 'customer', label: 'Cliente', render: (sale) => sale.customer?.full_name || '-' },
    { key: 'product', label: 'Producto', render: (sale) => <strong>{sale.product_name_snapshot}</strong> },
    { key: 'reseller', label: 'Revendedor', render: (sale) => `${sale.reseller?.reseller_code || '-'} ${sale.reseller?.full_name || ''}` },
    { key: 'status', label: 'Estado', render: (sale) => <span className={`sale-status status-${sale.status}`}>{saleStatusLabel(sale.status)}</span> },
    { key: 'price', label: 'Precio', align: 'right', render: (sale) => <MoneyCell value={sale.product_sale_price} /> },
    { key: 'commission', label: 'Comision', align: 'right', render: (sale) => <MoneyCell value={sale.reseller_commission} /> },
    { key: 'net', label: 'Ganancia', align: 'right', render: (sale) => <MoneyCell value={sale.camaraza_net_profit} /> },
    { key: 'actions', label: 'Acciones', render: (sale) => (
      <RowActions>
        <Link className="icon-link" to={`/admin/ventas/${sale.id}`}><Eye size={14} /></Link>
        <Link className="icon-link" to={`/admin/ventas/${sale.id}/editar`}><Pencil size={14} /></Link>
        <button type="button" onClick={() => openStatusModal(sale)}>Estado</button>
      </RowActions>
    ) }
  ]

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader
        title="Ventas"
        description="Operacion diaria de pedidos, estados y rentabilidad."
        actions={<Link className="primary-button" to="/admin/ventas/nueva"><Plus size={16} /> Nueva venta</Link>}
      />

      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <FilterToolbar
        actions={<button className="secondary-button" type="button" onClick={() => setAdvancedOpen((value) => !value)}>{advancedOpen ? 'Ocultar filtros' : 'Filtros avanzados'}</button>}
      >
        <div className="ax-quick-filters">
          {quickFilters.map(([key, label]) => <button type="button" key={key} onClick={() => applyQuick(key)}>{label}</button>)}
        </div>
        <label className="ax-search-field"><Search size={15} /><input placeholder="Cliente, telefono o producto" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(filters) }} /></label>
      </FilterToolbar>

      {advancedOpen && (
        <form className="ax-filter-drawer" onSubmit={submitFilters}>
          <label>Desde<input type="date" value={filters.date_from} onChange={(e) => setFilter('date_from', e.target.value)} /></label>
          <label>Hasta<input type="date" value={filters.date_to} onChange={(e) => setFilter('date_to', e.target.value)} /></label>
          <label>Estado<select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}><option value="">Todos</option>{SALE_STATUSES.map((status) => <option key={status} value={status}>{saleStatusLabel(status)}</option>)}</select></label>
          <label>Revendedor<select value={filters.reseller_id} onChange={(e) => setFilter('reseller_id', e.target.value)}><option value="">Todos</option>{resellers.map((item) => <option key={item.id} value={item.id}>{item.reseller_code} - {item.full_name}</option>)}</select></label>
          <label>Producto<select value={filters.product_id} onChange={(e) => setFilter('product_id', e.target.value)}><option value="">Todos</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Ciudad<input value={filters.city} onChange={(e) => setFilter('city', e.target.value)} /></label>
          <button className="primary-button" type="submit">Aplicar</button>
          <button className="secondary-button" type="button" onClick={() => { setFilters(emptyFilters); load(emptyFilters) }}>Limpiar</button>
        </form>
      )}

      <div className="ax-compact-summary">
        <span>Ventas listadas <strong>{sales.length}</strong></span>
        <span>Comisiones <strong>{formatGs(totals.commissions)}</strong></span>
        <span>Ganancia neta <strong>{formatGs(totals.net)}</strong></span>
      </div>

      <AdminDataTable columns={columns} rows={sales} loading={loading} empty="Todavia no hay ventas cargadas." />

      {statusModalSale && (
        <div className="ax-modal-backdrop" role="presentation">
          <form className="ax-status-modal" onSubmit={changeStatus} role="dialog" aria-modal="true" aria-label="Cambiar estado del pedido">
            <header>
              <h2>Cambiar estado del pedido</h2>
              <button type="button" onClick={closeStatusModal} disabled={statusSaving}>Cerrar</button>
            </header>
            <div className="ax-status-modal-info">
              <div><span>Producto</span><strong>{statusModalSale.product_name_snapshot}</strong></div>
              <div><span>Cliente</span><strong>{statusModalSale.customer?.full_name || '-'}</strong></div>
              <div><span>Estado actual</span><strong>{saleStatusLabel(statusModalSale.status)}</strong></div>
            </div>
            <label>Nuevo estado
              <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} autoFocus>
                {SALE_STATUSES.map((status) => <option key={status} value={status}>{saleStatusLabel(status)}</option>)}
              </select>
            </label>
            <label>Nota
              <textarea value={statusNote} onChange={(event) => setStatusNote(event.target.value)} placeholder="Opcional" />
            </label>
            <div className="ax-modal-actions">
              <button className="secondary-button" type="button" onClick={closeStatusModal} disabled={statusSaving}>Cancelar</button>
              <button className="primary-button" type="submit" disabled={statusSaving || nextStatus === statusModalSale.status}>
                {statusSaving ? 'Actualizando...' : 'Actualizar estado'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
