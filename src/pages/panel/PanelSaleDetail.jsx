import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ResellerPanelLayout } from '../../components/ResellerPanelLayout'
import { OrderTimeline, StatusBadge } from '../../components/ResellerUX'
import { commissionState, getMySales } from '../../lib/resellerSalesApi'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'
import { shortOrderId } from '../../lib/resellerDisplay'

export function PanelSaleDetail() {
  const { id } = useParams()
  const [sale, setSale] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMySales({ limit: 100 })
      .then((rows) => setSale(rows.find((item) => item.id === id || item.sale_id === id) || null))
      .catch((err) => setError(err.message || 'No se pudo cargar el pedido.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <ResellerPanelLayout><div className="rx-page"><div className="rx-empty">Cargando pedido...</div></div></ResellerPanelLayout>

  return (
    <ResellerPanelLayout>
      <div className="rx-page">
        <Link className="back-link" to="/panel/ventas"><ArrowLeft size={16} /> Volver</Link>
        {error && <div className="error-box">{error}</div>}
        {!sale ? (
          <div className="rx-empty">Pedido no encontrado.</div>
        ) : (
          <>
            <section className="rx-detail-hero">
              <div>
                <span>Orden {shortOrderId(sale.id)}</span>
                <h1>{sale.product_name_snapshot}</h1>
                <p>{sale.customer_name} {sale.customer_phone_masked ? `- ${sale.customer_phone_masked}` : ''}</p>
              </div>
              <StatusBadge status={sale.status} />
            </section>

            <section className="rx-metric-grid">
              <div className="rx-finance-row"><span>Monto total</span><strong>{formatGs(sale.total_collected || sale.product_sale_price)}</strong></div>
              <div className="rx-finance-row"><span>Comision</span><strong>{formatGs(sale.reseller_commission)}</strong></div>
              <div className="rx-finance-row"><span>Estado comision</span><strong>{commissionState(sale)}</strong></div>
              <div className="rx-finance-row"><span>Fecha</span><strong>{formatDatePy(sale.delivered_at || sale.created_at)}</strong></div>
            </section>

            <section className="rx-section">
              <div className="rx-section-head"><h2>Seguimiento</h2></div>
              <OrderTimeline sale={sale} />
            </section>
          </>
        )}
      </div>
    </ResellerPanelLayout>
  )
}
