import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Search } from 'lucide-react'
import { getProducts } from '../../lib/api'
import { createCustomer, getCustomerByPhone } from '../../lib/customerApi'
import { createSale, getAdminSaleById, updateSale } from '../../lib/adminSalesApi'
import { getResellers } from '../../lib/resellerApi'
import { calculateSaleTotals, SALE_STATUSES, saleStatusLabel } from '../../lib/salesConstants'
import { formatGs } from '../../lib/utils'

const emptyCustomer = {
  full_name: '',
  phone: '',
  city: '',
  neighborhood: '',
  address: '',
  map_url: '',
  reference: '',
  requires_advance_payment: false,
  notes: ''
}

const emptySale = {
  reseller_id: '',
  customer_id: '',
  product_id: '',
  product_name_snapshot: '',
  product_model_snapshot: '',
  quantity: 1,
  status: 'pending_contact',
  product_sale_price: 0,
  product_cost: 0,
  delivery_charged: 0,
  delivery_cost: 0,
  reseller_commission: 0,
  other_costs: 0,
  amount_received: 0,
  payment_method: '',
  delivery_city: '',
  delivery_neighborhood: '',
  delivery_address: '',
  delivery_map_url: '',
  delivery_reference: '',
  delivery_schedule: '',
  admin_notes: '',
  reseller_visible_notes: ''
}

function numberValue(value) {
  return Number(value || 0)
}

