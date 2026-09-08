import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { operationRpc } from '../lib/operationApi'
import { orderCode } from '../lib/operationDates'
import { formatDatePy } from '../lib/dateUtils'
import { formatGs } from '../lib/utils'
import './operationUX.css'

export const commissionBuckets = [['estimated', 'Por confirmar'], ['available', 'Disponible'], ['liquidating', 'En liquidacion'], ['paid', 'Pagado']]

export function CommissionBalances({ balances, resellerId = null, admin = false }) {
  const [bucket, setBucket] = useState('')
  const [rows, setRows] = useState([])
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    if (!bucket) return
    setLoading(true); setError(''); setRows([])
    operationRpc('get_commission_sales_v2', { p_reseller_id: resellerId, p_bucket: bucket, p_offset: offset })
      .then((data) => { if (active) setRows(data) })
      .catch((err) => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [bucket, resellerId, offset])
  return <div className="ov-commissions">
    <div className="ov-balances">{commissionBuckets.map(([key, label]) => <button type="button" key={key} className={bucket === key ? 'selected' : ''} onClick={() => { setBucket(key); setOffset(0) }}><span>{label}</span><strong>{formatGs(balances?.[key])}</strong></button>)}</div>
    {Number(balances?.pending_adjustments || 0) !== 0 && <p>Ajustes pendientes: {formatGs(balances?.pending_adjustments)}</p>}
    {bucket && <section className="ov-breakdown">
      <header><h3>{commissionBuckets.find(([key]) => key === bucket)?.[1]} · Ventas</h3><button className="icon-button" aria-label="Cerrar detalle" onClick={() => setBucket('')}><X size={18} /></button></header>
      {error && <p role="alert" className="error-box">{error}</p>}
      {loading && <p role="status">Cargando...</p>}
      {!loading && rows.map((sale) => <Link key={sale.id} to={`${admin ? '/admin' : '/panel'}/ventas/${sale.id}`}><strong>{orderCode(sale)}</strong><span>{sale.product_name_snapshot}</span><small>{formatDatePy(sale.delivered_at)}</small><b>{formatGs(sale.reseller_commission)}</b></Link>)}
      {!loading && !rows.length && <p>Sin ventas en este estado.</p>}
      <div className="ov-pagination"><button className="icon-button" aria-label="Anterior" disabled={loading || offset === 0} onClick={() => setOffset((n) => Math.max(n - 50, 0))}><ChevronLeft /></button><button className="icon-button" aria-label="Siguiente" disabled={loading || rows.length < 50} onClick={() => setOffset((n) => n + 50)}><ChevronRight /></button></div>
      {bucket === 'liquidating' || bucket === 'paid' ? <Link to={admin ? '/admin/comisiones/pagos' : '/panel/pagos'}>Ver liquidaciones y ajustes</Link> : null}
    </section>}
  </div>
}
