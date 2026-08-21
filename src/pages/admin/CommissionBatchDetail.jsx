import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, WalletCards } from 'lucide-react'
import { AdminDataTable, AdminMetric, AdminPageHeader, AdminStatusBadge, MoneyCell, RowActions } from '../../components/AdminUX'
import { getFinancialAccounts } from '../../lib/adminFinanceApi'
import { createBulkCommissionPayments, getCommissionBatch, getCommissionBatchOverview, getPaymentsForBatch } from '../../lib/adminCommissionsApi'
import { batchStatusLabel, paymentStatusLabel } from '../../lib/commissionConstants'
import { formatDatePy } from '../../lib/dateUtils'

export function CommissionBatchDetail() {
  const { id } = useParams()
  const [batch, setBatch] = useState(null)
  const [groups, setGroups] = useState([])
  const [payments, setPayments] = useState([])
  const [accounts, setAccounts] = useState([])
  const [selected, setSelected] = useState([])
  const [bulkAccountId, setBulkAccountId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)

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
        const [overview, paymentRows, accountRows] = await Promise.all([getCommissionBatchOverview(id), getPaymentsForBatch(id), getFinancialAccounts()])
        setBatch(batchData)
        setGroups(overview.map((row) => ({
          reseller: {
            id: row.reseller_id,
            reseller_code: row.reseller_code,
            full_name: row.reseller_name,
            email: row.reseller_email,
            phone: row.reseller_phone
          },
          reseller_id: row.reseller_id,
          sales: Array.from({ length: Number(row.sales_count || 0) }),
          total: Number(row.gross_commission || 0),
          adjustments: Number(row.pending_adjustments || 0),
          net: Number(row.net_commission || 0),
          has_bank_account: Boolean(row.has_bank_account),
          can_pay: Boolean(row.can_pay),
          reason: row.reason
        })))
        setPayments(paymentRows)
        setAccounts(accountRows.filter((account) => account.is_active))
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
    { key: 'select', label: '', render: (group) => {
      const payment = paidByReseller.get(group.reseller_id)
      return <input type="checkbox" checked={selected.includes(group.reseller_id)} disabled={Boolean(payment) || !group.can_pay} onChange={(event) => setSelected((prev) => event.target.checked ? [...prev, group.reseller_id] : prev.filter((id) => id !== group.reseller_id))} />
    } },
    { key: 'reseller', label: 'Revendedor', render: (group) => `${group.reseller?.reseller_code || '-'} - ${group.reseller?.full_name || 'Sin nombre'}` },
    { key: 'sales', label: 'Ventas', align: 'right', render: (group) => group.sales.length },
    { key: 'total', label: 'Comision', align: 'right', render: (group) => <MoneyCell value={group.total} /> },
    { key: 'adjustments', label: 'Ajustes', align: 'right', render: (group) => <MoneyCell value={group.adjustments} /> },
    { key: 'net', label: 'Neto', align: 'right', render: (group) => <MoneyCell value={group.net} /> },
    { key: 'bank', label: 'Banco', render: (group) => group.has_bank_account ? <AdminStatusBadge tone="success">Cargado</AdminStatusBadge> : <AdminStatusBadge tone="warning">Falta banco</AdminStatusBadge> },
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
            : <Link className={!group.can_pay ? 'disabled-link' : ''} to={group.can_pay ? `/admin/comisiones/${batch.id}/pagar/${group.reseller_id}` : '#'}><WalletCards size={14} /> Crear pago</Link>}
        </RowActions>
      )
    } }
  ]

  const paySelected = async () => {
    if (!selected.length) return
    try {
      setPaying(true)
      setError('')
      setMessage('')
      await createBulkCommissionPayments({
        batchId: batch.id,
        resellerIds: selected,
        form: {
          payment_date: new Date().toISOString().slice(0, 10),
          payment_method: 'transferencia',
          financial_account_id: bulkAccountId,
          notes: 'Pago multiple desde lote'
        }
      })
      setMessage('Pagos registrados correctamente.')
      setSelected([])
      const [overview, paymentRows] = await Promise.all([getCommissionBatchOverview(id), getPaymentsForBatch(id)])
      setGroups(overview.map((row) => ({
        reseller: { id: row.reseller_id, reseller_code: row.reseller_code, full_name: row.reseller_name, email: row.reseller_email, phone: row.reseller_phone },
        reseller_id: row.reseller_id,
        sales: Array.from({ length: Number(row.sales_count || 0) }),
        total: Number(row.gross_commission || 0),
        adjustments: Number(row.pending_adjustments || 0),
        net: Number(row.net_commission || 0),
        has_bank_account: Boolean(row.has_bank_account),
        can_pay: Boolean(row.can_pay),
        reason: row.reason
      })))
      setPayments(paymentRows)
    } catch (err) {
      setError(err.message || 'No se pudieron registrar los pagos seleccionados.')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader
        eyebrow="Comisiones"
        title="Lote semanal"
        description={`${formatDatePy(batch.period_start)} al ${formatDatePy(batch.period_end)} - ${batchStatusLabel(batch.status)}`}
        actions={<><select value={bulkAccountId} onChange={(event) => setBulkAccountId(event.target.value)}><option value="">Cuenta de pago</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><button className="primary-button" type="button" disabled={!selected.length || paying || !bulkAccountId} onClick={paySelected}><WalletCards size={16} /> {paying ? 'Pagando...' : 'Pagar seleccionados'}</button><Link className="secondary-button" to="/admin/comisiones"><ArrowLeft size={16} /> Volver</Link></>}
      />
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

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
