import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { getMySales } from '../../lib/resellerSalesApi'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'
import { SALE_STATUSES, saleStatusLabel } from '../../lib/salesConstants'

const emptyFilters = {
  status: '',
  date_from: '',
  date_to: '',
  search: ''
}

export function PanelSales() {
  const [sales, setSales] = useState([])
  const [filters, setFilters] = useState(emptyFilters)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async (nextFilters = filters) => {
    try {
      setLoading(true)
      setError('')
      setSales(await getMySales(nextFilters))
    } catch (err) {
      setError(err.message || 'No se pudieron cargar tus ventas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(emptyFilters) }, [])

  const setFilter = (field, value) => setFilters((prev) => ({ ...prev, [field]: value }))

  const submit = (event) => {
    event.preventDefault()
    load(filters)
  }

  return (
    <div className="page reseller-panel-page">
      <section className="container narrow">
        <Link className="back-link" to="/panel"><ArrowLeft size={16} /> Volver</Link>
        <div className="panel">
          <p className="eyebrow">Mi panel</p>
          <h1>Mis ventas</h1>
          <p>Solo ves tus ventas y tus comisiones. Los costos internos no se muestran.</p>
        </div>

        {error && <div className="error-box">{error}</div>}

        <form className="panel reseller-sales-filters" onSubmit={submit}>
          <label>Buscar producto<input value={filters.search} onChange={(e) => setFilter('search', e.target.value)} /></label>
          <div className="form-grid">
            <label>Estado<select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}><option value="">Todos</option>{SALE_STATUSES.map((status) => <option key={status} value={status}>{saleStatusLabel(status)}</option>)}</select></label>
            <label>Entrega desde<input type="date" value={filters.date_from} onChange={(e) => setFilter('date_from', e.target.value)} /></label>
            <label>Entrega hasta<input type="date" value={filters.date_to} onChange={(e) => setFilter('date_to', e.target.value)} /></label>
          </div>
          <button className="primary-button full" type="submit"><Search size={16} /> Buscar</button>
        </form>

        <div className="reseller-sale-list">
          {loading && <p>Cargando ventas...</p>}
          {!loading && sales.map((sale) => (
            <article className="panel reseller-sale-card" key={sale.id}>
              <div>
                <span className={`sale-status status-${sale.status}`}>{saleStatusLabel(sale.status)}</span>
                <h2>{sale.product_name_snapshot}</h2>
                <p>{sale.customer_name} - {sale.customer_phone_masked}</p>
              </div>
              <div className="profile-summary">
                <div><span>Fecha</span><strong>{formatDatePy(sale.created_at)}</strong></div>
                <div><span>Precio vendido</span><strong>{formatGs(sale.product_sale_price)}</strong></div>
                <div><span>Comision</span><strong>{formatGs(sale.reseller_commission)}</strong></div>
                <div><span>Entrega</span><strong>{formatDatePy(sale.delivered_at)}</strong></div>
              </div>
            </article>
          ))}
          {!loading && !sales.length && <div className="empty-state">Todavia no tenes ventas cargadas.</div>}
        </div>
      </section>
    </div>
  )
}
