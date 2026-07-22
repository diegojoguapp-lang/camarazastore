import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Banknote, CalendarClock, ReceiptText, WalletCards } from 'lucide-react'
import { ResellerPanelLayout } from '../../components/ResellerPanelLayout'
import { getMyCommissionPayments } from '../../lib/resellerCommissionsApi'
import { getMySalesSummary } from '../../lib/resellerSalesApi'
import { paymentStatusLabel } from '../../lib/commissionConstants'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'

export function PanelPayments() {
  const [payments, setPayments] = useState([])
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const [paymentRows, summaryData] = await Promise.all([getMyCommissionPayments(), getMySalesSummary()])
      setPayments(paymentRows)
      setSummary(summaryData)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar tus pagos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const lastPayment = useMemo(() => payments.find((payment) => payment.status === 'paid'), [payments])

  return (
    <ResellerPanelLayout>
      <div className="reseller-dashboard-page">
        <header className="reseller-dashboard-head">
          <div>
            <p className="eyebrow">Comisiones</p>
            <h1>Mis pagos</h1>
            <p>Historial de comisiones depositadas por Camaraza Store.</p>
          </div>
        </header>

        {error && <div className="error-box">{error} <button className="secondary-button" type="button" onClick={load}>Reintentar</button></div>}
        {loading && <div className="panel">Cargando pagos...</div>}

        {!loading && (
          <>
            <section className="reseller-metrics-grid payments">
              <article className="reseller-metric-card featured tone-success"><WalletCards size={22} /><span>Pendiente de cobrar</span><strong>{formatGs(summary?.unpaidConfirmedCommission)}</strong><p>Disponible para proximo cierre</p></article>
              <article className="reseller-metric-card"><Banknote size={22} /><span>Total cobrado</span><strong>{formatGs(summary?.totalPaidCommission)}</strong><p>Pagos con estado pagado</p></article>
              <article className="reseller-metric-card"><ReceiptText size={22} /><span>Ultimo pago</span><strong>{lastPayment ? formatGs(lastPayment.net_paid) : '-'}</strong><p>{lastPayment ? formatDatePy(lastPayment.payment_date) : 'Sin pagos aun'}</p></article>
              <article className="reseller-metric-card"><CalendarClock size={22} /><span>Proximo pago</span><strong>{formatDatePy(summary?.nextPaymentDate)}</strong><p>Lunes de 10:00 a 17:00</p></article>
            </section>

            <section className="panel reseller-sales-table-panel">
              <div className="section-title">
                <h2>Historial</h2>
                <span>{payments.length} pagos</span>
              </div>
              {!!payments.length && (
                <div className="reseller-sales-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Periodo</th>
                        <th>Estado</th>
                        <th>Monto</th>
                        <th>Fecha</th>
                        <th>Banco</th>
                        <th>Comprobante</th>
                        <th>Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id}>
                          <td>{formatDatePy(payment.batch?.period_start)} al {formatDatePy(payment.batch?.period_end)}</td>
                          <td><span className={`sale-status status-${payment.status}`}>{paymentStatusLabel(payment.status)}</span></td>
                          <td><strong>{formatGs(payment.net_paid)}</strong></td>
                          <td>{formatDatePy(payment.payment_date)}</td>
                          <td>{payment.bank_name_snapshot || '-'}</td>
                          <td>{payment.voucher_url ? <a href={payment.voucher_url} target="_blank" rel="noreferrer">Ver</a> : '-'}</td>
                          <td><Link to={`/panel/pagos/${payment.id}`}>Ver detalle <ArrowRight size={14} /></Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="reseller-sale-card-list">
                {payments.map((payment) => (
                  <article className="reseller-sale-mobile-card" key={payment.id}>
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
              </div>
              {!payments.length && <div className="empty-state">No tenes pagos registrados todavia. Cuando una comision sea depositada aparecera aca.</div>}
            </section>
          </>
        )}
      </div>
    </ResellerPanelLayout>
  )
}
