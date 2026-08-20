import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ResellerPanelLayout } from '../../components/ResellerPanelLayout'
import { getMyCommissionPayment, getMyCommissionPaymentAdjustments, getMyCommissionPaymentItems } from '../../lib/resellerCommissionsApi'
import { paymentStatusLabel } from '../../lib/commissionConstants'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'

export function PanelPaymentDetail() {
  const { id } = useParams()
  const [payment, setPayment] = useState(null)
  const [items, setItems] = useState([])
  const [adjustments, setAdjustments] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getMyCommissionPayment(id), getMyCommissionPaymentItems(id), getMyCommissionPaymentAdjustments(id)])
      .then(([paymentData, itemRows, adjustmentRows]) => {
        setPayment(paymentData)
        setItems(itemRows)
        setAdjustments(adjustmentRows)
      })
      .catch((err) => setError(err.message || 'No se pudo cargar el pago.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <ResellerPanelLayout><div className="reseller-dashboard-page"><div className="panel">Cargando pago...</div></div></ResellerPanelLayout>
  if (!payment) return <ResellerPanelLayout><div className="reseller-dashboard-page"><div className="error-box">Pago no encontrado.</div></div></ResellerPanelLayout>

  return (
    <ResellerPanelLayout>
      <div className="reseller-dashboard-page">
        <Link className="back-link" to="/panel/pagos"><ArrowLeft size={16} /> Volver</Link>
        <div className="panel">
          <p className="eyebrow">Pago</p>
          <h1>{formatGs(payment.net_paid)}</h1>
          <p>{paymentStatusLabel(payment.status)} - {formatDatePy(payment.payment_date)}</p>
          {error && <div className="error-box">{error}</div>}
          <div className="profile-summary">
            <div><span>Banco</span><strong>{payment.bank_name_snapshot || '-'}</strong></div>
            <div><span>Alias</span><strong>{payment.bank_alias_snapshot || '-'}</strong></div>
            <div><span>Periodo</span><strong>{formatDatePy(payment.batch?.period_start)} al {formatDatePy(payment.batch?.period_end)}</strong></div>
            <div><span>Descuentos</span><strong>{formatGs(payment.discounts || 0)}</strong></div>
            <div><span>Comprobante</span><strong>{payment.voucher_url ? <a href={payment.voucher_url} target="_blank" rel="noreferrer">Ver</a> : '-'}</strong></div>
          </div>
        </div>
        <section className="panel">
          <h2>Ventas incluidas</h2>
          <div className="commission-items-list">
            {items.map((item) => (
              <div key={item.id}>
                <span>{formatDatePy(item.sale?.delivered_at)} - {item.sale?.product_name_snapshot}</span>
                <strong>{formatGs(item.commission_amount_snapshot)}</strong>
              </div>
            ))}
          </div>
        </section>
        {adjustments.length > 0 && (
          <section className="panel">
            <h2>Ajustes aplicados</h2>
            <div className="commission-items-list">
              {adjustments.map((item) => (
                <div key={item.id}>
                  <span>{item.adjustment?.reason || 'Ajuste de comision'}</span>
                  <strong>{formatGs(item.amount_applied)}</strong>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </ResellerPanelLayout>
  )
}
