import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminDataTable, AdminPageHeader, MoneyCell } from '../../components/AdminUX'
import { getCommissionBatches } from '../../lib/adminCommissionsApi'
import { supabase } from '../../lib/supabase'
import { formatDatePy } from '../../lib/dateUtils'
import { paymentStatusLabel } from '../../lib/commissionConstants'

export function CommissionPayments() {
  const [rows, setRows] = useState([])
  const [batches, setBatches] = useState([])
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    const load = async () => {
      try {
        const [result, batchRows] = await Promise.all([
          supabase.from('commission_payments').select('id,status,net_paid,payment_date,reseller:profiles(full_name),batch:commission_batches(period_start,period_end)').eq('status', status).order('created_at', { ascending: false }).order('id').range(page * 50, page * 50 + 49),
          getCommissionBatches()
        ])
        if (result.error) throw result.error
        if (active) { setRows(result.data); setBatches(batchRows) }
      } catch (err) { if (active) setError(err.message) }
      finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [page, status])
  return <div className="admin-page ax-page">
    <AdminPageHeader title="Liquidaciones" actions={<Link className="secondary-button" to="/admin/comisiones">Comisiones</Link>} />
    {error && <p role="alert" className="error-box">{error}</p>}
    <label>Estado<select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }}><option value="pending">En liquidacion</option><option value="paid">Pagado</option><option value="cancelled">Cancelado</option></select></label>
    <AdminDataTable rows={rows} loading={loading} empty="Sin liquidaciones en este estado." columns={[
      { key: 'reseller', label: 'Revendedor', render: (p) => p.reseller?.full_name },
      { key: 'period', label: 'Periodo', render: (p) => `${formatDatePy(p.batch?.period_start)} - ${formatDatePy(p.batch?.period_end)}` },
      { key: 'status', label: 'Estado', render: (p) => paymentStatusLabel(p.status) },
      { key: 'net', label: 'Neto', render: (p) => <MoneyCell value={p.net_paid} /> },
      { key: 'detail', label: 'Detalle', render: (p) => <Link to={`/admin/comisiones/pagos/${p.id}`}>Ver liquidacion</Link> }
    ]} />
    <div className="ax-actions"><button disabled={!page || loading} onClick={() => setPage((n) => n - 1)}>Anterior</button><button disabled={rows.length < 50 || loading} onClick={() => setPage((n) => n + 1)}>Siguiente</button></div>
    <section className="ax-panel"><h2>Lotes semanales</h2><AdminDataTable rows={batches} loading={loading} empty="Sin lotes registrados." columns={[
      { key: 'period_start', label: 'Desde', render: (b) => formatDatePy(b.period_start) },
      { key: 'period_end', label: 'Hasta', render: (b) => formatDatePy(b.period_end) },
      { key: 'detail', label: 'Accion', render: (b) => <Link to={`/admin/comisiones/${b.id}`}>Ver ventas y preparar liquidacion</Link> }
    ]} /></section>
  </div>
}
