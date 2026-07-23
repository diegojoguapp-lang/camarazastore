import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, WalletCards } from 'lucide-react'
import { AdminDataTable, AdminMetric, AdminPageHeader, AdminStatusBadge, MoneyCell, RowActions } from '../../components/AdminUX'
import { getCommissionBatch, getEligibleSalesForBatch, getPaymentsForBatch, groupSalesByReseller } from '../../lib/adminCommissionsApi'
import { batchStatusLabel, paymentStatusLabel } from '../../lib/commissionConstants'
import { formatDatePy } from '../../lib/dateUtils'

export function CommissionBatchDetail() {
  const { id } = useParams()
  const [batch, setBatch] = useState(null)
  const [groups, setGroups] = useState([])
  const [payments, setPayments] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const paidByReseller = useMemo(() => new Map(payments.map((payment) => [payment.reseller_id, payment])), [payments])
  const totals = useMemo(() => ({
    pending: groups.reduce((sum, group) => sum + Number(group.total || 0), 0),
    paid: payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + Number(payment.net_paid || 0), 0)
  }), [groups, payments])

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

  if (loading) return <div className="admin-page ax-page"><p>Cargando...</p></div>
  if (!batch) return <div className="admin-page ax-page"><div className="error-box">Lote no encontrado.</div></div>

  const columns = [
    { key: 'reseller', label: 'Revendedor', render: (group) => `${group.reseller?.reseller_code || '-'} - ${group.reseller?.full_name || 'Sin nombre'}` },
    { key: 'sales', label: 'Ventas', align: 'right', render: (group) => group.sales.length },
    { key: 'total', label: 'Comision', align: 'right', render: (group) => <MoneyCell value={group.total} /> },
    { key: 'payment', label: 'Pago', render: (group) => {
      const payment = paidByReseller.get(group.reseller_id)
      return payment ? <AdminStatusBadge tone={payment.status === 'paid' ? 'success' : 'neutral'}>{paymentStatusLabel(payment.status)}</AdminStatusBadge> : <AdminStatusBadge tone="warning">Pendiente</AdminStatusBadge>
    } },
    { key: 'actions', label: 'Acciones', render: (group) => {
      const payment = paidByReseller.get(group.reseller_id)
      return (
        <RowActions>
          {payment
            ? <Link to={`/admin/comisiones/pagos/${payment.id}`}><Eye size={14} /> Ver pago</Link>
            : <Link to={`/admin/comisiones/${batch.id}/pagar/${group.reseller_id}`}><WalletCards size={14} /> Crear pago</Link>}
        </RowActions>
      )
    } }
  ]

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader
        eyebrow="Comisiones"
        title="Lote semanal"
        description={`${formatDatePy(batch.period_start)} al ${formatDatePy(batch.period_end)} - ${batchStatusLabel(batch.status)}`}
        actions={<Link className="secondary-button" to="/admin/comisiones"><ArrowLeft size={16} /> Volver</Link>}
      />
      {error && <div className="error-box">{error}</div>}

      <div className="ax-metric-grid">
        <AdminMetric label="Revendedores" value={groups.length || payments.length} />
        <AdminMetric label="Pendiente" value={<MoneyCell value={totals.pending} />} featured />
        <AdminMetric label="Pagado" value={<MoneyCell value={totals.paid} />} />
      </div>

      <AdminDataTable
        columns={columns}
        rows={groups}
        loading={false}
        empty="No hay comisiones pendientes en este lote."
        getKey={(group) => group.reseller_id}
      />
    </div>
  )
}
