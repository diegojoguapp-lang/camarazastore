import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { getCustomerById, updateCustomer } from '../../lib/customerApi'
import { getAdminSales } from '../../lib/adminSalesApi'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'
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

  if (loading) return <div className="admin-page"><p>Cargando...</p></div>
  if (!customer || !form) return <div className="admin-page"><div className="error-box">Cliente no encontrado.</div></div>

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div>
          <p className="eyebrow">Cliente</p>
          <h1>{customer.full_name}</h1>
        </div>
        <Link className="secondary-button" to="/admin/clientes"><ArrowLeft size={16} /> Volver</Link>
      </div>
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <div className="stats-grid sales-stats">
        <div className="stat-card"><span>Compras entregadas</span><strong>{summary.delivered}</strong></div>
        <div className="stat-card"><span>Total comprado</span><strong>{formatGs(summary.total)}</strong></div>
        <div className="stat-card"><span>Canceladas</span><strong>{summary.cancelled}</strong></div>
        <div className="stat-card"><span>Fallidas</span><strong>{summary.failed}</strong></div>
      </div>

      <form className="form-section admin-simple-form" onSubmit={submit}>
        <h2>Datos del cliente</h2>
        <div className="form-grid">
          <label>Nombre<input value={form.full_name || ''} onChange={(e) => setField('full_name', e.target.value)} required /></label>
          <label>Telefono<input value={form.phone || ''} onChange={(e) => setField('phone', e.target.value)} required /></label>
          <label>Ciudad<input value={form.city || ''} onChange={(e) => setField('city', e.target.value)} /></label>
          <label>Barrio<input value={form.neighborhood || ''} onChange={(e) => setField('neighborhood', e.target.value)} /></label>
          <label>Direccion<input value={form.address || ''} onChange={(e) => setField('address', e.target.value)} /></label>
          <label>Mapa<input value={form.map_url || ''} onChange={(e) => setField('map_url', e.target.value)} /></label>
        </div>
        <label>Referencia<input value={form.reference || ''} onChange={(e) => setField('reference', e.target.value)} /></label>
        <label>Notas<textarea value={form.notes || ''} onChange={(e) => setField('notes', e.target.value)} /></label>
        <label className="checkbox-label"><input type="checkbox" checked={form.requires_advance_payment} onChange={(e) => setField('requires_advance_payment', e.target.checked)} /> Requiere pago adelantado</label>
        <button className="primary-button" type="submit" disabled={saving}><Save size={16} /> {saving ? 'Guardando...' : 'Guardar cliente'}</button>
      </form>

      <section className="panel">
        <h2>Historial de compras</h2>
        <div className="table-wrap nested-table">
          <table className="admin-table sales-table">
            <thead><tr><th>Fecha</th><th>Producto</th><th>Revendedor</th><th>Estado</th><th>Total</th></tr></thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td>{formatDatePy(sale.created_at)}</td>
                  <td>{sale.product_name_snapshot}</td>
                  <td>{sale.reseller?.full_name || '-'}</td>
                  <td>{saleStatusLabel(sale.status)}</td>
                  <td>{formatGs(sale.total_collected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sales.length && <div className="empty-state">Este cliente todavia no tiene ventas.</div>}
        </div>
      </section>
    </div>
  )
}
