import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import { AdminPageHeader, StickySummary } from '../../components/AdminUX'
import { getInventoryProducts, getSuppliers } from '../../lib/adminInventoryApi'
import { savePurchase } from '../../lib/adminPurchasesApi'
import { formatGs } from '../../lib/utils'

const empty = { supplier_id: '', purchase_date: new Date().toISOString().slice(0, 10), notes: '', items: [] }

export function PurchaseForm() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getInventoryProducts(), getSuppliers({ includeInactive: true })])
      .then(([productRows, supplierRows]) => { setProducts(productRows); setSuppliers(supplierRows) })
      .catch((err) => setError(err.message || 'No se pudo cargar el formulario.'))
  }, [])

  const total = useMemo(() => form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_cost || 0), 0), [form.items])
  const units = useMemo(() => form.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0), [form.items])

  const addProduct = (productId) => {
    const product = products.find((item) => item.id === productId)
    if (!product) return
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { product_id: product.id, name: product.name, quantity: 1, unit_cost: Number(product.cost_price || 0) }]
    }))
  }

  const updateItem = (index, field, value) => {
    setForm((prev) => ({ ...prev, items: prev.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }))
  }

  const submit = async (event) => {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      const id = await savePurchase(form)
      navigate(`/admin/compras/${id}`)
    } catch (err) {
      setError(err.message || 'No se pudo guardar la compra.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader eyebrow="Compras" title="Nueva compra" description="Borrador multiproducto. Confirmar despues para ingresar stock." actions={<Link className="secondary-button" to="/admin/compras"><ArrowLeft size={16} /> Volver</Link>} />
      {error && <div className="error-box">{error}</div>}
      <form className="ax-sale-form" onSubmit={submit}>
        <div className="ax-form-main">
          <section className="form-section">
            <h2>Datos</h2>
            <div className="form-grid">
              <label>Proveedor<select value={form.supplier_id} onChange={(e) => setForm((p) => ({ ...p, supplier_id: e.target.value }))}><option value="">Sin proveedor</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
              <label>Fecha<input type="date" value={form.purchase_date} onChange={(e) => setForm((p) => ({ ...p, purchase_date: e.target.value }))} /></label>
              <label>Notas<input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></label>
            </div>
          </section>
          <section className="form-section">
            <h2>Productos</h2>
            <label>Agregar producto<select value="" onChange={(e) => { addProduct(e.target.value); e.target.value = '' }}><option value="">Seleccionar</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
            <div className="ax-sale-items-list">
              {form.items.map((item, index) => (
                <div className="ax-sale-item-row" key={`${item.product_id}-${index}`}>
                  <strong>{item.name}</strong>
                  <label>Cant.<input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} /></label>
                  <label>Costo unitario<input type="number" min="0" value={item.unit_cost} onChange={(e) => updateItem(index, 'unit_cost', e.target.value)} /></label>
                  <span>{formatGs(Number(item.quantity || 0) * Number(item.unit_cost || 0))}</span>
                  <button className="icon-button" type="button" onClick={() => setForm((p) => ({ ...p, items: p.items.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <button className="secondary-button" type="button" onClick={() => addProduct(products[0]?.id)} disabled={!products.length}><Plus size={16} /> Agregar producto</button>
          </section>
        </div>
        <StickySummary title="Resumen" items={[{ label: 'Items', value: form.items.length }, { label: 'Unidades', value: units }, { label: 'Total', value: formatGs(total) }]}>
          <button className="primary-button big" type="submit" disabled={saving || !form.items.length}><Save size={18} /> {saving ? 'Guardando...' : 'Guardar borrador'}</button>
        </StickySummary>
      </form>
    </div>
  )
}
