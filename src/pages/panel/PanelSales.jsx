import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { ResellerPanelLayout } from '../../components/ResellerPanelLayout'
import { CompactPageHeader, OrderListItem, StatusBadge } from '../../components/ResellerUX'
import { commissionState, getMySales } from '../../lib/resellerSalesApi'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'

const emptyFilters = {
  status: 'all',
  date_from: '',
  date_to: '',
  search: ''
}

const filterOptions = [
  ['all', 'Todos'],
  ['pending', 'Pendientes'],
  ['process', 'En proceso'],
  ['delivered', 'Entregados'],
  ['cancelled', 'Cancelados']
]

export function PanelSales() {
  const [sales, setSales] = useState([])
  const [filters, setFilters] = useState(emptyFilters)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async (nextFilters = filters) => {
    try {
      setLoading(true)
      setError('')
      setSales(await getMySales({
        ...nextFilters,
        group: nextFilters.status === 'process' || nextFilters.status === 'cancelled' ? nextFilters.status : null,
        status: nextFilters.status
      }))
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
    <ResellerPanelLayout>
      <div className="rx-page">
        <CompactPageHeader title="Ventas" subtitle="Pedidos, estados y comisiones." />
        <div className="rx-results-head">
          <strong className="result-pill">{sales.length} resultados</strong>
        </div>

        {error && <div className="error-box">{error} <button className="secondary-button" type="button" onClick={() => load(filters)}>Reintentar</button></div>}

        <form className="rx-filter-panel" onSubmit={submit}>
          <div className="segmented-filters">
            {filterOptions.map(([value, label]) => (
              <button
                key={value}
                className={filters.status === value ? 'active' : ''}
                type="button"
                onClick={() => {
                  const next = { ...filters, status: value }
                  setFilters(next)
                  load(next)
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label>Buscar producto o cliente<input value={filters.search} onChange={(event) => setFilter('search', event.target.value)} /></label>
          <div className="form-grid">
            <label>Fecha desde<input type="date" value={filters.date_from} onChange={(event) => setFilter('date_from', event.target.value)} /></label>
            <label>Fecha hasta<input type="date" value={filters.date_to} onChange={(event) => setFilter('date_to', event.target.value)} /></label>
          </div>
          <button className="primary-button full" type="submit"><Search size={16} /> Buscar</button>
        </form>

        <section className="rx-section">
          {loading && <p>Cargando ventas...</p>}
          {!loading && !!sales.length && (
            <>
              <div className="reseller-sales-table">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Producto</th>
                      <th>Cliente</th>
                      <th>Estado</th>
                      <th>Precio vendido</th>
                      <th>Comision</th>
                      <th>Estado comision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr key={sale.id}>
                        <td>{formatDatePy(sale.delivered_at || sale.created_at)}</td>
                        <td><strong>{sale.product_name_snapshot}</strong></td>
                        <td>{sale.customer_name} <span>{sale.customer_phone_masked}</span></td>
                        <td><StatusBadge status={sale.status} /></td>
                        <td>{formatGs(sale.product_sale_price)}</td>
                        <td><strong>{formatGs(sale.reseller_commission)}</strong></td>
                        <td>{commissionState(sale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="reseller-sale-card-list">
                {sales.map((sale) => (
                  <OrderListItem key={sale.id} sale={sale} />
                ))}
              </div>
            </>
          )}
          {!loading && !sales.length && <div className="empty-state">No encontramos ventas con estos filtros. Proba con otro estado o fecha.</div>}
        </section>
      </div>
    </ResellerPanelLayout>
  )
}
