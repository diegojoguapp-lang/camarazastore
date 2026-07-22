import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Pencil, Plus } from 'lucide-react'
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

export function SalesAdmin() {
  const [sales, setSales] = useState([])
  const [resellers, setResellers] = useState([])
  const [products, setProducts] = useState([])
  const [filters, setFilters] = useState(emptyFilters)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

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

  const submitFilters = (event) => {
    event.preventDefault()
    load(filters)
  }

  const changeStatus = async (sale) => {
    const status = window.prompt('Nuevo estado', sale.status)
    if (!status || status === sale.status) return
    try {
      setMessage('')
      setError('')
      await updateSaleStatus(sale.id, status)
      setMessage('Estado actualizado.')
      load(filters)
    } catch (err) {
      setError(err.message || 'No se pudo cambiar el estado.')
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Ventas</h1>
        </div>
        <Link className="primary-button" to="/admin/ventas/nueva"><Plus size={16} /> Nueva venta</Link>
      </div>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <form className="form-section admin-filter-form" onSubmit={submitFilters}>
        <div className="form-grid">
          <label>Desde<input type="date" value={filters.date_from} onChange={(e) => setFilter('date_from', e.target.value)} /></label>
          <label>Hasta<input type="date" value={filters.date_to} onChange={(e) => setFilter('date_to', e.target.value)} /></label>
          <label>Estado<select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}><option value="">Todos</option>{SALE_STATUSES.map((status) => <option key={status} value={status}>{saleStatusLabel(status)}</option>)}</select></label>
          <label>Revendedor<select value={filters.reseller_id} onChange={(e) => setFilter('reseller_id', e.target.value)}><option value="">Todos</option>{resellers.map((item) => <option key={item.id} value={item.id}>{item.reseller_code} - {item.full_name}</option>)}</select></label>
          <label>Producto<select value={filters.product_id} onChange={(e) => setFilter('product_id', e.target.value)}><option value="">Todos</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Ciudad<input value={filters.city} onChange={(e) => setFilter('city', e.target.value)} /></label>
        </div>
        <label>Buscar cliente o telefono<input value={filters.search} onChange={(e) => setFilter('search', e.target.value)} /></label>
        <div className="form-actions-row">
          <button className="primary-button" type="submit">Aplicar filtros</button>
          <button className="secondary-button" type="button" onClick={() => { setFilters(emptyFilters); load(emptyFilters) }}>Limpiar</button>
        </div>
      </form>

      <div className="stats-grid sales-stats">
        <div className="stat-card"><span>Ventas listadas</span><strong>{sales.length}</strong></div>
        <div className="stat-card"><span>Comisiones</span><strong>{formatGs(totals.commissions)}</strong></div>
        <div className="stat-card"><span>Ganancia neta</span><strong>{formatGs(totals.net)}</strong></div>
      </div>

      <div className="table-wrap">
        {loading && <p className="table-loading">Cargando ventas...</p>}
        {!loading && (
          <table className="admin-table sales-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Producto</th>
                <th>Revendedor</th>
                <th>Estado</th>
                <th>Precio</th>
                <th>Comision</th>
                <th>Ganancia</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td>{formatDatePy(sale.created_at)}</td>
                  <td>{sale.customer?.full_name || '-'}</td>
                  <td>{sale.product_name_snapshot}</td>
                  <td>{sale.reseller?.reseller_code || '-'} {sale.reseller?.full_name || ''}</td>
                  <td><span className={`sale-status status-${sale.status}`}>{saleStatusLabel(sale.status)}</span></td>
                  <td>{formatGs(sale.product_sale_price)}</td>
                  <td>{formatGs(sale.reseller_commission)}</td>
                  <td>{formatGs(sale.camaraza_net_profit)}</td>
                  <td>
                    <div className="table-actions">
                      <Link className="icon-link" to={`/admin/ventas/${sale.id}`}><Eye size={14} /></Link>
                      <Link className="icon-link" to={`/admin/ventas/${sale.id}/editar`}><Pencil size={14} /></Link>
                      <button type="button" onClick={() => changeStatus(sale)}>Estado</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !sales.length && <div className="empty-state">Todavia no hay ventas cargadas.</div>}
      </div>
    </div>
  )
}
