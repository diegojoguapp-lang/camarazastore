import { useEffect, useRef, useState } from 'react'
import { AdminDataTable, AdminMetric, AdminPageHeader, MoneyCell } from '../../components/AdminUX'
import { getBusinessReport } from '../../lib/adminBusinessApi'
import { cancellationLabel } from '../../lib/businessOperations'
import '../../styles/business.css'

export function ReportsAdmin() {
  const [filters, setFilters] = useState({ period: 'month', from: '', to: '' })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const request = useRef(0)
  async function load(next = filters) {
    const version = ++request.current
    setLoading(true)
    setError('')
    try {
      const result = await getBusinessReport(next)
      if (version !== request.current) return
      setData(result)
      setFilters({ ...next, from: result.date_from, to: result.date_to })
    } catch (err) { if (version === request.current) { setData(null); setError(err.message) } }
    finally { if (version === request.current) setLoading(false) }
  }
  useEffect(() => { load(); return () => { request.current += 1 } }, [])
  return <div className="admin-page ax-page business-page">
    <AdminPageHeader title="Reportes" />
    <form className="business-toolbar" onSubmit={e => { e.preventDefault(); load() }}>
      <label>Periodo<select value={filters.period} onChange={e => {
        const next = { ...filters, period: e.target.value }; setFilters(next)
        if (next.period !== 'custom') load(next)
      }}><option value="today">Hoy</option><option value="week">Esta semana</option><option value="month">Este mes</option><option value="custom">Rango personalizado</option></select></label>
      {filters.period === 'custom' && <><label>Desde<input type="date" required value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})}/></label><label>Hasta<input type="date" required min={filters.from} value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})}/></label><button className="primary-button" disabled={loading}>Aplicar</button></>}
    </form>
    {error && <div role="alert" className="error-box">{error}</div>}
    {loading && <div className="business-loading">Cargando reportes...</div>}
    {!loading && data && <>
      <div className="ax-metric-grid">
        <AdminMetric label="Pedidos entregados" value={data.delivered_count}/>
        <AdminMetric label="Cancelados" value={data.cancelled_count}/>
        <AdminMetric label="Facturacion" value={<MoneyCell value={data.revenue}/>}/>
        <AdminMetric label="Ticket promedio" value={<MoneyCell value={data.delivered_count ? data.revenue / data.delivered_count : 0}/>}/>
        <AdminMetric label="Ganancia operativa" value={<MoneyCell value={data.operating_profit}/>}/>
        <AdminMetric label="Gastos operativos" value={<MoneyCell value={data.expenses}/>}/>
        <AdminMetric label="Ganancia neta" value={<MoneyCell value={data.net_profit}/>}/>
        <AdminMetric label="Ingresos flujo" value={<MoneyCell value={data.cash_income}/>}/>
        <AdminMetric label="Egresos flujo" value={<MoneyCell value={data.cash_expense}/>}/>
      </div>
      <section className="business-section"><h2>Cliente final y revendedores</h2><AdminDataTable rows={data.channels} columns={[
        {key:'kind',label:'Canal',render:r=>r.kind === 'direct' ? 'Cliente final' : 'Revendedores'},
        {key:'delivered_count',label:'Entregados'},
        {key:'revenue',label:'Facturacion',render:r=><MoneyCell value={r.revenue}/>},
        {key:'operating_profit',label:'Ganancia',render:r=><MoneyCell value={r.operating_profit}/>},
        {key:'commissions_generated',label:'Comisiones',render:r=><MoneyCell value={r.commissions_generated}/>}
      ]}/></section>
      <section className="business-section"><h2>Rendimiento por producto</h2><AdminDataTable rows={data.products} columns={[
        {key:'name',label:'Producto'}, {key:'units',label:'Unidades entregadas'},
        {key:'revenue',label:'Facturacion',render:r=><MoneyCell value={r.revenue}/>},
        {key:'profit',label:'Ganancia',render:r=><MoneyCell value={r.profit}/>},
        {key:'stock',label:'Stock disponible'}, {key:'units_30',label:'Vendidas ultimos 30 dias'}
      ]}/></section>
      <section className="business-section"><h2>Revendedores del periodo</h2><AdminDataTable rows={data.resellers || []} columns={[
        {key:'name',label:'Revendedor'}, {key:'delivered_count',label:'Entregados'},
        {key:'revenue',label:'Facturacion',render:r=><MoneyCell value={r.revenue}/>},
        {key:'commission',label:'Comision generada',render:r=><MoneyCell value={r.commission}/>}
      ]}/></section>
      <section className="business-section"><h2>Motivos de cancelacion</h2><p>Tasa: {data.cancellation_rate || 0}%</p><AdminDataTable rows={data.cancellation_reasons} columns={[{key:'reason',label:'Motivo',render:r=>cancellationLabel(r.reason)},{key:'count',label:'Cancelados'}]}/></section>
    </>}
  </div>
}
