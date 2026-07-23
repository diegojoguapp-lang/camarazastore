import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { ResellerPanelLayout } from '../../components/ResellerPanelLayout'
import { CompactMetricCard, CompactPageHeader, OrderListItem } from '../../components/ResellerUX'
import { getCurrentProfile } from '../../lib/roles'
import { getMyRecentSales, getMySalesSummary } from '../../lib/resellerSalesApi'
import { formatGs } from '../../lib/utils'

export function PanelHome() {
  const [profile, setProfile] = useState(null)
  const [summary, setSummary] = useState(null)
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const [profileData, summaryData, orderRows] = await Promise.all([
        getCurrentProfile(),
        getMySalesSummary(),
        getMyRecentSales()
      ])
      setProfile(profileData)
      setSummary(summaryData)
      setOrders(orderRows.slice(0, 5))
    } catch (err) {
      setError(err.message || 'No se pudo cargar tu inicio.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <ResellerPanelLayout>
      <div className="rx-page">
        <CompactPageHeader profile={profile} title={`Hola, ${profile?.full_name || 'revendedor'}`} subtitle="Resumen rapido para operar hoy." />

        {error && <div className="error-box">{error} <button className="secondary-button" type="button" onClick={load}>Reintentar</button></div>}
        {loading && <div className="rx-skeleton-list"><span /><span /><span /></div>}

        {!loading && (
          <>
            <section className="rx-section">
              <div className="rx-section-head">
                <h2>Pedidos</h2>
                <Link to="/panel/ventas">Ver todos <ArrowRight size={14} /></Link>
              </div>
              <div className="rx-order-list">
                {orders.map((sale) => <OrderListItem key={sale.id} sale={sale} />)}
                {!orders.length && <div className="rx-empty">Todavia no tenes pedidos registrados.</div>}
              </div>
            </section>

            <section className="rx-metric-grid">
              <CompactMetricCard featured label="Comision disponible" value={formatGs(summary?.unpaidConfirmedCommission)} hint="Para el proximo cierre" />
              <CompactMetricCard label="Comision en proceso" value={formatGs(summary?.estimatedCommission)} hint="Se confirma al entregar" />
              <CompactMetricCard label="Ventas esta semana" value={summary?.currentPeriodDeliveredSales || 0} hint="Periodo lunes a sabado" />
              <CompactMetricCard label="Comision esta semana" value={formatGs(summary?.currentPeriodCommission)} hint="Ventas entregadas" />
            </section>
          </>
        )}
      </div>
    </ResellerPanelLayout>
  )
}
