import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import { MoneyInput } from '../../components/MoneyInput'
import { AdminPageHeader, MoneyCell, StickySummary } from '../../components/AdminUX'
import { createCustomer, getCustomerByPhone } from '../../lib/customerApi'
import { getInventoryProducts } from '../../lib/adminInventoryApi'
import { createSale, getAdminSaleById, updateSale } from '../../lib/adminSalesApi'
import { getResellers } from '../../lib/resellerApi'
import { SALE_STATUSES, saleStatusLabel } from '../../lib/salesConstants'
import { formatGs } from '../../lib/utils'

const emptyCustomer = {
  id: '',
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
  sale_type: 'reseller',
  reseller_id: '',
  customer_id: '',
  items: [],
  status: 'pending_contact',
  delivery_charged: 0,
  payment_method: 'cash',
  payment_timing: 'on_delivery',
  fulfillment_type: 'delivery',
  delivery_city: '',
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

function itemFromProduct(product, saleType) {
  const details = product.admin_details || {}
  const directPrice = details.retail_price
  const resellerPrice = product.suggested_price
  return {
    product_id: product.id,
    product_name_snapshot: product.name,
    product_model_snapshot: product.model || '',
    quantity: 1,
    unit_sale_price: saleType === 'direct' ? Number(directPrice || 0) : Number(resellerPrice || 0),
    unit_cost_snapshot: Number(product.cost_price || 0),
    unit_commission_snapshot: saleType === 'direct' ? 0 : Number(details.reseller_commission_amount || 0),
    retail_missing: saleType === 'direct' && (directPrice === null || directPrice === undefined || directPrice === '')
  }
}

function itemTotals(item, saleType) {
  const quantity = numberValue(item.quantity)
  const subtotal = numberValue(item.unit_sale_price) * quantity
  const cost = numberValue(item.unit_cost_snapshot) * quantity
  const commission = saleType === 'direct' ? 0 : numberValue(item.unit_commission_snapshot) * quantity
  return { subtotal, cost, commission }
}

export function SaleForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(id)
  const [products, setProducts] = useState([])
  const [resellers, setResellers] = useState([])
  const [customerForm, setCustomerForm] = useState(emptyCustomer)
  const [saleForm, setSaleForm] = useState(emptySale)
  const [customerStatus, setCustomerStatus] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [commercialLocked, setCommercialLocked] = useState(false)

  const totals = useMemo(() => {
    return saleForm.items.reduce((acc, item) => {
      const line = itemTotals(item, saleForm.sale_type)
      acc.subtotal += line.subtotal
      acc.cost += line.cost
      acc.commission += line.commission
      return acc
    }, { subtotal: 0, cost: 0, commission: 0 })
  }, [saleForm.items, saleForm.sale_type])
  const totalCollected = totals.subtotal + numberValue(saleForm.delivery_charged)
  const netProfit = totals.subtotal - totals.cost - totals.commission

  useEffect(() => {
    async function load() {
      try {
        const [productRows, resellerRows] = await Promise.all([
          getInventoryProducts(),
          getResellers()
        ])
        setProducts(productRows)
        setResellers(resellerRows.filter((item) => item.is_active))

        if (editing) {
          const sale = await getAdminSaleById(id)
          const saleType = sale.sale_type || 'reseller'
          const saleItems = (sale.items?.length ? sale.items : [{
            product_id: sale.product_id,
            product_name_snapshot: sale.product_name_snapshot,
            product_model_snapshot: sale.product_model_snapshot,
            quantity: sale.quantity || 1,
            unit_sale_price: sale.product_sale_price || 0,
            unit_cost_snapshot: sale.product_cost || 0,
            unit_commission_snapshot: sale.reseller_commission || 0
          }]).map((item) => ({
            product_id: item.product_id || '',
            product_name_snapshot: item.product_name_snapshot || '',
            product_model_snapshot: item.product_model_snapshot || '',
            quantity: item.quantity || 1,
            unit_sale_price: item.unit_sale_price ?? item.line_subtotal ?? 0,
            unit_cost_snapshot: item.unit_cost_snapshot ?? item.line_cost_total ?? 0,
            unit_commission_snapshot: saleType === 'direct' ? 0 : (item.unit_commission_snapshot ?? item.line_commission_total ?? 0),
            retail_missing: false
          }))
          setSaleForm({
            ...emptySale,
            ...sale,
            sale_type: saleType,
            reseller_id: sale.reseller_id || '',
            customer_id: sale.customer_id || '',
            items: saleItems,
            delivery_charged: sale.delivery_charged || 0,
            fulfillment_type: normalizeOption(sale.fulfillment_type, ['delivery', 'transportadora'], 'delivery'),
            payment_method: normalizeOption(sale.payment_method, ['cash', 'transfer', 'card'], 'cash'),
            payment_timing: normalizeOption(sale.payment_timing, ['on_delivery', 'prepaid'], 'on_delivery')
          })
          setCommercialLocked(sale.status === 'delivered_paid' || sale.commission_paid === true)
          if (sale.customer) {
            setCustomerForm({ ...emptyCustomer, ...sale.customer })
            setCustomerStatus('Cliente cargado.')
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
  const setCustomer = (field, value) => {
    setCustomerForm((prev) => ({ ...prev, [field]: value }))
    if (field === 'city') setSale('delivery_city', value)
    if (field === 'phone') {
      setCustomerStatus('')
      setSale('customer_id', '')
    }
  }

  const changeSaleType = (saleType) => {
    if (commercialLocked) return
    setSaleForm((prev) => ({
      ...prev,
      sale_type: saleType,
      reseller_id: saleType === 'direct' ? '' : prev.reseller_id,
      items: prev.items.map((item) => {
        const product = products.find((productItem) => productItem.id === item.product_id)
        if (!product) return { ...item, unit_commission_snapshot: saleType === 'direct' ? 0 : item.unit_commission_snapshot }
        const next = itemFromProduct(product, saleType)
        return { ...item, unit_sale_price: next.unit_sale_price, unit_commission_snapshot: next.unit_commission_snapshot, retail_missing: next.retail_missing }
      })
    }))
  }

  const findCustomer = async () => {
    const phone = customerForm.phone.trim()
    if (!phone) {
      setCustomerStatus('Carga un WhatsApp para buscar.')
      return
    }
    try {
      const existing = await getCustomerByPhone(phone)
      if (existing?.id) {
        setCustomerForm({ ...emptyCustomer, ...existing })
        setSale('customer_id', existing.id)
        setCustomerStatus('Cliente existente reutilizado.')
        return
      }
      setSale('customer_id', '')
      setCustomerStatus('Cliente nuevo. Se creara al guardar.')
    } catch (err) {
      setError(err.message || 'No se pudo buscar el cliente.')
    }
  }

  const addProduct = (productId) => {
    if (!productId || commercialLocked) return
    const product = products.find((item) => item.id === productId)
    if (!product) return
    setSaleForm((prev) => {
      const existingIndex = prev.items.findIndex((item) => item.product_id === productId)
      if (existingIndex >= 0) {
        return {
          ...prev,
          items: prev.items.map((item, index) => index === existingIndex ? { ...item, quantity: numberValue(item.quantity) + 1 } : item)
        }
      }
      return { ...prev, items: [...prev.items, itemFromProduct(product, prev.sale_type)] }
    })
  }

  const updateItem = (index, field, value) => {
    if (commercialLocked) return
    setSaleForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => itemIndex === index ? {
        ...item,
        [field]: value,
        retail_missing: field === 'unit_sale_price' ? false : item.retail_missing
      } : item)
    }))
  }

  const removeItem = (index) => {
    if (commercialLocked) return
    setSaleForm((prev) => ({ ...prev, items: prev.items.filter((_, itemIndex) => itemIndex !== index) }))
  }

  const validate = () => {
    if (commercialLocked) return 'Esta venta ya esta finalizada o tiene comision pagada. No se pueden editar datos comerciales.'
    if (!saleForm.sale_type) return 'Selecciona el tipo de venta.'
    if (saleForm.sale_type === 'reseller' && !saleForm.reseller_id) return 'Selecciona un revendedor.'
    if (!customerForm.phone.trim()) return 'Numero de WhatsApp es obligatorio.'
    if (!saleForm.customer_id && (!customerForm.full_name.trim() || !customerForm.city.trim())) return 'Nombre, WhatsApp y ciudad son obligatorios para crear cliente.'
    if (!saleForm.items.length) return 'Agrega al menos un producto.'
    if (!saleForm.fulfillment_type) return 'Selecciona el tipo de envio.'
    if (!saleForm.payment_method) return 'Selecciona la forma de pago.'
    if (!saleForm.payment_timing) return 'Selecciona el momento del pago.'
    if (numberValue(saleForm.delivery_charged) < 0) return 'El delivery no puede ser negativo.'
    for (const item of saleForm.items) {
      if (!item.product_id) return 'Todas las filas deben tener producto.'
      const quantity = Number(item.quantity)
      if (!Number.isInteger(quantity) || quantity <= 0) return 'La cantidad debe ser un numero entero mayor a cero.'
      if (numberValue(item.unit_sale_price) < 0) return 'El precio no puede ser negativo.'
      if (item.retail_missing) return 'Hay productos sin precio minorista interno. Carga un precio o revisa el producto.'
    }
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
      if (!customerId) {
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
        reseller_id: saleForm.sale_type === 'direct' ? null : saleForm.reseller_id,
        delivery_city: customerForm.city || saleForm.delivery_city,
        items: saleForm.items.map((item) => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
          unit_sale_price: Number(item.unit_sale_price || 0)
        }))
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
    <div className="admin-page ax-page">
      <AdminPageHeader
        title={editing ? 'Editar venta' : 'Nueva venta'}
        description="Carga operativa multiproducto con resumen financiero permanente."
        actions={<Link className="secondary-button" to="/admin/ventas"><ArrowLeft size={16} /> Volver</Link>}
      />

      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}
      {commercialLocked && <div className="warning-box">Venta finalizada o con comision pagada. Los datos comerciales quedan solo lectura.</div>}

      <form className="ax-sale-form" onSubmit={submit}>
        <div className="ax-form-main">
          <section className="form-section">
            <h2>Tipo de venta</h2>
            <div className="ax-quick-filters">
              <button type="button" className={saleForm.sale_type === 'direct' ? 'active' : ''} disabled={commercialLocked} onClick={() => changeSaleType('direct')}>Cliente final</button>
              <button type="button" className={saleForm.sale_type === 'reseller' ? 'active' : ''} disabled={commercialLocked} onClick={() => changeSaleType('reseller')}>Revendedor</button>
            </div>
            {saleForm.sale_type === 'reseller' && (
              <label>Revendedor activo *
                <select value={saleForm.reseller_id || ''} onChange={(event) => setSale('reseller_id', event.target.value)} disabled={commercialLocked} required>
                  <option value="">Seleccionar por codigo, nombre o ciudad</option>
                  {resellers.map((item) => <option key={item.id} value={item.id}>{item.reseller_code} - {item.full_name} {item.city ? `(${item.city})` : ''}</option>)}
                </select>
              </label>
            )}
          </section>

          <section className="form-section">
            <h2>Cliente</h2>
            <div className="form-grid">
              <label>Numero de WhatsApp *<input value={customerForm.phone || ''} onBlur={findCustomer} onChange={(event) => setCustomer('phone', event.target.value)} disabled={commercialLocked} required /></label>
              <label>Nombre completo *<input value={customerForm.full_name || ''} onChange={(event) => setCustomer('full_name', event.target.value)} disabled={commercialLocked} required={!saleForm.customer_id} /></label>
              <label>Ciudad *<input value={customerForm.city || ''} onChange={(event) => setCustomer('city', event.target.value)} disabled={commercialLocked} required={!saleForm.customer_id} /></label>
              <button className="secondary-button" type="button" onClick={findCustomer} disabled={commercialLocked}>Buscar WhatsApp</button>
            </div>
            {customerStatus && <p className="ax-help-text">{customerStatus}</p>}
          </section>

          <section className="form-section">
            <h2>Productos</h2>
            {!commercialLocked && (
              <label>Agregar producto
                <select value="" onChange={(event) => { addProduct(event.target.value); event.target.value = '' }}>
                  <option value="">Seleccionar producto</option>
                  {products.map((item) => <option key={item.id} value={item.id}>{item.name} {item.model ? `- ${item.model}` : ''}</option>)}
                </select>
              </label>
            )}
            <div className="ax-sale-items-list">
              {saleForm.items.map((item, index) => {
                const line = itemTotals(item, saleForm.sale_type)
                return (
                  <div className="ax-sale-item-row" key={`${item.product_id}-${index}`}>
                    <div>
                      <strong>{item.product_name_snapshot || 'Producto'}</strong>
                      <span>{item.product_model_snapshot || 'Sin modelo'}</span>
                      {item.retail_missing && <small className="ax-negative">Sin precio minorista interno.</small>}
                    </div>
                    <label>Cant.<input type="number" min="1" step="1" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} disabled={commercialLocked} /></label>
                    <MoneyInput label="Precio unitario" value={item.unit_sale_price} onChange={(value) => updateItem(index, 'unit_sale_price', value)} disabled={commercialLocked} />
                    {saleForm.sale_type === 'reseller' && <div className="ax-readonly-field"><span>Comision</span><strong>{formatGs(line.commission)}</strong></div>}
                    <div className="ax-readonly-field"><span>Subtotal</span><strong>{formatGs(line.subtotal)}</strong></div>
                    {!commercialLocked && <button className="icon-button" type="button" onClick={() => removeItem(index)} aria-label="Eliminar producto"><Trash2 size={16} /></button>}
                  </div>
                )
              })}
              {!saleForm.items.length && <div className="empty-state">Agrega productos para guardar la venta.</div>}
            </div>
            {!commercialLocked && <button className="secondary-button" type="button" onClick={() => addProduct(products[0]?.id)} disabled={!products.length}><Plus size={16} /> Agregar producto</button>}
          </section>

          <section className="form-section">
            <h2>Entrega y pago</h2>
            <div className="form-grid">
              <label>Horario para recibir<input type="time" value={saleForm.delivery_schedule || ''} onChange={(event) => setSale('delivery_schedule', event.target.value)} /></label>
              <label>Tipo de envio *
                <select value={saleForm.fulfillment_type} onChange={(event) => setSale('fulfillment_type', event.target.value)} required>
                  <option value="delivery">Delivery</option>
                  <option value="transportadora">Transportadora</option>
                </select>
              </label>
              <MoneyInput label="Envio cobrado" value={saleForm.delivery_charged} onChange={(value) => setSale('delivery_charged', value)} />
              <label>Forma de pago<select value={saleForm.payment_method} onChange={(event) => setSale('payment_method', event.target.value)}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="card">Tarjeta</option></select></label>
              <label>Momento del pago<select value={saleForm.payment_timing} onChange={(event) => setSale('payment_timing', event.target.value)}><option value="on_delivery">Contra entrega</option><option value="prepaid">Paga antes de enviar</option></select></label>
            </div>
          </section>

          <section className="form-section">
            <h2>Estado y observaciones</h2>
            <div className="form-grid">
              <label>Estado<select value={saleForm.status} onChange={(event) => setSale('status', event.target.value)}>{SALE_STATUSES.map((status) => <option key={status} value={status}>{saleStatusLabel(status)}</option>)}</select></label>
            </div>
            <label>Notas internas<textarea value={saleForm.admin_notes || ''} onChange={(event) => setSale('admin_notes', event.target.value)} /></label>
            <label>Notas visibles para revendedor<textarea value={saleForm.reseller_visible_notes || ''} onChange={(event) => setSale('reseller_visible_notes', event.target.value)} /></label>
          </section>
        </div>

        <StickySummary
          title="Resumen"
          items={[
            { label: 'Tipo', value: saleForm.sale_type === 'direct' ? 'Cliente final' : 'Revendedor' },
            { label: 'Productos', value: `${saleForm.items.length} productos / ${saleForm.items.reduce((sum, item) => sum + numberValue(item.quantity), 0)} unidades` },
            { label: 'Subtotal productos', value: formatGs(totals.subtotal) },
            { label: 'Delivery', value: formatGs(saleForm.delivery_charged) },
            { label: 'Total a cobrar', value: formatGs(totalCollected) },
            { label: 'Costo interno', value: formatGs(totals.cost) },
            ...(saleForm.sale_type === 'reseller' ? [{ label: 'Comision total', value: formatGs(totals.commission) }] : []),
            { label: 'Ganancia operativa', value: formatGs(netProfit) },
            { label: 'Estado', value: saleStatusLabel(saleForm.status) }
          ]}
        >
          {error && <div className="error-box">{error}</div>}
          <button className="primary-button" type="submit" disabled={saving || commercialLocked}><Save size={18} /> {saving ? 'Guardando...' : 'Guardar venta'}</button>
          <Link className="secondary-button" to="/admin/ventas">Cancelar</Link>
        </StickySummary>
      </form>
    </div>
  )
}
