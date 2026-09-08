import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ResellerPanelLayout } from '../../components/ResellerPanelLayout'
import { CompactPageHeader, OrderListItem } from '../../components/ResellerUX'
import { getMyOperationSales } from '../../lib/operationApi'
import { operationRange } from '../../lib/operationDates'
import '../../components/operationUX.css'

export function PanelSales() {
  const [filters, setFilters] = useState({ period: 'today', ...operationRange('today'), status: '', search: '', offset: 0 })
  const [result, setResult] = useState({ rows: [], total: 0 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    const timer = setTimeout(() => getMyOperationSales(filters)
      .then((data) => { if (active) { setResult(data); setError('') } })
      .catch((err) => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) }), 300)
    return () => { active = false; clearTimeout(timer) }
  }, [filters, retry])
  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value, offset: 0 }))
  return <ResellerPanelLayout><div className="rx-page">
    <CompactPageHeader title="Mis ventas" />
    <div className="ov-sale-filters">
      <label>Periodo<select value={filters.period} onChange={(e) => setFilters((prev) => ({ ...prev, period: e.target.value, ...operationRange(e.target.value), offset: 0 }))}>{[['today', 'Hoy'], ['this_week', 'Esta semana'], ['last_week', 'Semana anterior'], ['month', 'Este mes'], ['custom', 'Elegir fechas'], ['all', 'Todas']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Estado<select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>{[['', 'Todos'], ['confirmed', 'Coordinado'], ['out_for_delivery', 'En camino'], ['delivered_paid', 'Entregado'], ['pending_contact', 'Pendiente'], ['preparing', 'Preparando'], ['cancelled', 'Cancelado'], ['failed_delivery', 'Entrega fallida'], ['returned', 'Devuelto']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {filters.period === 'custom' && <><label>Desde<input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} /></label><label>Hasta<input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} /></label></>}
      <label>Producto o cliente<input value={filters.search} onChange={(e) => setFilter('search', e.target.value)} /></label>
    </div>
    {error && <div className="error-box" role="alert">{error}<button onClick={() => setRetry((n) => n + 1)}>Reintentar</button></div>}
    {loading ? <p role="status">Cargando ventas...</p> : <section className="rx-order-list"><p>{result.total} pedidos</p>{result.rows.map((sale) => <OrderListItem key={sale.id} sale={sale} />)}{!result.rows.length && <p>Sin pedidos en este periodo.</p>}</section>}
    <nav className="ov-pagination" aria-label="Paginas"><button className="icon-button" aria-label="Pagina anterior" disabled={loading || !filters.offset} onClick={() => setFilters((prev) => ({ ...prev, offset: Math.max(0, prev.offset - 20) }))}><ChevronLeft /></button><span>{Math.floor(filters.offset / 20) + 1}</span><button className="icon-button" aria-label="Pagina siguiente" disabled={loading || filters.offset + 20 >= result.total} onClick={() => setFilters((prev) => ({ ...prev, offset: prev.offset + 20 }))}><ChevronRight /></button></nav>
  </div></ResellerPanelLayout>
}
