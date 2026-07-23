import { useEffect, useState } from 'react'
import { BarChart3, Calendar, PackageCheck, TrendingUp, WalletCards } from 'lucide-react'
import { ResellerPanelLayout } from '../../components/ResellerPanelLayout'
import { EmptyState, MetricCard, PageHeader, ProgressBar } from '../../components/design'
import { getMyPerformance } from '../../lib/resellerExperienceApi'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'

export function PanelPerformance() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      setData(await getMyPerformance())
    } catch (err) {
      setError(err.message || 'No se pudo cargar tu rendimiento.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const weeks = data?.weeks || []
  const maxSales = Math.max(...weeks.map((week) => Number(week.sales || 0)), 1)

  return (
    <ResellerPanelLayout>
      <div className="reseller-dashboard-page">
        <PageHeader eyebrow="Centro de rendimiento" title="Mi rendimiento" description="Evolucion personal de tus ventas y comisiones. No se compara con otros revendedores." />
        {error && <div className="error-box">{error} <button className="secondary-button" type="button" onClick={load}>Reintentar</button></div>}
        {loading && <div className="panel">Cargando rendimiento...</div>}
        {!loading && data && (
          <>
            <section className="reseller-metrics-grid">
              <MetricCard icon={PackageCheck} label="Ventas totales" value={data.total_sales || 0} hint="Todos tus pedidos registrados" />
              <MetricCard icon={Calendar} label="Ultimos 7 dias" value={data.sales_last_7_days || 0} hint="Pedidos recientes" />
              <MetricCard icon={TrendingUp} label="Ultimos 30 dias" value={data.sales_last_30_days || 0} hint="Rendimiento mensual" />
              <MetricCard icon={WalletCards} label="Comision generada" value={formatGs(data.generated_commission)} hint="Ventas entregadas" featured tone="success" />
              <MetricCard icon={WalletCards} label="Comision cobrada" value={formatGs(data.paid_commission)} hint="Pagos depositados" />
              <MetricCard icon={WalletCards} label="Comision pendiente" value={formatGs(data.pending_commission)} hint="Entregadas no pagadas" />
              <MetricCard icon={BarChart3} label="Promedio por venta" value={formatGs(data.average_commission)} hint="Comision promedio" />
              <MetricCard icon={PackageCheck} label="Tasa de entrega" value={`${data.success_rate || 0}%`} hint="Entregadas sobre cerradas" />
              <MetricCard icon={TrendingUp} label="Racha actual" value={`${data.current_sales_week_streak || 0} semanas`} hint="Semanas lunes a sabado con ventas" />
            </section>

            <section className="reseller-two-column">
              <article className="panel">
                <h2>Ventas por semana</h2>
                <div className="week-chart">
                  {weeks.length ? weeks.map((week) => (
                    <div key={week.week_start}>
                      <span>{formatDatePy(week.week_start)}</span>
                      <ProgressBar value={week.sales} max={maxSales} />
                      <strong>{week.sales} ventas - {formatGs(week.commission)}</strong>
                    </div>
                  )) : <EmptyState title="Sin semanas con ventas" description="Cuando tengas ventas entregadas, tu evolucion aparecera aca." />}
                </div>
              </article>
              <article className="panel">
                <h2>Datos clave</h2>
                <div className="profile-summary">
                  <div><span>Primera venta</span><strong>{formatDatePy(data.first_sale_at)}</strong></div>
                  <div><span>Ultima venta</span><strong>{formatDatePy(data.last_sale_at)}</strong></div>
                  <div><span>Producto mas vendido</span><strong>{data.top_product || '-'}</strong></div>
                  <div><span>Mejor semana</span><strong>{data.best_week_sales || 0} ventas</strong></div>
                  <div><span>Cancelados / fallidos</span><strong>{data.cancelled_or_failed || 0}</strong></div>
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </ResellerPanelLayout>
  )
}
