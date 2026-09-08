import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { ResellerPanelLayout } from '../../components/ResellerPanelLayout'
import { CompactPageHeader, OrderListItem } from '../../components/ResellerUX'
import { getCurrentProfile } from '../../lib/roles'
import { getMyOperationHome } from '../../lib/operationApi'
import { CommissionBalances } from '../../components/CommissionBalances'
import { formatGs } from '../../lib/utils'

export function PanelHome() {
  const [profile, setProfile] = useState(null)
  const [summary, setSummary] = useState(null)
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('confirmed')

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const [profileData, summaryData] = await Promise.all([
        getCurrentProfile(),
        getMyOperationHome()
      ])
      setProfile(profileData)
      setSummary(summaryData)
      setOrders(summaryData.today.rows)
    } catch (err) {
      setError(err.message || 'No se pudo cargar tu inicio.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <ResellerPanelLayout>
      <div className="rx-page ov-home">
        <CompactPageHeader profile={profile} title={`Hola, ${profile?.full_name?.split(' ')[0] || 'revendedor'}`} />

        {error && <div className="error-box">{error} <button className="secondary-button" type="button" onClick={load}>Reintentar</button></div>}
        {loading && <div className="rx-skeleton-list"><span /><span /><span /></div>}

        {!loading && (
          <>
            <section className="rx-section">
              <div className="rx-section-head">
                <h2>Pedidos de hoy</h2>
                <Link to="/panel/ventas">Ver todos <ArrowRight size={14} /></Link>
              </div>
              <div className="ov-today-tabs">{[['confirmed', 'Coordinado'], ['out_for_delivery', 'En camino'], ['delivered_paid', 'Entregado']].map(([key, label]) => <button className={status === key ? 'active' : ''} onClick={() => setStatus(key)} key={key}>{label}<b>{summary?.counts?.[key] ?? orders.filter((sale) => sale.status === key).length}</b></button>)}</div>
              <div className="rx-order-list">
                {orders.filter((sale) => sale.status === status).map((sale) => <OrderListItem key={sale.id} sale={sale} />)}
                {!orders.some((sale) => sale.status === status) && <div className="rx-empty">No hay pedidos en este estado.</div>}
              </div>
            </section>

            <CommissionBalances balances={summary?.balances} />
            <section className="ov-period-grid">{summary?.weeks?.map((week, index) => <div key={week.start_date}><h3>{index === 0 ? 'Esta semana' : 'Semana anterior'}</h3><p>{week.orders} pedidos · {week.delivered} entregados</p><p>{week.out_for_delivery || 0} en camino</p><p>Ventas: {formatGs(week.sales)}</p><p>Comision: {formatGs(week.commission)}</p></div>)}</section>
            <p>Comisiones: lunes a sabado. Pago: lunes de 10:00 a 17:00. Si es feriado, martes. Domingo no trabajamos.</p>
          </>
        )}
      </div>
    </ResellerPanelLayout>
  )
}
