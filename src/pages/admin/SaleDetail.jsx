import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil } from 'lucide-react'
import { getAdminSaleById, getSaleEvents, updateSaleStatus } from '../../lib/adminSalesApi'
import { formatDateTimePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'
import { SALE_STATUSES, saleStatusLabel } from '../../lib/salesConstants'

function DetailItem({ label, value }) {
  return <div><span>{label}</span><strong>{value || '-'}</strong></div>
}

export function SaleDetail() {
  const { id } = useParams()
  const [sale, setSale] = useState(null)
  const [events, setEvents] = useState([])
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const [saleData, eventRows] = await Promise.all([getAdminSaleById(id), getSaleEvents(id)])
      setSale(saleData)
      setStatus(saleData.status)
      setEvents(eventRows)
    } catch (err) {
      setError(err.message || 'No se pudo cargar la venta.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const submitStatus = async (event) => {
    event.preventDefault()
    if (!status || status === sale.status) return
    try {
      setSaving(true)
      setError('')
      setMessage('')
      await updateSaleStatus(id, status, notes)
      setNotes('')
      setMessage('Estado actualizado.')
      load()
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el estado.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="admin-page"><p>Cargando...</p></div>
  if (!sale) return <div className="admin-page"><div className="error-box">Venta no encontrada.</div></div>

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div>
          <p className="eyebrow">Venta</p>
          <h1>{sale.product_name_snapshot}</h1>
        </div>
        <div className="form-actions-row">
          <Link className="secondary-button" to="/admin/ventas"><ArrowLeft size={16} /> Volver</Link>
          <Link className="primary-button" to={`/admin/ventas/${sale.id}/editar`}><Pencil size={16} /> Editar</Link>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <div className="detail-grid">
        <section className="panel">
          <h2>Estado</h2>
          <span className={`sale-status status-${sale.status}`}>{saleStatusLabel(sale.status)}</span>
          <form className="status-change-form" onSubmit={submitStatus}>
            <label>Cambiar estado<select value={status} onChange={(e) => setStatus(e.target.value)}>{SALE_STATUSES.map((item) => <option key={item} value={item}>{saleStatusLabel(item)}</option>)}</select></label>
            <label>Nota opcional<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            <button className="primary-button" type="submit" disabled={saving || status === sale.status}>{saving ? 'Guardando...' : 'Actualizar estado'}</button>
          </form>
        </section>

        <section className="panel">
          <h2>Cliente</h2>
          <div className="profile-summary">
            <DetailItem label="Nombre" value={sale.customer?.full_name} />
            <DetailItem label="Telefono" value={sale.customer?.phone} />
            <DetailItem label="Ciudad" value={sale.customer?.city} />
            <DetailItem label="Barrio" value={sale.customer?.neighborhood} />
            <DetailItem label="Direccion" value={sale.customer?.address} />
            <DetailItem label="Referencia" value={sale.customer?.reference} />
          </div>
        </section>

        <section className="panel">
          <h2>Revendedor y producto</h2>
          <div className="profile-summary">
            <DetailItem label="Revendedor" value={`${sale.reseller?.reseller_code || ''} ${sale.reseller?.full_name || ''}`} />
            <DetailItem label="Producto" value={sale.product_name_snapshot} />
            <DetailItem label="Modelo" value={sale.product_model_snapshot} />
            <DetailItem label="Cantidad" value={sale.quantity} />
          </div>
        </section>

        <section className="panel">
          <h2>Montos internos</h2>
          <div className="profile-summary">
            <DetailItem label="Precio producto" value={formatGs(sale.product_sale_price)} />
            <DetailItem label="Costo producto" value={formatGs(sale.product_cost)} />
            <DetailItem label="Delivery cobrado" value={formatGs(sale.delivery_charged)} />
            <DetailItem label="Costo delivery" value={formatGs(sale.delivery_cost)} />
            <DetailItem label="Comision" value={formatGs(sale.reseller_commission)} />
            <DetailItem label="Otros costos" value={formatGs(sale.other_costs)} />
            <DetailItem label="Total cobrado" value={formatGs(sale.total_collected)} />
            <DetailItem label="Ganancia Camaraza" value={formatGs(sale.camaraza_net_profit)} />
          </div>
        </section>

        <section className="panel">
          <h2>Entrega y pago</h2>
          <div className="profile-summary">
            <DetailItem label="Direccion entrega" value={sale.delivery_address} />
            <DetailItem label="Horario" value={sale.delivery_schedule} />
            <DetailItem label="Mapa" value={sale.delivery_map_url} />
            <DetailItem label="Forma de pago" value={sale.payment_method} />
            <DetailItem label="Monto recibido" value={formatGs(sale.amount_received)} />
            <DetailItem label="Entregado" value={formatDateTimePy(sale.delivered_at)} />
          </div>
        </section>

        <section className="panel">
          <h2>Linea de tiempo</h2>
          <div className="timeline-list">
            {events.map((item) => (
              <div key={item.id}>
                <strong>{item.event_type}</strong>
                <span>{formatDateTimePy(item.created_at)}</span>
                <p>{item.from_status ? `${saleStatusLabel(item.from_status)} -> ${saleStatusLabel(item.to_status)}` : saleStatusLabel(item.to_status)}</p>
                {item.notes && <p>{item.notes}</p>}
              </div>
            ))}
            {!events.length && <p>No hay eventos todavia.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
