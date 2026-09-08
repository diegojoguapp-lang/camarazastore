import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, MessageCircle, Pencil, Plus, RefreshCw, Truck } from 'lucide-react'
import { AdminPageHeader } from '../../components/AdminUX'
import { getDailyOperations, operationRpc } from '../../lib/operationApi'
import { businessDate, changeDue, customerWhatsApp, orderCode } from '../../lib/operationDates'
import { formatGs } from '../../lib/utils'
import './dailyOperations.css'

const columns = [['confirmed', 'Coordinado', Check], ['out_for_delivery', 'En camino', Truck], ['delivered_paid', 'Entregado', Check]]

export function DailyOperations() {
  const [day, setDay] = useState(businessDate)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')
  const pending = useRef(false)
  const generation = useRef(0)
  const load = async () => {
    const token = ++generation.current
    setLoading(true)
    try {
      const data = await getDailyOperations(day)
      if (token === generation.current) { setRows(data); setError('') }
    } catch (err) { if (token === generation.current) setError(err.message) }
    finally { if (token === generation.current) setLoading(false) }
  }
  useEffect(() => { setRows([]); load(); return () => { generation.current++ } }, [day])
  const act = async (sale, args) => {
    if (pending.current) return
    pending.current = true
    setBusy(sale.id)
    setError('')
    try {
      await operationRpc('admin_operate_sale_v2', { p_sale_id: sale.id, p_expected_status: sale.status, ...args })
      setMessage('Pedido actualizado.')
      await load()
    } catch (err) { setError(err.message) }
    finally { pending.current = false; setBusy('') }
  }
  return <div className="admin-page ax-page op-page">
    <AdminPageHeader title="Operacion de hoy" actions={<Link className="primary-button" to="/admin/ventas/nueva"><Plus size={16} /> Nueva venta</Link>} />
    <div className="op-toolbar"><label>Fecha<input type="date" required value={day} disabled={Boolean(busy)} onChange={(e) => e.target.value && setDay(e.target.value)} /></label><button className="icon-button" title="Actualizar" aria-label="Actualizar" disabled={loading} onClick={load}><RefreshCw size={18} /></button></div>
    {error && <div role="alert" className="error-box">{error}</div>}
    {message && <p role="status">{message}</p>}
    {loading && <p role="status">Cargando pedidos...</p>}
    <div className="op-board" aria-busy={loading}>
      {columns.map(([status, label, Icon]) => <section key={status} className={`op-column op-${status}`}>
        <h2><Icon size={18} /> {label}<b>{rows.filter((sale) => sale.status === status).length}</b></h2>
        {rows.filter((sale) => sale.status === status).map((sale) => {
          const items = [...sale.items].sort((a, b) => a.sort_order - b.sort_order)
          const phone = sale.customer_phone_snapshot || sale.customer?.phone
          const whatsapp = customerWhatsApp(phone)
          let change = null
          try { change = changeDue(sale.total_collected, sale.cash_tendered_amount) } catch { /* Datos previos: no inventar vuelto. */ }
          return <article className="op-order" key={sale.id}>
            <div className="op-order-top"><strong>{orderCode(sale)}</strong><span>{sale.sale_type === 'direct' ? 'Cliente final' : sale.reseller?.full_name || 'Revendedor'}</span></div>
            <div className="op-product"><img src={items[0]?.product?.main_image_url || '/placeholder.svg'} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder.svg' }} width="64" height="64" loading="lazy" decoding="async" alt="" /><div>{items.map((item) => <p key={item.id}>{item.quantity} x {item.product_name_snapshot}</p>)}{items.length > 1 && <small>+{items.length - 1} productos</small>}</div></div>
            <h3>{sale.customer_name_snapshot || sale.customer?.full_name || 'Cliente'}</h3><p>{phone || 'Sin telefono'}</p>
            <p>{({ delivery: 'Delivery', pickup: 'Retiro', shipping: 'Encomienda', transportadora: 'Encomienda' })[sale.fulfillment_type]} · {sale.delivery_city || 'Sin ciudad'}</p>
            <dl><div><dt>Productos</dt><dd>{formatGs(sale.product_sale_price)}</dd></div><div><dt>Delivery</dt><dd>{formatGs(sale.delivery_charged)}</dd></div><div><dt>Total a cobrar</dt><dd><strong>{formatGs(sale.total_collected)}</strong></dd></div><div><dt>{sale.payment_method === 'cash' ? 'Efectivo' : 'Transferencia'}</dt><dd>{sale.account?.name || 'Falta cuenta'}</dd></div>{change !== null && <div><dt>Vuelto</dt><dd>{formatGs(change)}</dd></div>}</dl>
            {status === 'confirmed' && <label className="op-contact"><input type="checkbox" checked={Boolean(sale.customer_contacted_at)} disabled={Boolean(busy)} onChange={(e) => act(sale, { p_contacted: e.target.checked })} /> Cliente contactado</label>}
            <div className="op-actions">{whatsapp ? <a className="secondary-button" href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a> : <button className="secondary-button" disabled><MessageCircle size={16} /> Sin WhatsApp</button>}<Link title="Ver o editar pedido" aria-label={`Ver ${orderCode(sale)}`} className="icon-button" to={`/admin/ventas/${sale.id}`}><Pencil size={16} /></Link></div>
            {status !== 'delivered_paid' && <button className="primary-button op-next" disabled={Boolean(busy) || loading} onClick={() => act(sale, { p_next_status: status === 'confirmed' ? 'out_for_delivery' : 'delivered_paid' })}>{busy === sale.id ? 'Guardando...' : status === 'confirmed' ? 'En camino' : 'Entregado y cobrado'}<ArrowRight size={16} /></button>}
          </article>
        })}
        {!loading && !rows.some((sale) => sale.status === status) && <p className="op-empty">Sin pedidos</p>}
      </section>)}
    </div>
  </div>
}
