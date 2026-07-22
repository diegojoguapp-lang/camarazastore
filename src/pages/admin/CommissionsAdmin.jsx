import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { createCommissionBatch, getCommissionBatches, getEligibleSalesForBatch, getPaymentsForBatch, groupSalesByReseller } from '../../lib/adminCommissionsApi'
import { getCurrentCommissionPeriod } from '../../lib/dateUtils'
import { batchStatusLabel } from '../../lib/commissionConstants'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'

export function CommissionsAdmin() {
  const [batches, setBatches] = useState([])
  const [stats, setStats] = useState({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const totals = useMemo(() => batches.reduce((acc, batch) => {
    const item = stats[batch.id] || {}
    acc.pending += item.pending || 0
    acc.paid += item.paid || 0
    return acc
  }, { pending: 0, paid: 0 }), [batches, stats])

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const rows = await getCommissionBatches()
      setBatches(rows)
      const nextStats = {}
      for (const batch of rows) {
        const [sales, payments] = await Promise.all([getEligibleSalesForBatch(batch), getPaymentsForBatch(batch.id)])
        nextStats[batch.id] = {
          resellers: groupSalesByReseller(sales).length || payments.length,
          pending: sales.reduce((sum, sale) => sum + Number(sale.reseller_commission || 0), 0),
          paid: payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + Number(payment.net_paid || 0), 0)
        }
      }
      setStats(nextStats)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las comisiones.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const createCurrentBatch = async () => {
    try {
      setCreating(true)
      setError('')
      setMessage('')
      await createCommissionBatch(getCurrentCommissionPeriod(), 'Cierre semanal de comisiones')
      setMessage('Lote creado correctamente.')
      load()
    } catch (err) {
      setError(err.message || 'No se pudo crear el lote. Puede que ya exista para este periodo.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Comisiones</h1>
        </div>
        <button className="primary-button" type="button" onClick={createCurrentBatch} disabled={creating}>
          <Plus size={16} /> {creating ? 'Creando...' : 'Crear lote actual'}
        </button>
      </div>
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <div className="stats-grid sales-stats">
        <div className="stat-card"><span>Lotes</span><strong>{batches.length}</strong></div>
        <div className="stat-card"><span>Total pendiente</span><strong>{formatGs(totals.pending)}</strong></div>
        <div className="stat-card"><span>Total pagado</span><strong>{formatGs(totals.paid)}</strong></div>
      </div>

      <div className="table-wrap">
        {loading && <p className="table-loading">Cargando lotes...</p>}
        {!loading && (
          <table className="admin-table commission-table">
            <thead><tr><th>Periodo</th><th>Revendedores</th><th>Pendiente</th><th>Pagado</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td>{formatDatePy(batch.period_start)} al {formatDatePy(batch.period_end)}</td>
                  <td>{stats[batch.id]?.resellers || 0}</td>
                  <td>{formatGs(stats[batch.id]?.pending || 0)}</td>
                  <td>{formatGs(stats[batch.id]?.paid || 0)}</td>
                  <td><span className="sale-status">{batchStatusLabel(batch.status)}</span></td>
                  <td><Link className="primary-button" to={`/admin/comisiones/${batch.id}`}>Abrir lote</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !batches.length && <div className="empty-state">Todavia no hay lotes de comisiones.</div>}
      </div>
    </div>
  )
}
