import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getMyCommissionPayments } from '../../lib/resellerCommissionsApi'
import { paymentStatusLabel } from '../../lib/commissionConstants'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'

export function PanelPayments() {
  const [payments, setPayments] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyCommissionPayments()
      .then(setPayments)
      .catch((err) => setError(err.message || 'No se pudieron cargar tus pagos.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page reseller-panel-page">
      <section className="container narrow">
        <Link className="back-link" to="/panel"><ArrowLeft size={16} /> Volver</Link>
        <div className="panel">
          <p className="eyebrow">Mi panel</p>
          <h1>Mis pagos</h1>
          <p>Historial de comisiones pagadas por Camaraza Store.</p>
        </div>
        {error && <div className="error-box">{error}</div>}
        <div className="reseller-sale-list">
          {loading && <p>Cargando pagos...</p>}
          {!loading && payments.map((payment) => (
            <article className="panel reseller-sale-card" key={payment.id}>
              <span className={`sale-status status-${payment.status}`}>{paymentStatusLabel(payment.status)}</span>
              <h2>{formatGs(payment.net_paid)}</h2>
              <p>Periodo: {formatDatePy(payment.batch?.period_start)} al {formatDatePy(payment.batch?.period_end)}</p>
              <div className="profile-summary">
                <div><span>Fecha</span><strong>{formatDatePy(payment.payment_date)}</strong></div>
                <div><span>Banco</span><strong>{payment.bank_name_snapshot || '-'}</strong></div>
                <div><span>Alias</span><strong>{payment.bank_alias_snapshot || '-'}</strong></div>
                <div><span>Comprobante</span><strong>{payment.voucher_url ? 'Disponible' : '-'}</strong></div>
              </div>
              <Link className="primary-button full" to={`/panel/pagos/${payment.id}`}>Ver detalle</Link>
            </article>
          ))}
          {!loading && !payments.length && <div className="empty-state">Todavia no tenes pagos registrados.</div>}
        </div>
      </section>
    </div>
  )
}
