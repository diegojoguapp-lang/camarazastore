import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Settings2, RefreshCw, Truck, XCircle, CalendarCheck } from 'lucide-react'
import { AdminDataTable, AdminMetric, AdminModal, AdminPageHeader, MoneyCell } from '../../components/AdminUX'
import { SearchInput } from '../../components/design'
import { adminGlobalSearch } from '../../lib/adminDashboardApi'
import { closeBusinessDay, getBusinessDashboard, saveBusinessGoals } from '../../lib/adminBusinessApi'
import { cancellationLabel, goalProgress } from '../../lib/businessOperations'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'
import '../../styles/business.css'

function Channels({ rows = [] }) {
  return <AdminDataTable rows={rows} columns={[
    { key: 'kind', label: 'Canal', render: (r) => r.kind === 'direct' ? 'Cliente final' : 'Revendedores' },
    { key: 'delivered_count', label: 'Entregados' },
    { key: 'revenue', label: 'Facturacion', render: (r) => <MoneyCell value={r.revenue} /> },
    { key: 'operating_profit', label: 'Ganancia operativa', render: (r) => <MoneyCell value={r.operating_profit} /> },
    { key: 'commissions_generated', label: 'Comisiones', render: (r) => <MoneyCell value={r.commissions_generated} /> }
  ]} />
}

function PeriodSummary({ title, data, goal }) {
  const progress = goalProgress(data.delivered_count, goal)
  return <section className="business-section">
    <h2>{title}</h2>
    <div className="business-inline"><strong>{data.delivered_count} / {goal}</strong><span>{progress.percent}%</span></div>
    <progress max="100" value={progress.bar} aria-label={`Cumplimiento ${title}`} />
    <dl className="business-facts">
      <div><dt>Facturacion</dt><dd>{formatGs(data.revenue)}</dd></div>
      <div><dt>Ganancia operativa</dt><dd>{formatGs(data.operating_profit)}</dd></div>
      <div><dt>Cancelados</dt><dd>{data.cancelled_count}</dd></div>
    </dl>
  </section>
}