export function SaleForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(id)
  const [products, setProducts] = useState([])
  const [resellers, setResellers] = useState([])
  const [customerMatches, setCustomerMatches] = useState([])
  const [customerForm, setCustomerForm] = useState(emptyCustomer)
  const [saleForm, setSaleForm] = useState(emptySale)
  const [customerMode, setCustomerMode] = useState('new')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const totals = useMemo(() => calculateSaleTotals(saleForm), [saleForm])

  useEffect(() => {
    async function load() {
      try {
        const [productRows, resellerRows] = await Promise.all([
          getProducts({ includeHidden: true }),
          getResellers()
        ])
        setProducts(productRows)
        setResellers(resellerRows.filter((item) => item.is_active))

        if (editing) {
          const sale = await getAdminSaleById(id)
          setSaleForm({
            ...emptySale,
            ...sale,
            reseller_id: sale.reseller_id || '',
            customer_id: sale.customer_id || '',
            product_id: sale.product_id || '',
            amount_received: sale.amount_received || 0
          })
          if (sale.customer) {
            setCustomerMode('existing')
            setCustomerForm({ ...emptyCustomer, ...sale.customer })
          }
        }
      } catch (err) {
        setError(err.message || 'No se pudo cargar el formulario.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [editing, id])

  const setSale = (field, value) => setSaleForm((prev) => ({ ...prev, [field]: value }))
  const setCustomer = (field, value) => setCustomerForm((prev) => ({ ...prev, [field]: value }))

  const selectProduct = (productId) => {
    const product = products.find((item) => item.id === productId)
    setSaleForm((prev) => ({
      ...prev,
      product_id: productId,
      product_name_snapshot: product?.name || prev.product_name_snapshot,
      product_model_snapshot: product?.model || '',
      product_cost: numberValue(product?.cost_price),
      product_sale_price: numberValue(product?.suggested_price),
      reseller_commission: Math.max(numberValue(product?.suggested_price) - numberValue(product?.wholesale_price), 0)
    }))
  }

  const searchCustomer = async () => {
    try {
      setError('')
      const matches = await getCustomerByPhone(customerForm.phone)
      setCustomerMatches(matches)
      setMessage(matches.length ? 'Cliente encontrado. Podes usarlo para esta venta.' : 'No hay cliente con ese telefono. Cargalo como nuevo.')
    } catch (err) {
      setError(err.message || 'No se pudo buscar el cliente.')
    }
  }

  const useCustomer = (customer) => {
    setCustomerMode('existing')
    setCustomerForm({ ...emptyCustomer, ...customer })
    setSale('customer_id', customer.id)
    setSaleForm((prev) => ({
      ...prev,
      customer_id: customer.id,
      delivery_city: customer.city || prev.delivery_city,
      delivery_neighborhood: customer.neighborhood || prev.delivery_neighborhood,
      delivery_address: customer.address || prev.delivery_address,
      delivery_map_url: customer.map_url || prev.delivery_map_url,
      delivery_reference: customer.reference || prev.delivery_reference
    }))
  }

  const validate = () => {
    if (!saleForm.reseller_id) return 'Selecciona un revendedor.'
    if (!saleForm.product_name_snapshot.trim()) return 'Cargá el nombre del producto.'
    if (!editing && customerMode === 'new' && (!customerForm.full_name.trim() || !customerForm.phone.trim())) return 'Nombre y telefono del cliente son obligatorios.'
    if (customerMode === 'existing' && !saleForm.customer_id) return 'Selecciona un cliente existente.'
    if (numberValue(saleForm.product_sale_price) < 0 || numberValue(saleForm.reseller_commission) < 0) return 'Los montos no pueden ser negativos.'
    return ''
  }

  const submit = async (event) => {
    event.preventDefault()
    const validation = validate()
    if (validation) {
      setError(validation)
      return
    }

    try {
      setSaving(true)
      setError('')
      setMessage('')
      let customerId = saleForm.customer_id
      if (!editing && customerMode === 'new') {
        const customer = await createCustomer(customerForm)
        customerId = customer.id
      }

      const payload = {
        ...saleForm,
        customer_id: customerId,
        total_collected: totals.total_collected,
        camaraza_net_profit: totals.camaraza_net_profit
      }
      const result = editing ? await updateSale(id, payload) : await createSale(payload)
      setMessage(editing ? 'Venta actualizada.' : 'Venta creada correctamente.')
      navigate(`/admin/ventas/${result.id || id}`)
    } catch (err) {
      setError(err.message || 'No se pudo guardar la venta.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="admin-page"><p>Cargando...</p></div>

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>{editing ? 'Editar venta' : 'Nueva venta'}</h1>
        </div>
        <Link className="secondary-button" to="/admin/ventas"><ArrowLeft size={16} /> Volver</Link>
      </div>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <form className="product-form" onSubmit={submit}>
        <section className="form-section">
          <h2>1. Revendedor</h2>
          <label>Revendedor activo *
            <select value={saleForm.reseller_id} onChange={(e) => setSale('reseller_id', e.target.value)} required>
              <option value="">Seleccionar</option>
              {resellers.map((item) => <option key={item.id} value={item.id}>{item.reseller_code} - {item.full_name} {item.city ? `(${item.city})` : ''}</option>)}
            </select>
          </label>
        </section>

        <section className="form-section">
          <h2>2. Producto</h2>
          <div className="form-grid">
            <label>Producto existente<select value={saleForm.product_id} onChange={(e) => selectProduct(e.target.value)}><option value="">Sin producto vinculado</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Cantidad<input type="number" min="1" value={saleForm.quantity} onChange={(e) => setSale('quantity', e.target.value)} /></label>
            <label>Nombre snapshot *<input value={saleForm.product_name_snapshot} onChange={(e) => setSale('product_name_snapshot', e.target.value)} required /></label>
            <label>Modelo snapshot<input value={saleForm.product_model_snapshot || ''} onChange={(e) => setSale('product_model_snapshot', e.target.value)} /></label>
          </div>
        </section>

        <section className="form-section">
          <h2>3. Cliente</h2>
          <div className="form-grid">
            <label>Telefono<input value={customerForm.phone || ''} onChange={(e) => setCustomer('phone', e.target.value)} disabled={editing} /></label>
            <label>Buscar cliente<button className="secondary-button" type="button" onClick={searchCustomer} disabled={editing}><Search size={16} /> Buscar por telefono</button></label>
          </div>
          {!!customerMatches.length && (
            <div className="match-list">
              {customerMatches.map((customer) => (
                <button type="button" key={customer.id} onClick={() => useCustomer(customer)}>
                  <strong>{customer.full_name}</strong><span>{customer.phone} - {customer.city || 'Sin ciudad'}</span>
                </button>
              ))}
            </div>
          )}
          <div className="form-grid">
            <label>Nombre cliente *<input value={customerForm.full_name || ''} onChange={(e) => setCustomer('full_name', e.target.value)} disabled={editing || customerMode === 'existing'} required={!editing && customerMode === 'new'} /></label>
            <label>Ciudad<input value={customerForm.city || ''} onChange={(e) => setCustomer('city', e.target.value)} disabled={editing || customerMode === 'existing'} /></label>
            <label>Barrio<input value={customerForm.neighborhood || ''} onChange={(e) => setCustomer('neighborhood', e.target.value)} disabled={editing || customerMode === 'existing'} /></label>
            <label>Direccion<input value={customerForm.address || ''} onChange={(e) => setCustomer('address', e.target.value)} disabled={editing || customerMode === 'existing'} /></label>
            <label>Google Maps<input value={customerForm.map_url || ''} onChange={(e) => setCustomer('map_url', e.target.value)} disabled={editing || customerMode === 'existing'} /></label>
            <label>Referencia<input value={customerForm.reference || ''} onChange={(e) => setCustomer('reference', e.target.value)} disabled={editing || customerMode === 'existing'} /></label>
          </div>
        </section>

        <section className="form-section">
          <h2>4. Entrega</h2>
          <div className="form-grid">
            <label>Ciudad entrega<input value={saleForm.delivery_city || ''} onChange={(e) => setSale('delivery_city', e.target.value)} /></label>
            <label>Barrio entrega<input value={saleForm.delivery_neighborhood || ''} onChange={(e) => setSale('delivery_neighborhood', e.target.value)} /></label>
            <label>Direccion entrega<input value={saleForm.delivery_address || ''} onChange={(e) => setSale('delivery_address', e.target.value)} /></label>
            <label>Mapa entrega<input value={saleForm.delivery_map_url || ''} onChange={(e) => setSale('delivery_map_url', e.target.value)} /></label>
            <label>Referencia entrega<input value={saleForm.delivery_reference || ''} onChange={(e) => setSale('delivery_reference', e.target.value)} /></label>
            <label>Horario para recibir<input value={saleForm.delivery_schedule || ''} onChange={(e) => setSale('delivery_schedule', e.target.value)} /></label>
          </div>
        </section>

        <section className="form-section">
          <h2>5. Dinero</h2>
          <div className="form-grid">
            <label>Precio vendido<input type="number" min="0" value={saleForm.product_sale_price} onChange={(e) => setSale('product_sale_price', e.target.value)} /></label>
            <label>Costo producto<input type="number" min="0" value={saleForm.product_cost} onChange={(e) => setSale('product_cost', e.target.value)} /></label>
            <label>Delivery cobrado<input type="number" min="0" value={saleForm.delivery_charged} onChange={(e) => setSale('delivery_charged', e.target.value)} /></label>
            <label>Costo real delivery<input type="number" min="0" value={saleForm.delivery_cost} onChange={(e) => setSale('delivery_cost', e.target.value)} /></label>
            <label>Comision revendedor<input type="number" min="0" value={saleForm.reseller_commission} onChange={(e) => setSale('reseller_commission', e.target.value)} /></label>
            <label>Otros costos<input type="number" min="0" value={saleForm.other_costs} onChange={(e) => setSale('other_costs', e.target.value)} /></label>
            <label>Monto recibido<input type="number" min="0" value={saleForm.amount_received} onChange={(e) => setSale('amount_received', e.target.value)} /></label>
            <label>Forma de pago<input value={saleForm.payment_method || ''} onChange={(e) => setSale('payment_method', e.target.value)} /></label>
          </div>
          <div className="money-preview">
            <div><span>Total cobrado</span><strong>{formatGs(totals.total_collected)}</strong></div>
            <div><span>Comision revendedor</span><strong>{formatGs(saleForm.reseller_commission)}</strong></div>
            <div><span>Ganancia Camaraza</span><strong>{formatGs(totals.camaraza_net_profit)}</strong></div>
          </div>
        </section>

        <section className="form-section">
          <h2>6. Estado inicial</h2>
          <label>Estado<select value={saleForm.status} onChange={(e) => setSale('status', e.target.value)}>{SALE_STATUSES.map((status) => <option key={status} value={status}>{saleStatusLabel(status)}</option>)}</select></label>
        </section>

        <section className="form-section">
          <h2>7. Observaciones</h2>
          <label>Notas internas<textarea value={saleForm.admin_notes || ''} onChange={(e) => setSale('admin_notes', e.target.value)} /></label>
          <label>Notas visibles para revendedor<textarea value={saleForm.reseller_visible_notes || ''} onChange={(e) => setSale('reseller_visible_notes', e.target.value)} /></label>
        </section>

        <div className="sticky-actions">
          <button className="primary-button big" type="submit" disabled={saving}><Save size={18} /> {saving ? 'Guardando...' : 'Guardar venta'}</button>
        </div>
      </form>
    </div>
  )
}
