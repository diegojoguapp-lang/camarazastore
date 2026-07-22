import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { MoneyInput } from '../../components/MoneyInput'
import { getProducts } from '../../lib/api'
import { createCustomer } from '../../lib/customerApi'
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
  payment_method: 'cash',
  payment_timing: 'on_delivery',
  fulfillment_type: 'delivery',
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

function normalizeOption(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

export function SaleForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(id)
  const [products, setProducts] = useState([])
  const [resellers, setResellers] = useState([])
  const [customerForm, setCustomerForm] = useState(emptyCustomer)
  const [saleForm, setSaleForm] = useState(emptySale)
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
            amount_received: sale.amount_received || 0,
            fulfillment_type: normalizeOption(sale.fulfillment_type, ['delivery', 'transportadora'], 'delivery'),
            payment_method: normalizeOption(sale.payment_method, ['cash', 'transfer', 'card'], 'cash'),
            payment_timing: normalizeOption(sale.payment_timing, ['on_delivery', 'prepaid'], 'on_delivery')
          })
          if (sale.customer) setCustomerForm({ ...emptyCustomer, ...sale.customer })
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
  const setCustomer = (field, value) => {
    setCustomerForm((prev) => ({ ...prev, [field]: value }))
    if (field === 'city') setSale('delivery_city', value)
  }

  const selectProduct = (productId) => {
    const product = products.find((item) => item.id === productId)
    setSaleForm((prev) => ({
      ...prev,
      product_id: productId,
      product_name_snapshot: product?.name || '',
      product_model_snapshot: product?.model || '',
      product_cost: numberValue(product?.cost_price),
      product_sale_price: numberValue(product?.suggested_price),
      reseller_commission: Math.max(numberValue(product?.suggested_price) - numberValue(product?.wholesale_price), 0)
    }))
  }

  const validate = () => {
    if (!saleForm.reseller_id) return 'Selecciona un revendedor.'
    if (!saleForm.product_id && !saleForm.product_name_snapshot.trim()) return 'Selecciona un producto.'
    if (!saleForm.product_name_snapshot.trim()) return 'Carga el nombre del producto.'
    if (!editing && (!customerForm.full_name.trim() || !customerForm.phone.trim() || !customerForm.city.trim())) return 'Nombre, WhatsApp y ciudad son obligatorios.'
    if (!saleForm.fulfillment_type) return 'Selecciona el tipo de envio.'
    if (!saleForm.payment_method) return 'Selecciona la forma de pago.'
    if (!saleForm.payment_timing) return 'Selecciona el momento del pago.'
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
      if (!editing) {
        const customer = await createCustomer({
          ...customerForm,
          neighborhood: null,
          address: null,
          map_url: null,
          reference: null
        })
        customerId = customer.id
      }

      const payload = {
        ...saleForm,
        customer_id: customerId,
        delivery_city: customerForm.city || saleForm.delivery_city,
        delivery_neighborhood: null,
        delivery_address: null,
        delivery_map_url: null,
        delivery_cost: 0,
        other_costs: 0,
        amount_received: 0,
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
            <select value={saleForm.reseller_id} onChange={(event) => setSale('reseller_id', event.target.value)} required>
              <option value="">Seleccionar</option>
              {resellers.map((item) => <option key={item.id} value={item.id}>{item.reseller_code} - {item.full_name} {item.city ? `(${item.city})` : ''}</option>)}
            </select>
          </label>
        </section>

        <section className="form-section">
          <h2>2. Producto</h2>
          <div className="form-grid">
            <label>Producto
              <select value={saleForm.product_id} onChange={(event) => selectProduct(event.target.value)}>
                <option value="">Seleccionar producto</option>
                {products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>Cantidad<input type="number" min="1" value={saleForm.quantity} onChange={(event) => setSale('quantity', event.target.value)} /></label>
            <MoneyInput label="Costo del producto" value={saleForm.product_cost} onChange={(value) => setSale('product_cost', value)} disabled />
          </div>
        </section>

        <section className="form-section">
          <h2>3. Cliente y entrega</h2>
          <div className="form-grid">
            <label>Nombre completo *<input value={customerForm.full_name || ''} onChange={(event) => setCustomer('full_name', event.target.value)} disabled={editing} required={!editing} /></label>
            <label>Numero de WhatsApp *<input value={customerForm.phone || ''} onChange={(event) => setCustomer('phone', event.target.value)} disabled={editing} required={!editing} /></label>
            <label>Ciudad *<input value={customerForm.city || ''} onChange={(event) => setCustomer('city', event.target.value)} disabled={editing} required={!editing} /></label>
            <label>Horario para recibir<input type="time" value={saleForm.delivery_schedule || ''} onChange={(event) => setSale('delivery_schedule', event.target.value)} /></label>
            <label>Tipo de envio *
              <select value={saleForm.fulfillment_type} onChange={(event) => setSale('fulfillment_type', event.target.value)} required>
                <option value="delivery">Delivery</option>
                <option value="transportadora">Transportadora</option>
              </select>
            </label>
          </div>
        </section>

        <section className="form-section">
          <h2>4. Dinero y pago</h2>
          <div className="form-grid">
            <MoneyInput label="Precio de venta" value={saleForm.product_sale_price} onChange={(value) => setSale('product_sale_price', value)} />
            <MoneyInput label="Comision del revendedor" value={saleForm.reseller_commission} onChange={(value) => setSale('reseller_commission', value)} />
            <MoneyInput label="Costo de envio cobrado" value={saleForm.delivery_charged} onChange={(value) => setSale('delivery_charged', value)} />
            <label>Forma de pago
              <select value={saleForm.payment_method} onChange={(event) => setSale('payment_method', event.target.value)}>
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta</option>
              </select>
            </label>
            <label>Momento del pago
              <select value={saleForm.payment_timing} onChange={(event) => setSale('payment_timing', event.target.value)}>
                <option value="on_delivery">Contra entrega</option>
                <option value="prepaid">Paga antes de enviar</option>
              </select>
            </label>
          </div>
          <div className="money-preview">
            <div><span>Total cobrado</span><strong>{formatGs(totals.total_collected)}</strong></div>
            <div><span>Comision revendedor</span><strong>{formatGs(saleForm.reseller_commission)}</strong></div>
            <div><span>Ganancia Camaraza</span><strong>{formatGs(totals.camaraza_net_profit)}</strong></div>
          </div>
        </section>

        <section className="form-section">
          <h2>5. Estado inicial</h2>
          <label>Estado
            <select value={saleForm.status} onChange={(event) => setSale('status', event.target.value)}>
              {SALE_STATUSES.map((status) => <option key={status} value={status}>{saleStatusLabel(status)}</option>)}
            </select>
          </label>
        </section>

        <section className="form-section">
          <h2>6. Observaciones</h2>
          <label>Notas internas<textarea value={saleForm.admin_notes || ''} onChange={(event) => setSale('admin_notes', event.target.value)} /></label>
          <label>Notas visibles para revendedor<textarea value={saleForm.reseller_visible_notes || ''} onChange={(event) => setSale('reseller_visible_notes', event.target.value)} /></label>
        </section>

        <div className="sticky-actions">
          <button className="primary-button big" type="submit" disabled={saving}><Save size={18} /> {saving ? 'Guardando...' : 'Guardar venta'}</button>
        </div>
      </form>
    </div>
  )
}
