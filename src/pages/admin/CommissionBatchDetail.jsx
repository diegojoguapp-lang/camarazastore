import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getCommissionBatch, getEligibleSalesForBatch, getPaymentsForBatch, groupSalesByReseller } from '../../lib/adminCommissionsApi'
import { batchStatusLabel, paymentStatusLabel } from '../../lib/commissionConstants'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'

export function CommissionBatchDetail() {
  const { id } = useParams()
  const [batch, setBatch] = useState(null)
  const [groups, setGroups] = useState([])
  const [payments, setPayments] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const paidByReseller = useMemo(() => new Map(payments.map((payment) => [payment.reseller_id, payment])), [payments])

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const batchData = await getCommissionBatch(id)
        const [sales, paymentRows] = await Promise.all([getEligibleSalesForBatch(batchData), getPaymentsForBatch(id)])
        setBatch(batchData)
        setGroups(groupSalesByReseller(sales))
        setPayments(paymentRows)
      } catch (err) {
        setError(err.message || 'No se pudo cargar el lote.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return <div className="admin-page"><p>Cargando...</p></div>
  if (!batch) return <div className="admin-page"><div className="error-box">Lote no encontrado.</div></div>

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div>
          <p className="eyebrow">Comisiones</p>
          <h1>Lote semanal</h1>
          <p>{formatDatePy(batch.period_start)} al {formatDatePy(batch.period_end)} - {batchStatusLabel(batch.status)}</p>
        </div>
        <Link className="secondary-button" to="/admin/comisiones"><ArrowLeft size={16} /> Volver</Link>
      </div>
      {error && <div className="error-box">{error}</div>}

      <section className="panel">
        <h2>Revendedores a pagar</h2>
        <div className="commission-group-list">
          {groups.map((group) => {
            const payment = paidByReseller.get(group.reseller_id)
            return (
              <article className="commission-group-card" key={group.reseller_id}>
                <div>
                  <h3>{group.reseller?.reseller_code} - {group.reseller?.full_name}</h3>
                  <p>{group.sales.length} ventas incluidas</p>
                </div>
                <strong>{formatGs(group.total)}</strong>
                {payment ? (
                  <span className="sale-status">{paymentStatusLabel(payment.status)}</span>
                ) : (
                  <Link className="primary-button" to={`/admin/comisiones/${batch.id}/pagar/${group.reseller_id}`}>Crear pago</Link>
                )}
              </article>
            )
          })}
          {!groups.length && <div className="empty-state">No hay comisiones pendientes en este lote.</div>}
        </div>
      </section>
    </div>
  )
}
