import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil } from 'lucide-react'
import { AdminPageHeader, AdminStatusBadge, MoneyCell, StickySummary } from '../../components/AdminUX'
import { getAdminSaleById, getSaleEvents, updateSaleStatus } from '../../lib/adminSalesApi'
import { formatDateTimePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'
import { SALE_STATUSES, fulfillmentTypeLabel, paymentMethodLabel, paymentTimingLabel, saleStatusLabel } from '../../lib/salesConstants'

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

  if (loading) return <div className="admin-page ax-page"><p>Cargando...</p></div>
  if (!sale) return <div className="admin-page ax-page"><div className="error-box">Venta no encontrada.</div></div>

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader
        eyebrow="Venta"
        title={sale.product_name_snapshot}
        description={`${sale.customer?.full_name || 'Cliente'} - ${sale.reseller?.full_name || 'Revendedor'}`}
        actions={(
          <>
            <Link className="secondary-button" to="/admin/ventas"><ArrowLeft size={16} /> Volver</Link>
            <Link className="primary-button" to={`/admin/ventas/${sale.id}/editar`}><Pencil size={16} /> Editar</Link>
          </>
        )}
      />

      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <div className="ax-detail-layout">
        <div className="ax-form-main">
          <section className="ax-panel">
            <h2>Cliente</h2>
            <div className="ax-info-grid">
              <DetailItem label="Nombre" value={sale.customer?.full_name} />
              <DetailItem label="Telefono" value={sale.customer?.phone} />
              <DetailItem label="Ciudad" value={sale.customer?.city} />
              <DetailItem label="Direccion" value={sale.customer?.address} />
              <DetailItem label="Referencia" value={sale.customer?.reference} />
              <DetailItem label="Pago adelantado" value={sale.customer?.requires_advance_payment ? 'Si' : 'No'} />
            </div>
          </section>

          <section className="ax-panel">
            <h2>Revendedor y producto</h2>
            <div className="ax-info-grid">
              <DetailItem label="Revendedor" value={`${sale.reseller?.reseller_code || ''} ${sale.reseller?.full_name || ''}`} />
              <DetailItem label="Producto" value={sale.product_name_snapshot} />
              <DetailItem label="Modelo" value={sale.product_model_snapshot} />
              <DetailItem label="Cantidad" value={sale.quantity} />
            </div>
          </section>

          <section className="ax-panel">
            <h2>Entrega y pago</h2>
            <div className="ax-info-grid">
              <DetailItem label="Ciudad" value={sale.delivery_city || sale.customer?.city} />
              <DetailItem label="Tipo de envio" value={fulfillmentTypeLabel(sale.fulfillment_type)} />
              <DetailItem label="Horario" value={sale.delivery_schedule} />
              <DetailItem label="Forma de pago" value={paymentMethodLabel(sale.payment_method)} />
              <DetailItem label="Momento del pago" value={paymentTimingLabel(sale.payment_timing)} />
              <DetailItem label="Entregado" value={formatDateTimePy(sale.delivered_at)} />
            </div>
          </section>

          <section className="ax-panel">
            <h2>Linea de tiempo</h2>
            <div className="ax-timeline-list">
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

        <StickySummary
          title="Resumen interno"
          items={[
            { label: 'Estado', value: <AdminStatusBadge tone={sale.status === 'delivered_paid' ? 'success' : 'neutral'}>{saleStatusLabel(sale.status)}</AdminStatusBadge> },
            { label: 'Precio producto', value: <MoneyCell value={sale.product_sale_price} /> },
            { label: 'Costo producto', value: <MoneyCell value={sale.product_cost} /> },
            { label: 'Envio cobrado', value: <MoneyCell value={sale.delivery_charged} /> },
            { label: 'Comision', value: <MoneyCell value={sale.reseller_commission} /> },
            { label: 'Total cobrado', value: <MoneyCell value={sale.total_collected} /> },
            { label: 'Ganancia Camaraza', value: <span className={Number(sale.camaraza_net_profit || 0) < 0 ? 'ax-negative' : ''}>{formatGs(sale.camaraza_net_profit)}</span> }
          ]}
        >
          <form className="ax-drawer-form" onSubmit={submitStatus}>
            <label>Cambiar estado<select value={status} onChange={(e) => setStatus(e.target.value)}>{SALE_STATUSES.map((item) => <option key={item} value={item}>{saleStatusLabel(item)}</option>)}</select></label>
            <label>Nota opcional<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            <button className="primary-button" type="submit" disabled={saving || status === sale.status}>{saving ? 'Guardando...' : 'Actualizar estado'}</button>
          </form>
        </StickySummary>
      </div>
    </div>
  )
}
