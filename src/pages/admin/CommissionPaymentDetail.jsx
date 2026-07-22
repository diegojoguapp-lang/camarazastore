import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getCommissionPayment, getPaymentItems } from '../../lib/adminCommissionsApi'
import { paymentStatusLabel } from '../../lib/commissionConstants'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'

export function CommissionPaymentDetail() {
  const { id } = useParams()
  const [payment, setPayment] = useState(null)
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [paymentData, itemRows] = await Promise.all([getCommissionPayment(id), getPaymentItems(id)])
        setPayment(paymentData)
        setItems(itemRows)
      } catch (err) {
        setError(err.message || 'No se pudo cargar el pago.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return <div className="admin-page"><p>Cargando...</p></div>
  if (!payment) return <div className="admin-page"><div className="error-box">Pago no encontrado.</div></div>

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div>
          <p className="eyebrow">Pago</p>
          <h1>{payment.reseller?.full_name}</h1>
          <p>{paymentStatusLabel(payment.status)} - {formatDatePy(payment.payment_date)}</p>
        </div>
        <Link className="secondary-button" to={`/admin/comisiones/${payment.batch_id}`}><ArrowLeft size={16} /> Volver</Link>
      </div>
      {error && <div className="error-box">{error}</div>}

      <section className="panel">
        <h2>Resumen</h2>
        <div className="profile-summary">
          <div><span>Banco</span><strong>{payment.bank_name_snapshot || '-'}</strong></div>
          <div><span>Alias</span><strong>{payment.bank_alias_snapshot || '-'}</strong></div>
          <div><span>Total comision</span><strong>{formatGs(payment.gross_commission)}</strong></div>
          <div><span>Neto pagado</span><strong>{formatGs(payment.net_paid)}</strong></div>
          <div><span>Comprobante</span><strong>{payment.voucher_url ? <a href={payment.voucher_url} target="_blank" rel="noreferrer">Ver</a> : '-'}</strong></div>
          <div><span>Nro.</span><strong>{payment.voucher_number || '-'}</strong></div>
        </div>
      </section>

      <section className="panel">
        <h2>Ventas pagadas</h2>
        <div className="commission-items-list">
          {items.map((item) => (
            <div key={item.id}>
              <span>{formatDatePy(item.sale?.delivered_at)} - {item.sale?.product_name_snapshot}</span>
              <strong>{formatGs(item.commission_amount_snapshot)}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
