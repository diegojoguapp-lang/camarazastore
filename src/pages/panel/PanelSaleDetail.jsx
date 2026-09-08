import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ResellerPanelLayout } from '../../components/ResellerPanelLayout'
import { OrderTimeline, StatusBadge } from '../../components/ResellerUX'
import { commissionState } from '../../lib/resellerSalesApi'
import { operationRpc } from '../../lib/operationApi'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'
import { orderCode } from '../../lib/operationDates'

export function PanelSaleDetail() {
  const { id } = useParams()
  const [sale, setSale] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    operationRpc('get_my_operation_sales_v2', { p_id: id })
      .then((result) => { if (active) setSale(result.rows[0] || null) })
      .catch((err) => setError(err.message || 'No se pudo cargar el pedido.'))
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
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
                <span>{orderCode(sale)}</span>
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

            {!!sale.items?.length && (
              <section className="rx-section">
                <div className="rx-section-head"><h2>Productos</h2></div>
                <div className="rx-sale-items-list">
                  {sale.items.map((item, index) => (
                    <div key={`${item.product_name}-${index}`} className="rx-finance-row">
                      <span>{item.quantity} x {item.product_name}{item.product_model ? ` ${item.product_model}` : ''}</span>
                      <strong>{formatGs(item.line_subtotal)}</strong>
                    </div>
                  ))}
                </div>
              </section>
            )}

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
