import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import { MoneyInput } from '../../components/MoneyInput'
import { AdminPageHeader, MoneyCell, StickySummary } from '../../components/AdminUX'
import { createCustomer, getCustomerByPhone } from '../../lib/customerApi'
import { getInventoryProducts } from '../../lib/adminInventoryApi'
import { createSale, getAdminSaleById, updateSale } from '../../lib/adminSalesApi'
import { getResellers } from '../../lib/resellerApi'
import { saleStatusLabel } from '../../lib/salesConstants'
import { formatGs } from '../../lib/utils'

const emptyCustomer = {
  id: '',
  full_name: '',
  phone: '',
  city: '',
  customer_document: '',
  shipping_carrier_name: ''
}

const emptySale = {
  sale_type: 'reseller',
  reseller_id: '',
  customer_id: '',
  items: [],
  status: 'confirmed',
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

const visibleStatuses = ['confirmed', 'out_for_delivery', 'cancelled']

function numberValue(value) {
  return Number(value || 0)
}

function normalizeFulfillment(value) {
  if (value === 'transportadora') return 'shipping'
  return ['delivery', 'shipping', 'pickup'].includes(value) ? value : 'delivery'
}

function resellerSearchText(reseller) {
  return [reseller.reseller_code, reseller.full_name, reseller.phone, reseller.whatsapp, reseller.city].filter(Boolean).join(' ')
}

function productSearchText(product) {
  return [product.name, product.brand, product.model, product.admin_details?.sku].filter(Boolean).join(' ')
}

function productCode(product) {
  return product.admin_details?.sku || product.slug || product.id?.slice(0, 8) || '-'
}

function itemFromProduct(product, saleType) {
  const details = product.admin_details || {}
  const retailPrice = details.retail_price
  const wholesale = Number(product.wholesale_price || 0)
  const unitSalePrice = saleType === 'direct' ? Number(retailPrice || product.suggested_price || 0) : Number(product.suggested_price || wholesale)
  return {
    product_id: product.id,
    product_code_snapshot: productCode(product),
    product_name_snapshot: product.name,
    product_model_snapshot: product.model || '',
    wholesale_price_snapshot: wholesale,
    quantity: 1,
    unit_sale_price: unitSalePrice,
    unit_cost_snapshot: Number(product.cost_price || 0),
    retail_missing: saleType === 'direct' && (retailPrice === null || retailPrice === undefined || retailPrice === '')
  }
}

function itemTotals(item, saleType) {
  const quantity = numberValue(item.quantity)
  const subtotal = numberValue(item.unit_sale_price) * quantity
  const cost = numberValue(item.unit_cost_snapshot) * quantity
  const unitCommission = saleType === 'direct' ? 0 : Math.max(numberValue(item.unit_sale_price) - numberValue(item.wholesale_price_snapshot), 0)
  const commission = unitCommission * quantity
  return { subtotal, cost, unitCommission, commission }
}

function Combobox({ id, label, value, onChange, options, placeholder, disabled }) {
  return (
    <label>{label}
      <input
        list={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      <datalist id={id}>
        {options.map((option) => <option key={option.value} value={option.label} />)}
      </datalist>
    </label>
  )
}

export function SaleForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(id)
  const [products, setProducts] = useState([])
  const [resellers, setResellers] = useState([])
  const [customerForm, setCustomerForm] = useState(emptyCustomer)
  const [saleForm, setSaleForm] = useState(emptySale)
  const [resellerQuery, setResellerQuery] = useState('')
  const [productQuery, setProductQuery] = useState('')
  const [customerStatus, setCustomerStatus] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [commercialLocked, setCommercialLocked] = useState(false)

  const selectedReseller = resellers.find((item) => item.id === saleForm.reseller_id)
  const resellerOptions = useMemo(() => resellers.map((item) => ({
    value: item.id,
    label: `${item.reseller_code || 'REV'} · ${item.full_name || 'Sin nombre'}`
  })), [resellers])
  const productOptions = useMemo(() => products.map((item) => ({
    value: item.id,
    label: `${productCode(item)} · ${item.name}${item.model ? ` · ${item.model}` : ''}`
  })), [products])

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
        const [productRows, resellerRows] = await Promise.all([getInventoryProducts(), getResellers()])
        setProducts(productRows)
        setResellers(resellerRows.filter((item) => item.is_active))

        if (editing) {
          const sale = await getAdminSaleById(id)
          const saleType = sale.sale_type || 'reseller'
          const saleItems = (sale.items || []).map((item) => ({
            product_id: item.product_id || '',
            product_code_snapshot: item.product_sku_snapshot || '',
            product_name_snapshot: item.product_name_snapshot || '',
            product_model_snapshot: item.product_model_snapshot || '',
            wholesale_price_snapshot: Number(item.unit_sale_price || 0) - Number(item.unit_commission_snapshot || 0),
            quantity: item.quantity || 1,
            unit_sale_price: item.unit_sale_price ?? 0,
            unit_cost_snapshot: item.unit_cost_snapshot ?? 0,
            retail_missing: false
          }))
          setSaleForm({
            ...emptySale,
            ...sale,
            sale_type: saleType,
            reseller_id: sale.reseller_id || '',
            customer_id: sale.customer_id || '',
            items: saleItems,
            status: visibleStatuses.includes(sale.status) ? sale.status : 'confirmed',
            delivery_charged: sale.delivery_charged || 0,
            fulfillment_type: normalizeFulfillment(sale.fulfillment_type),
            payment_method: sale.payment_method || 'cash',
            payment_timing: sale.payment_timing || 'on_delivery'
          })
          const reseller = resellerRows.find((item) => item.id === sale.reseller_id)
          if (reseller) setResellerQuery(`${reseller.reseller_code || 'REV'} · ${reseller.full_name}`)
          if (sale.customer || sale.customer_name_snapshot) {
            setCustomerForm({
              ...emptyCustomer,
              ...(sale.customer || {}),
              full_name: sale.customer?.full_name || sale.customer_name_snapshot || '',
              phone: sale.customer?.phone || sale.customer_phone_snapshot || '',
              city: sale.customer?.city || sale.delivery_city || '',
              customer_document: sale.customer_document || '',
              shipping_carrier_name: sale.shipping_carrier_name || ''
            })
            setCustomerStatus('Cliente cargado.')
          }
          setCommercialLocked(sale.status === 'delivered_paid' || sale.status === 'returned' || sale.commission_paid === true)
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

  const selectReseller = (label) => {
    setResellerQuery(label)
    const exact = resellerOptions.find((item) => item.label === label)
    if (exact) {
      setSale('reseller_id', exact.value)
      return
    }
    const term = label.toLowerCase()
    const match = resellers.find((item) => resellerSearchText(item).toLowerCase().includes(term))
    setSale('reseller_id', match?.id || '')
  }

  const changeSaleType = (saleType) => {
    if (commercialLocked) return
    setSaleForm((prev) => ({
      ...prev,
      sale_type: saleType,
      reseller_id: saleType === 'direct' ? '' : prev.reseller_id,
      items: prev.items.map((item) => {
        const product = products.find((productItem) => productItem.id === item.product_id)
        if (!product) return item
        const next = itemFromProduct(product, saleType)
        return { ...item, unit_sale_price: next.unit_sale_price, wholesale_price_snapshot: next.wholesale_price_snapshot, retail_missing: next.retail_missing }
      })
    }))
    if (saleType === 'direct') setResellerQuery('')
  }

  const findCustomer = async () => {
    const phone = customerForm.phone.trim()
    if (!phone) {
      setCustomerStatus('')
      setSale('customer_id', '')
      return
    }
    try {
      const existing = await getCustomerByPhone(phone)
      if (existing?.id) {
        setCustomerForm((prev) => ({ ...prev, ...existing }))
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

  const addSelectedProduct = () => {
    if (commercialLocked) return
    setError('')
    const exact = productOptions.find((item) => item.label === productQuery)
    const term = productQuery.trim().toLowerCase()
    const product = exact
      ? products.find((item) => item.id === exact.value)
      : products.find((item) => productSearchText(item).toLowerCase().includes(term))
    if (!product) {
      setError('Selecciona un producto primero.')
      return
    }
    setSaleForm((prev) => {
      const existingIndex = prev.items.findIndex((item) => item.product_id === product.id)
      if (existingIndex >= 0) {
        return {
          ...prev,
          items: prev.items.map((item, index) => index === existingIndex ? { ...item, quantity: numberValue(item.quantity) + 1 } : item)
        }
      }
      return { ...prev, items: [...prev.items, itemFromProduct(product, prev.sale_type)] }
    })
    setProductQuery('')
  }

  const updateItem = (index, field, value) => {
    if (commercialLocked) return
    setSaleForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value, retail_missing: false } : item)
    }))
  }

  const removeItem = (index) => {
    if (commercialLocked) return
    setSaleForm((prev) => ({ ...prev, items: prev.items.filter((_, itemIndex) => itemIndex !== index) }))
  }

  const validate = () => {
    if (commercialLocked) return 'Esta venta ya esta finalizada o tiene comision pagada. No se pueden editar datos comerciales.'
    if (saleForm.sale_type === 'reseller' && !saleForm.reseller_id) return 'Selecciona un revendedor.'
    if (!customerForm.full_name.trim()) return 'Nombre del cliente es obligatorio.'
    if (saleForm.fulfillment_type === 'delivery' && !customerForm.phone.trim()) return 'WhatsApp del cliente es obligatorio para delivery.'
    if (saleForm.fulfillment_type === 'delivery' && !customerForm.city.trim()) return 'Ciudad es obligatoria para delivery.'
    if (saleForm.fulfillment_type === 'shipping') {
      if (!customerForm.phone.trim()) return 'WhatsApp del cliente es obligatorio para encomienda.'
      if (!customerForm.customer_document.trim()) return 'Cedula es obligatoria para encomienda.'
      if (!customerForm.city.trim()) return 'Ciudad es obligatoria para encomienda.'
      if (!customerForm.shipping_carrier_name.trim()) return 'Transportadora es obligatoria para encomienda.'
    }
    if (!saleForm.items.length) return 'Agrega al menos un producto.'
    if (numberValue(saleForm.delivery_charged) < 0) return 'El envio no puede ser negativo.'
    for (const item of saleForm.items) {
      if (!item.product_id) return 'Todas las filas deben tener producto.'
      const quantity = Number(item.quantity)
      if (!Number.isInteger(quantity) || quantity <= 0) return 'La cantidad debe ser un numero entero mayor a cero.'
      if (numberValue(item.unit_sale_price) < 0) return 'El precio no puede ser negativo.'
      if (saleForm.sale_type === 'reseller' && numberValue(item.unit_sale_price) < numberValue(item.wholesale_price_snapshot)) {
        return `El precio de venta no puede ser menor al precio mayorista de ${formatGs(item.wholesale_price_snapshot)}.`
      }
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
      let customerId = saleForm.customer_id || null
      if (!customerId && customerForm.phone.trim()) {
        const customer = await createCustomer({
          full_name: customerForm.full_name,
          phone: customerForm.phone,
          city: customerForm.city || null,
          neighborhood: null,
          address: null,
          map_url: null,
          reference: null
        })
        customerId = customer.id
      }

      const fulfillmentType = normalizeFulfillment(saleForm.fulfillment_type)
      const payload = {
        ...saleForm,
        customer_id: customerId,
        reseller_id: saleForm.sale_type === 'direct' ? null : saleForm.reseller_id,
        customer_name: customerForm.full_name,
        customer_phone: customerForm.phone,
        customer_document: fulfillmentType === 'shipping' ? customerForm.customer_document : null,
        shipping_carrier_name: fulfillmentType === 'shipping' ? customerForm.shipping_carrier_name : null,
        delivery_city: fulfillmentType === 'pickup' ? null : customerForm.city || saleForm.delivery_city,
        delivery_reference: fulfillmentType === 'pickup' ? null : saleForm.delivery_reference,
        delivery_schedule: fulfillmentType === 'pickup' ? null : saleForm.delivery_schedule,
        delivery_charged: fulfillmentType === 'pickup' ? 0 : saleForm.delivery_charged,
        fulfillment_type: fulfillmentType,
        items: saleForm.items.map((item) => ({ product_id: item.product_id, quantity: Number(item.quantity), unit_sale_price: Number(item.unit_sale_price || 0) }))
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
        description="Pedido compacto con productos, entrega y comision calculada por precio real."
        actions={<Link className="secondary-button" to="/admin/ventas"><ArrowLeft size={16} /> Volver</Link>}
      />

      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}
      {commercialLocked && <div className="warning-box">Venta finalizada o con comision pagada. Los datos comerciales quedan solo lectura.</div>}

      <form className="ax-sale-form ax-sale-form-pro" onSubmit={submit}>
        <div className="ax-form-main">
          <section className="form-section ax-erp-section">
            <h2>Tipo y revendedor</h2>
            <div className="ax-quick-filters">
              <button type="button" className={saleForm.sale_type === 'direct' ? 'active' : ''} disabled={commercialLocked} onClick={() => changeSaleType('direct')}>Cliente final</button>
              <button type="button" className={saleForm.sale_type === 'reseller' ? 'active' : ''} disabled={commercialLocked} onClick={() => changeSaleType('reseller')}>Revendedor</button>
            </div>
            {saleForm.sale_type === 'reseller' && (
              <>
                <Combobox id="reseller-options" label="Buscar revendedor" value={resellerQuery} onChange={selectReseller} options={resellerOptions} placeholder="Codigo, nombre o WhatsApp" disabled={commercialLocked} />
                {selectedReseller && <div className="ax-selection-pill">{selectedReseller.reseller_code} · {selectedReseller.full_name}</div>}
              </>
            )}
          </section>

          <section className="form-section ax-erp-section">
            <h2>Datos del cliente y envio</h2>
            <div className="ax-fulfillment-tabs">
              {[
                ['delivery', 'Delivery'],
                ['shipping', 'Encomienda'],
                ['pickup', 'Pasa a buscar']
              ].map(([value, label]) => (
                <button key={value} type="button" className={saleForm.fulfillment_type === value ? 'active' : ''} onClick={() => setSale('fulfillment_type', value)}>{label}</button>
              ))}
            </div>

            <div className="form-grid ax-dense-grid">
              <label>Nombre del cliente *<input value={customerForm.full_name || ''} onChange={(event) => setCustomer('full_name', event.target.value)} disabled={commercialLocked} required /></label>
              {saleForm.fulfillment_type !== 'pickup' && (
                <>
                  <label>WhatsApp *<input value={customerForm.phone || ''} onBlur={findCustomer} onChange={(event) => setCustomer('phone', event.target.value)} disabled={commercialLocked} required /></label>
                  <label>Ciudad *<input value={customerForm.city || ''} onChange={(event) => setCustomer('city', event.target.value)} disabled={commercialLocked} required /></label>
                </>
              )}
              {saleForm.fulfillment_type === 'delivery' && (
                <>
                  <MoneyInput label="Precio del delivery" value={saleForm.delivery_charged} onChange={(value) => setSale('delivery_charged', value)} />
                  <label>Forma de pago<select value={saleForm.payment_method} onChange={(event) => setSale('payment_method', event.target.value)}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option></select></label>
                </>
              )}
              {saleForm.fulfillment_type === 'shipping' && (
                <>
                  <label>Cedula *<input value={customerForm.customer_document || ''} onChange={(event) => setCustomer('customer_document', event.target.value)} disabled={commercialLocked} required /></label>
                  <label>Transportadora *<input value={customerForm.shipping_carrier_name || ''} onChange={(event) => setCustomer('shipping_carrier_name', event.target.value)} disabled={commercialLocked} required /></label>
                  <MoneyInput label="Precio del envio" value={saleForm.delivery_charged} onChange={(value) => setSale('delivery_charged', value)} />
                </>
              )}
            </div>
            {customerStatus && <p className="ax-help-text">{customerStatus}</p>}
          </section>

          <section className="form-section ax-erp-section">
            <h2>Buscar y agregar producto</h2>
            {!commercialLocked && (
              <div className="ax-add-product-row">
                <Combobox id="product-options" label="Producto" value={productQuery} onChange={setProductQuery} options={productOptions} placeholder="Nombre, marca, modelo o codigo" />
                <button className="primary-button" type="button" onClick={addSelectedProduct}><Plus size={16} /> Agregar producto</button>
              </div>
            )}
          </section>

          <section className="form-section ax-erp-section">
            <h2>Productos de la venta</h2>
            <div className="ax-sale-items-table">
              <div className="ax-sale-items-head">
                <span>Producto</span><span>Codigo</span><span>Cant.</span><span>Precio unit.</span><span>Comision</span><span>Subtotal</span><span />
              </div>
              {saleForm.items.map((item, index) => {
                const line = itemTotals(item, saleForm.sale_type)
                return (
                  <div className="ax-sale-item-line" key={`${item.product_id}-${index}`}>
                    <div><strong>{item.product_name_snapshot}</strong><small>{item.product_model_snapshot || '-'}</small></div>
                    <span>{item.product_code_snapshot || '-'}</span>
                    <label><input type="number" min="1" step="1" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} disabled={commercialLocked} /></label>
                    <MoneyInput value={item.unit_sale_price} onChange={(value) => updateItem(index, 'unit_sale_price', value)} disabled={commercialLocked} />
                    <strong>{formatGs(line.commission)}</strong>
                    <strong>{formatGs(line.subtotal)}</strong>
                    {!commercialLocked && <button className="icon-button" type="button" onClick={() => removeItem(index)} aria-label="Eliminar producto"><Trash2 size={16} /></button>}
                  </div>
                )
              })}
              {!saleForm.items.length && <div className="empty-state">Agrega productos para guardar la venta.</div>}
            </div>
          </section>

          <section className="form-section ax-erp-section">
            <h2>Estado y notas</h2>
            <div className="form-grid ax-dense-grid">
              <label>Estado<select value={saleForm.status} onChange={(event) => setSale('status', event.target.value)}>{visibleStatuses.map((status) => <option key={status} value={status}>{saleStatusLabel(status)}</option>)}</select></label>
              <label>Horario<input type="time" value={saleForm.delivery_schedule || ''} onChange={(event) => setSale('delivery_schedule', event.target.value)} disabled={saleForm.fulfillment_type === 'pickup'} /></label>
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
            { label: 'Envio', value: formatGs(saleForm.delivery_charged) },
            { label: 'Total a cobrar', value: formatGs(totalCollected) },
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
