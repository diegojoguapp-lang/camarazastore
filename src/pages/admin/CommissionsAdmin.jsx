import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Plus } from 'lucide-react'
import { AdminDataTable, AdminMetric, AdminPageHeader, AdminStatusBadge, DateCell, MoneyCell, RowActions } from '../../components/AdminUX'
import { createCommissionBatch, getCommissionBatches, getEligibleSalesForBatch, getPaymentsForBatch, groupSalesByReseller } from '../../lib/adminCommissionsApi'
import { getCurrentCommissionPeriod, formatDatePy } from '../../lib/dateUtils'
import { batchStatusLabel } from '../../lib/commissionConstants'

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

  const columns = [
    { key: 'period', label: 'Periodo', render: (batch) => `${formatDatePy(batch.period_start)} al ${formatDatePy(batch.period_end)}` },
    { key: 'payment_day', label: 'Pago', render: (batch) => <DateCell value={batch.payment_day} /> },
    { key: 'resellers', label: 'Revendedores', align: 'right', render: (batch) => stats[batch.id]?.resellers || 0 },
    { key: 'pending', label: 'Pendiente', align: 'right', render: (batch) => <MoneyCell value={stats[batch.id]?.pending || 0} /> },
    { key: 'paid', label: 'Pagado', align: 'right', render: (batch) => <MoneyCell value={stats[batch.id]?.paid || 0} /> },
    { key: 'status', label: 'Estado', render: (batch) => <AdminStatusBadge tone={batch.status === 'paid' ? 'success' : 'neutral'}>{batchStatusLabel(batch.status)}</AdminStatusBadge> },
    { key: 'actions', label: 'Acciones', render: (batch) => <RowActions><Link to={`/admin/comisiones/${batch.id}`}><Eye size={14} /> Abrir</Link></RowActions> }
  ]

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader
        eyebrow="Finanzas"
        title="Comisiones"
        description="Lotes semanales, pagos realizados y saldos pendientes por revendedor."
        actions={<button className="primary-button" type="button" onClick={createCurrentBatch} disabled={creating}><Plus size={16} /> {creating ? 'Creando...' : 'Crear lote actual'}</button>}
      />
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <div className="ax-metric-grid">
        <AdminMetric label="Lotes" value={batches.length} />
        <AdminMetric label="Total pendiente" value={<MoneyCell value={totals.pending} />} featured />
        <AdminMetric label="Total pagado" value={<MoneyCell value={totals.paid} />} />
      </div>

      <AdminDataTable
        columns={columns}
        rows={batches}
        loading={loading}
        empty="Todavia no hay lotes de comisiones."
      />
    </div>
  )
}