export function AdminDashboard() {
  const [data, setData] = useState(null)
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [goals, setGoals] = useState(null)
  const [closeOpen, setCloseOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [chartDays, setChartDays] = useState(14)
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [searchError, setSearchError] = useState('')
  const request = useRef(0)

  async function load(selected = date) {
    const version = ++request.current
    setLoading(true)
    setError('')
    try {
      const next = await getBusinessDashboard(selected || null)
      if (version === request.current) { setData(next); setDate(next.business_date) }
    } catch (err) {
      if (version === request.current) { setError(err.message); setData(null) }
    } finally { if (version === request.current) setLoading(false) }
  }

  useEffect(() => { load(''); return () => { request.current += 1 } }, [])
  useEffect(() => {
    let active = true
    setResults([])
    setSearchError('')
    if (term.trim().length < 2) return
    const timer = setTimeout(() => {
      adminGlobalSearch(term).then((rows) => { if (active) setResults(rows) })
        .catch((err) => { if (active) setSearchError(err.message) })
    }, 260)
    return () => { active = false; clearTimeout(timer) }
  }, [term])

  async function saveGoals(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try { await saveBusinessGoals(goals); setGoals(null); await load(); setNotice('Metas actualizadas.') }
    catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function closeDay() {
    setSaving(true)
    setError('')
    try { await closeBusinessDay(date); setCloseOpen(false); await load(); setNotice('Cierre guardado.') }
    catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const today = data?.today
  const goal = data?.settings.daily_delivered_goal
  const progress = goalProgress(today?.delivered_count, goal)
  const closure = data?.closure
  const closing = closure?.snapshot || today
  const closingGoal = closure?.goal || goal
  const chart = data?.chart.slice(-chartDays) || []
  const chartMax = Math.max(goal || 1, ...chart.map((d) => Number(d.delivered_count)))

  return <div className="admin-page ax-page business-page">
    <AdminPageHeader title="Dashboard" actions={<>
      <button type="button" className="secondary-button" onClick={() => load()} disabled={loading}><RefreshCw size={16} /> Actualizar</button>
      <button type="button" className="secondary-button" onClick={() => setGoals({ ...data.settings })} disabled={!data || loading}><Settings2 size={16} /> Configurar metas</button>
      <Link className="primary-button" to="/admin/ventas/nueva">Nueva venta</Link>
    </>} />
    <div className="business-toolbar">
      <label>Dia del negocio<input type="date" value={date} onChange={(e) => { setDate(e.target.value); if (e.target.value) load(e.target.value) }} /></label>
      <SearchInput value={term} onChange={setTerm} placeholder="Buscar en admin" />
    </div>
    {searchError && <div className="error-box">{searchError}</div>}
    {results.length > 0 && <div className="admin-search-results">{results.map((r) => <Link key={`${r.result_type}-${r.result_id}`} to={r.path}><strong>{r.title}</strong><small>{r.subtitle}</small></Link>)}</div>}
    {error && <div className="error-box" role="alert">{error}</div>}
    {notice && <p role="status">{notice}</p>}
    {loading && <div className="business-loading" aria-busy="true">Cargando indicadores...</div>}
    {!loading && data && <>
      <div className="business-kpis">
        <article className="business-goal">
          <span>Pedidos entregados · {formatDatePy(date)}</span>
          <strong>{today.delivered_count} <small>/ {goal}</small></strong>
          <progress max="100" value={progress.bar} aria-label="Cumplimiento diario" />
          <p>{progress.message}</p>
        </article>
        <AdminMetric label="Ganancia operativa del dia" value={<MoneyCell value={today.operating_profit} />} />
        <AdminMetric label="Facturacion del dia" value={<MoneyCell value={today.revenue} />} />
        <AdminMetric label="Dinero actual" value={<MoneyCell value={data.finance.money_current} />} hint={<Link to="/admin/finanzas">Ver finanzas</Link>} />
      </div>
      <div className="business-operations">
        {[[CalendarCheck,'Coordinados',today.coordinated_count],[Truck,'Pedido en camino',today.out_for_delivery_count],[CheckCircle2,'Entregados',today.delivered_count],[XCircle,'Cancelados',today.cancelled_count]].map(([Icon,label,value]) => <div key={label}><Icon size={18} /><span>{label}</span><strong>{value}</strong></div>)}
        <div><span>Potencial actual</span><strong>{today.potential_count} pedidos</strong></div>
        <div><span>Pedidos creados</span><strong>{today.created_count}</strong></div>
      </div>
      <section className="business-section"><h2>Por canal · {formatDatePy(date)}</h2><Channels rows={today.channels} /></section>
      <div className="business-columns">
        <PeriodSummary title="Semana actual" data={data.week} goal={data.settings.weekly_delivered_goal} />
        <PeriodSummary title="Mes actual" data={data.month} goal={data.settings.monthly_delivered_goal} />
      </div>
      <div className="business-operations">
        <div><span>Promedio diario del mes</span><strong>{(data.month.delivered_count / Math.max(1, data.month.days.length)).toFixed(1)}</strong></div>
        <div><span>Dias con meta cumplida</span><strong>{data.days_goal_met}</strong></div>
        <div><span>Mejor dia del mes</span><strong>{data.best_day || 0} pedidos</strong></div>
        <div><span>Racha actual</span><strong>{data.streak} dias</strong></div>
      </div>
      <section className="business-section">
        <div className="business-inline"><h2>Pedidos entregados por dia</h2><div className="business-segments">{[7,14].map((n) => <button type="button" key={n} aria-pressed={chartDays === n} onClick={() => setChartDays(n)}>{n} dias</button>)}</div></div>
        <div className="business-chart" role="img" aria-label={chart.map((d) => `${d.business_date}: ${d.delivered_count} pedidos`).join(', ')}>
          <div className="business-goal-line" style={{ bottom: `calc(28px + ${(goal / chartMax) * 150}px)` }}><span>Meta {goal}</span></div>
          {chart.map((d) => <div className="business-chart-day" key={d.business_date}><strong>{d.delivered_count}</strong><div style={{ height: `${Number(d.delivered_count) / chartMax * 150}px` }} /><span>{formatDatePy(d.business_date, { day: '2-digit', month: '2-digit' })}</span></div>)}
        </div>
      </section>
      <section className="business-section">
        <div className="business-inline"><h2>Cierre diario · {formatDatePy(date)}</h2>{closure ? <span>Cerrado {formatDatePy(closure.closed_at)}</span> : <button className="primary-button" onClick={() => setCloseOpen(true)}>Cerrar dia</button>}</div>
        <p>{closure ? 'Cierre guardado' : 'Resumen en vivo'}</p>
        <dl className="business-facts">
          {Object.entries({ Meta: closingGoal, Entregados: closing.delivered_count, Cumplimiento: `${goalProgress(closing.delivered_count,closingGoal).percent}%`, 'Coordinados pendientes': closing.coordinated_count, 'En camino': closing.out_for_delivery_count, Cancelados: closing.cancelled_count, Facturacion: formatGs(closing.revenue), 'Ganancia operativa': formatGs(closing.operating_profit), Gastos: formatGs(closing.expenses), 'Ganancia neta': formatGs(closing.net_profit), Comisiones: formatGs(closing.commissions_generated), 'Unidades vendidas': closing.units_sold }).map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        <Channels rows={closing.channels} />
      </section>
      <section className="business-section"><h2>Ultimos cierres</h2><AdminDataTable rows={data.closures} columns={[
        {key:'business_date',label:'Fecha',render:r=><button className="secondary-button" onClick={()=>load(r.business_date)}>{formatDatePy(r.business_date)}</button>},
        {key:'goal',label:'Meta'}, {key:'delivered',label:'Entregados',render:r=>r.snapshot.delivered_count},
        {key:'progress',label:'Cumplimiento',render:r=>`${goalProgress(r.snapshot.delivered_count,r.goal).percent}%`},
        {key:'revenue',label:'Facturacion',render:r=><MoneyCell value={r.snapshot.revenue}/>},
        {key:'profit',label:'Ganancia neta',render:r=><MoneyCell value={r.snapshot.net_profit}/>}
      ]} empty="Todavia no hay cierres guardados." /></section>
      <section className="business-section"><div className="business-inline"><h2>Ranking del mes</h2><Link to="/admin/revendedores">Ver revendedores</Link></div><AdminDataTable rows={data.ranking.slice(0,10)} columns={[
        {key:'name',label:'Revendedor'}, {key:'delivered_month',label:'Entregados'},
        {key:'revenue_month',label:'Facturacion',render:r=><MoneyCell value={r.revenue_month}/>},
        {key:'commission_month',label:'Comision generada',render:r=><MoneyCell value={r.commission_month}/>},
        {key:'cancelled_month',label:'Cancelados'}
      ]}/></section>
      <div className="business-columns">
        <section className="business-section"><h2>Cancelaciones del dia</h2><p>Tasa: {today.cancellation_rate || 0}%</p><AdminDataTable rows={today.cancellation_reasons} columns={[{key:'reason',label:'Motivo',render:r=>cancellationLabel(r.reason)},{key:'count',label:'Pedidos'}]} /></section>
        <section className="business-section"><h2>Inventario y comisiones</h2><dl className="business-facts"><div><dt>Valor inventario</dt><dd>{formatGs(data.finance.inventory_value)}</dd></div><div><dt>Comisiones pendientes</dt><dd>{formatGs(data.finance.pending_commissions)}</dd></div></dl><div className="business-inline"><Link to="/admin/inventario">Inventario</Link><Link to="/admin/comisiones">Comisiones</Link><Link to="/admin/reportes">Reportes</Link></div></section>
      </div>
    </>}
    <AdminModal open={Boolean(goals)} title="Configurar metas" onClose={saving ? undefined : () => setGoals(null)}>
      {goals && <form className="ax-drawer-form" onSubmit={saveGoals}>
        {[["daily_delivered_goal","Meta diaria de pedidos entregados",100000],["weekly_delivered_goal","Meta semanal",1000000],["monthly_delivered_goal","Meta mensual",10000000]].map(([key,label,max]) => <label key={key}>{label}<input type="number" min="1" max={max} step="1" required value={goals[key]} onChange={e=>setGoals({...goals,[key]:e.target.value})}/></label>)}
        {error && <div role="alert" className="error-box">{error}</div>}
        <button className="primary-button" disabled={saving}>{saving ? 'Guardando...' : 'Guardar metas'}</button>
      </form>}
    </AdminModal>
    <AdminModal open={closeOpen} title="Cerrar dia" onClose={saving ? undefined : () => setCloseOpen(false)}>
      <p>Guardar el cierre de {formatDatePy(date)} con los importes actuales. El cierre se conserva aunque cambien operaciones posteriormente.</p>
      {error && <div role="alert" className="error-box">{error}</div>}
      <button className="primary-button" disabled={saving} onClick={closeDay}>{saving ? 'Guardando...' : 'Confirmar cierre'}</button>
    </AdminModal>
  </div>
}
