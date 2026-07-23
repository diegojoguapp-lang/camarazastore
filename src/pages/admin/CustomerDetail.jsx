import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { AdminDataTable, AdminMetric, AdminPageHeader, AdminStatusBadge, DateCell, MoneyCell, StickySummary } from '../../components/AdminUX'
import { getCustomerById, updateCustomer } from '../../lib/customerApi'
import { getAdminSales } from '../../lib/adminSalesApi'
import { saleStatusLabel } from '../../lib/salesConstants'

export function CustomerDetail() {
  const { id } = useParams()
  const [customer, setCustomer] = useState(null)
  const [form, setForm] = useState(null)
  const [sales, setSales] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const summary = useMemo(() => ({
    delivered: sales.filter((sale) => sale.status === 'delivered_paid').length,
    cancelled: sales.filter((sale) => sale.status === 'cancelled').length,
    failed: sales.filter((sale) => sale.status === 'failed_delivery').length,
    total: sales.filter((sale) => sale.status === 'delivered_paid').reduce((sum, sale) => sum + Number(sale.total_collected || 0), 0)
  }), [sales])

  const load = async () => {
    try {
      setLoading(true)
      const [customerData, saleRows] = await Promise.all([getCustomerById(id), getAdminSales()])
      setCustomer(customerData)
      setForm(customerData)
      setSales(saleRows.filter((sale) => sale.customer_id === id))
    } catch (err) {
      setError(err.message || 'No se pudo cargar el cliente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      setMessage('')
      const updated = await updateCustomer(id, form)
      setCustomer(updated)
      setForm(updated)
      setMessage('Cliente actualizado.')
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el cliente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="admin-page ax-page"><p>Cargando...</p></div>
  if (!customer || !form) return <div className="admin-page ax-page"><div className="error-box">Cliente no encontrado.</div></div>

  const columns = [
    { key: 'created_at', label: 'Fecha', render: (sale) => <DateCell value={sale.created_at} /> },
    { key: 'product', label: 'Producto', render: (sale) => <Link className="ax-inline-link" to={`/admin/ventas/${sale.id}`}>{sale.product_name_snapshot}</Link> },
    { key: 'reseller', label: 'Revendedor', render: (sale) => sale.reseller?.full_name || '-' },
    { key: 'status', label: 'Estado', render: (sale) => <AdminStatusBadge tone={sale.status === 'delivered_paid' ? 'success' : 'neutral'}>{saleStatusLabel(sale.status)}</AdminStatusBadge> },
    { key: 'total', label: 'Total', align: 'right', render: (sale) => <MoneyCell value={sale.total_collected} /> }
  ]

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader
        eyebrow="Cliente"
        title={customer.full_name}
        description="Datos de contacto, condiciones y compras asociadas."
        actions={<Link className="secondary-button" to="/admin/clientes"><ArrowLeft size={16} /> Volver</Link>}
      />
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <div className="ax-metric-grid">
        <AdminMetric label="Compras entregadas" value={summary.delivered} />
        <AdminMetric label="Total comprado" value={<MoneyCell value={summary.total} />} featured />
        <AdminMetric label="Canceladas" value={summary.cancelled} />
        <AdminMetric label="Fallidas" value={summary.failed} />
      </div>

      <div className="ax-detail-layout">
        <section className="ax-panel">
          <h2>Historial de compras</h2>
          <AdminDataTable
            columns={columns}
            rows={sales}
            loading={false}
            empty="Este cliente todavia no tiene ventas."
          />
        </section>

        <form className="ax-sale-form ax-side-form" onSubmit={submit}>
          <StickySummary
            title="Datos del cliente"
            items={[
              { label: 'Telefono', value: customer.phone || '-' },
              { label: 'Ciudad', value: customer.city || '-' },
              { label: 'Pago adelantado', value: customer.requires_advance_payment ? 'Si' : 'No' }
            ]}
          >
            <div className="ax-drawer-form">
              <label>Nombre<input value={form.full_name || ''} onChange={(e) => setField('full_name', e.target.value)} required /></label>
              <label>Telefono<input value={form.phone || ''} onChange={(e) => setField('phone', e.target.value)} required /></label>
              <label>Ciudad<input value={form.city || ''} onChange={(e) => setField('city', e.target.value)} /></label>
              <label>Barrio<input value={form.neighborhood || ''} onChange={(e) => setField('neighborhood', e.target.value)} /></label>
              <label>Direccion<input value={form.address || ''} onChange={(e) => setField('address', e.target.value)} /></label>
              <label>Mapa<input value={form.map_url || ''} onChange={(e) => setField('map_url', e.target.value)} /></label>
              <label>Referencia<input value={form.reference || ''} onChange={(e) => setField('reference', e.target.value)} /></label>
              <label>Notas<textarea value={form.notes || ''} onChange={(e) => setField('notes', e.target.value)} /></label>
              <label className="checkbox-label"><input type="checkbox" checked={form.requires_advance_payment} onChange={(e) => setField('requires_advance_payment', e.target.checked)} /> Requiere pago adelantado</label>
              <button className="primary-button" type="submit" disabled={saving}><Save size={16} /> {saving ? 'Guardando...' : 'Guardar cliente'}</button>
            </div>
          </StickySummary>
        </form>
      </div>
    </div>
  )
}
