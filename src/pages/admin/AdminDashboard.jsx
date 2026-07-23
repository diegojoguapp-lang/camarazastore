import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  Package,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users
} from 'lucide-react'
import { EmptyState, MetricCard, PageHeader, SearchInput, SkeletonCard } from '../../components/design'
import { getAdminDashboard, adminGlobalSearch } from '../../lib/adminDashboardApi'
import { getProducts } from '../../lib/api'
import { formatGs } from '../../lib/utils'

const emptyDashboard = {
  sales_today: 0,
  sales_yesterday: 0,
  sales_this_week: 0,
  sales_this_month: 0,
  gross_revenue: 0,
  net_profit: 0,
  pending_commissions: 0,
  paid_commissions: 0,
  pending_contact: 0,
  confirmed: 0,
  preparing: 0,
  out_for_delivery: 0,
  delivered_today: 0,
  cancelled_or_failed: 0,
  active_resellers: 0,
  resellers_with_sales_this_week: 0,
  total_customers: 0,
  pending_payments: 0,
  batches_open: 0,
  resellers_without_bank: 0
}

function compareHint(current, previous) {
  if (!previous && !current) return 'Sin comparacion'
  if (!previous) return 'Sin comparacion'
  if (current > previous) return `+${current - previous} contra ayer`
  if (current < previous) return `${current - previous} contra ayer`
  return 'Igual que ayer'
}

export function AdminDashboard() {
  const [dashboard, setDashboard] = useState(emptyDashboard)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [dashboardData, productsData] = await Promise.all([
          getAdminDashboard().catch((err) => {
            setError(`Dashboard avanzado pendiente de migracion: ${err.message}`)
            return emptyDashboard
          }),
          getProducts({ includeHidden: true })
        ])
        if (!active) return
        setDashboard({ ...emptyDashboard, ...(dashboardData || {}) })
        setProducts(productsData || [])
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const clean = term.trim()
    if (clean.length < 2) {
      setResults([])
      setSearchError('')
      setSearching(false)
      return
    }
    const timer = window.setTimeout(async () => {
      setSearching(true)
      setSearchError('')
      try {
        setResults(await adminGlobalSearch(clean))
      } catch (err) {
        setSearchError(`Busqueda avanzada pendiente: ${err.message}`)
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 260)
    return () => window.clearTimeout(timer)
  }, [term])

  const productStats = useMemo(() => ({
    total: products.length,
    active: products.filter((p) => p.internal_status === 'active').length,
    soldOut: products.filter((p) => p.internal_status === 'sold_out' || p.public_stock_status === 'agotado').length,
    hidden: products.filter((p) => p.internal_status === 'hidden').length
  }), [products])

  const alerts = [
    { label: 'Pedidos esperando contacto', value: dashboard.pending_contact, to: '/admin/ventas?status=pending_contact', icon: CalendarClock },
    { label: 'Pedidos en reparto', value: dashboard.out_for_delivery, to: '/admin/ventas?status=out_for_delivery', icon: Truck },
    { label: 'Pagos pendientes', value: dashboard.pending_payments, to: '/admin/comisiones/pagos', icon: Banknote },
    { label: 'Revendedores sin cuenta bancaria', value: dashboard.resellers_without_bank, to: '/admin/revendedores', icon: Users },
    { label: 'Productos sin stock', value: productStats.soldOut, to: '/admin/productos', icon: Package }
  ].filter((alert) => Number(alert.value || 0) > 0)

  return (
    <div className="admin-page admin-command-center">
      <PageHeader
        eyebrow="Admin"
        title="Dashboard"
        description="Vista rapida para operar ventas, comisiones, productos y revendedores."
        actions={<><Link className="primary-button" to="/admin/ventas/nueva">Nueva venta</Link><Link className="secondary-button" to="/admin/productos/nuevo">Agregar producto</Link></>}
      />

      <section className="admin-search-panel">
        <div>
          <h2>Busqueda global</h2>
          <p>Busca revendedores, clientes, ventas, productos o pagos.</p>
        </div>
        <SearchInput value={term} onChange={setTerm} placeholder="Buscar en admin" minLabel="Minimo 2 letras" />
        {searching && <p className="muted-text">Buscando...</p>}
        {searchError && <div className="error-box">{searchError}</div>}
        {term.trim().length >= 2 && !searching && !searchError && (
          <div className="admin-search-results">
            {results.map((item) => (
              <Link key={`${item.result_type}-${item.result_id}`} to={item.path}>
                <span>{item.result_type}</span>
                <strong>{item.title}</strong>
                {item.subtitle && <small>{item.subtitle}</small>}
              </Link>
            ))}
            {!results.length && <EmptyState title="Sin resultados" description="No encontramos coincidencias." />}
          </div>
        )}
      </section>

      {error && <div className="notice-box">{error}</div>}

      {loading ? (
        <div className="ds-metric-grid">{Array.from({ length: 8 }).map((_, index) => <SkeletonCard key={index} />)}</div>
      ) : (
        <>
          <div className="admin-kpi-layout">
            <MetricCard featured icon={ShoppingCart} label="Ventas hoy" value={dashboard.sales_today} hint={compareHint(dashboard.sales_today, dashboard.sales_yesterday)} />
            <MetricCard icon={TrendingUp} label="Ventas esta semana" value={dashboard.sales_this_week} hint="Periodo lunes a sabado" />
            <MetricCard icon={CalendarClock} label="Ventas este mes" value={dashboard.sales_this_month} hint="Segun fecha de venta" />
            <MetricCard icon={CheckCircle2} label="Entregados hoy" value={dashboard.delivered_today} hint="Estado delivered_paid" />
          </div>

          <div className="ds-metric-grid">
            <MetricCard icon={Banknote} label="Facturacion bruta" value={formatGs(dashboard.gross_revenue)} />
            <MetricCard icon={TrendingUp} label="Ganancia neta" value={formatGs(dashboard.net_profit)} />
            <MetricCard icon={Banknote} label="Comisiones pendientes" value={formatGs(dashboard.pending_commissions)} />
            <MetricCard icon={Banknote} label="Comisiones pagadas" value={formatGs(dashboard.paid_commissions)} />
            <MetricCard icon={Users} label="Revendedores activos" value={dashboard.active_resellers} />
            <MetricCard icon={Users} label="Con ventas esta semana" value={dashboard.resellers_with_sales_this_week} />
            <MetricCard icon={Users} label="Clientes totales" value={dashboard.total_customers} />
            <MetricCard icon={Package} label="Productos activos" value={productStats.active} hint={`${productStats.total} cargados`} />
          </div>
        </>
      )}

      <div className="admin-dashboard-columns">
        <section className="panel">
          <div className="section-title">
            <h2>Alertas operativas</h2>
          </div>
          {alerts.map(({ label, value, to, icon: Icon }) => (
            <Link className="admin-alert-row" key={label} to={to}>
              <Icon size={18} />
              <span>{label}</span>
              <strong>{value}</strong>
            </Link>
          ))}
          {!alerts.length && <EmptyState title="Todo tranquilo" description="No hay alertas operativas pendientes." />}
        </section>

        <section className="panel">
          <div className="section-title">
            <h2>Productos recientes</h2>
            <Link to="/admin/productos">Ver todos</Link>
          </div>
          {products.slice(0, 5).map((product) => (
            <div className="admin-list-row" key={product.id}>
              <span>{product.name}</span>
              <strong>{formatGs(product.wholesale_price)}</strong>
            </div>
          ))}
          {!products.length && <EmptyState title="Sin productos" description="Todavia no hay productos cargados." />}
        </section>
      </div>
    </div>
  )
}
