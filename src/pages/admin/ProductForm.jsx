import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createProduct, getProductById, updateProduct } from '../../lib/api'
import { calculateProfit, formatGs, imageFallback, slugify } from '../../lib/utils'

const initial = {
  name: '', slug: '', brand: '', model: '', category: '',
  internal_status: 'active', public_stock_status: 'consultar_stock',
  cost_price: 0, wholesale_price: 0, suggested_price: 0, stock_quantity: '',
  delivery_time: '24 horas', delivery_included: false, delivery_note: '',
  warranty: '48 horas por falla de fábrica', return_policy: '',
  short_description: '', long_description: '', whatsapp_status_text: '', marketplace_text: '',
  reseller_group_text: '', custom_whatsapp_message: '', drive_link: '', video_url: '', main_image_url: ''
}

const emptyFaq = { question: '', answer: '' }

function parseFaqs(value) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) && parsed.length ? parsed : [{ ...emptyFaq }]
  } catch {
    return [{ ...emptyFaq }]
  }
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function PriceInput({ label, value, onChange, required }) {
  return (
    <label>{label}{required ? ' *' : ''}
      <input
        inputMode="numeric"
        value={value ? formatGs(value) : ''}
        onChange={(event) => onChange(Number(onlyDigits(event.target.value) || 0))}
        placeholder="0 Gs."
        required={required}
      />
    </label>
  )
}

function statusFromProduct(product) {
  if (product.internal_status === 'hidden') return 'hidden'
  if (product.public_stock_status === 'agotado' || product.internal_status === 'sold_out') return 'sold_out'
  return 'active'
}

export function ProductForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(initial)
  const [faqs, setFaqs] = useState([{ ...emptyFaq }])
  const [mainFile, setMainFile] = useState(null)
  const [galleryFiles, setGalleryFiles] = useState([])
  const [existingImages, setExistingImages] = useState([])
  const [deleteImages, setDeleteImages] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!editing) return
    getProductById(id).then((data) => {
      setForm({ ...initial, ...data.product, stock_quantity: data.product.stock_quantity ?? '' })
      setFaqs(parseFaqs(data.product.reseller_group_text))
      setExistingImages(data.images || [])
    }).catch((err) => setError(err.message))
  }, [id, editing])

  const profit = useMemo(() => calculateProfit(form), [form])
  const selectedStatus = statusFromProduct(form)

  const setField = (name, value) => {
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'name' && !editing) next.slug = slugify(value)
      return next
    })
  }

  const setStatus = (value) => {
    if (value === 'hidden') {
      setForm((prev) => ({ ...prev, internal_status: 'hidden', public_stock_status: 'consultar_stock' }))
      return
    }
    if (value === 'sold_out') {
      setForm((prev) => ({ ...prev, internal_status: 'active', public_stock_status: 'agotado' }))
      return
    }
    setForm((prev) => ({ ...prev, internal_status: 'active', public_stock_status: 'consultar_stock' }))
  }

  const setFaq = (index, field, value) => {
    setFaqs((prev) => prev.map((faq, itemIndex) => itemIndex === index ? { ...faq, [field]: value } : faq))
  }

  const addFaq = () => setFaqs((prev) => [...prev, { ...emptyFaq }])
  const removeFaq = (index) => setFaqs((prev) => prev.filter((_, itemIndex) => itemIndex !== index))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const cleanFaqs = faqs.filter((faq) => faq.question.trim() && faq.answer.trim())
      const payload = {
        ...form,
        category: null,
        cost_price: Number(form.cost_price || 0),
        wholesale_price: Number(form.wholesale_price || 0),
        suggested_price: Number(form.suggested_price || 0),
        stock_quantity: form.stock_quantity === '' ? null : Number(form.stock_quantity),
        slug: slugify(form.slug || form.name),
        reseller_group_text: JSON.stringify(cleanFaqs)
      }
      if (editing) await updateProduct(id, payload, { main: mainFile, gallery: galleryFiles }, deleteImages)
      else await createProduct(payload, { main: mainFile, gallery: galleryFiles })
      window.alert('Producto guardado correctamente')
      navigate('/admin/productos')
    } catch (err) {
      setError(err.message || 'Error al guardar producto')
      window.alert('Error al guardar producto')
    } finally {
      setSaving(false)
    }
  }

  const toggleDeleteImage = (imageId) => setDeleteImages((prev) => prev.includes(imageId) ? prev.filter((item) => item !== imageId) : [...prev, imageId])

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div><p className="eyebrow">Productos</p><h1>{editing ? 'Editar producto' : 'Agregar producto'}</h1></div>
        <Link className="secondary-button" to="/admin/productos">Volver</Link>
      </div>
      {error && <div className="error-box">{error}</div>}

      <form className="product-form" onSubmit={submit}>
        <section className="form-section">
          <h2>Datos básicos</h2>
          <div className="form-grid">
            <label>Título del producto *<input value={form.name} onChange={(e) => setField('name', e.target.value)} required /></label>
            <label>Slug *<input value={form.slug} onChange={(e) => setField('slug', e.target.value)} required /></label>
            <label>Marca<input value={form.brand || ''} onChange={(e) => setField('brand', e.target.value)} /></label>
            <label>Modelo<input value={form.model || ''} onChange={(e) => setField('model', e.target.value)} /></label>
            <label>Estado
              <select value={selectedStatus} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Hay stock</option>
                <option value="sold_out">Agotado</option>
                <option value="hidden">Oculto</option>
              </select>
            </label>
            <label>Stock<input type="number" value={form.stock_quantity || ''} onChange={(e) => setField('stock_quantity', e.target.value)} /></label>
          </div>
        </section>

        <section className="form-section">
          <h2>Precios</h2>
          <div className="form-grid">
            <PriceInput label="Costo" value={form.cost_price} onChange={(value) => setField('cost_price', value)} />
            <PriceInput label="Precio mayorista" value={form.wholesale_price} onChange={(value) => setField('wholesale_price', value)} required />
            <PriceInput label="Precio sugerido" value={form.suggested_price} onChange={(value) => setField('suggested_price', value)} required />
            <div className="calculated-box"><span>Posible ganancia</span><strong>{formatGs(profit)}</strong></div>
          </div>
        </section>

        <section className="form-section">
          <h2>Descripción</h2>
          <div className="form-grid single">
            <label>Descripción corta<textarea value={form.short_description || ''} onChange={(e) => setField('short_description', e.target.value)} /></label>
            <label>Descripción<textarea rows="5" value={form.long_description || ''} onChange={(e) => setField('long_description', e.target.value)} /></label>
          </div>
        </section>

        <section className="form-section">
          <h2>Entrega</h2>
          <div className="form-grid">
            <label className="checkbox-label"><input type="checkbox" checked={Boolean(form.delivery_included)} onChange={(e) => setField('delivery_included', e.target.checked)} /> Delivery incluido</label>
            <label>Tiempo de entrega<input value={form.delivery_time || ''} onChange={(e) => setField('delivery_time', e.target.value)} /></label>
            <label>Garantía<input value={form.warranty || ''} onChange={(e) => setField('warranty', e.target.value)} /></label>
          </div>
        </section>

        <section className="form-section">
          <h2>Material</h2>
          <div className="form-grid">
            <label>Imagen principal<input type="file" accept="image/*" onChange={(e) => setMainFile(e.target.files?.[0] || null)} /></label>
            <label>URL imagen principal<input value={form.main_image_url || ''} onChange={(e) => setField('main_image_url', e.target.value)} /></label>
            <label>Imágenes secundarias<input type="file" accept="image/*" multiple onChange={(e) => setGalleryFiles(Array.from(e.target.files || []))} /></label>
            <label>Link carpeta Google Drive<input value={form.drive_link || ''} onChange={(e) => setField('drive_link', e.target.value)} /></label>
          </div>
          {existingImages.length > 0 && (
            <div className="existing-images">
              <h3>Fotos actuales</h3>
              {existingImages.map((image) => (
                <label key={image.id} className="image-delete">
                  <img src={image.image_url || '/placeholder.svg'} alt="Producto" width="140" height="140" loading="lazy" decoding="async" onError={imageFallback} />
                  <input type="checkbox" checked={deleteImages.includes(image.id)} onChange={() => toggleDeleteImage(image.id)} /> Eliminar
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="form-section">
          <h2>Preguntas frecuentes</h2>
          <div className="faq-admin-list">
            {faqs.map((faq, index) => (
              <div className="faq-admin-row" key={index}>
                <label>Pregunta<input value={faq.question} onChange={(e) => setFaq(index, 'question', e.target.value)} /></label>
                <label>Respuesta<textarea value={faq.answer} onChange={(e) => setFaq(index, 'answer', e.target.value)} /></label>
                {faqs.length > 1 && <button className="secondary-button" type="button" onClick={() => removeFaq(index)}>Quitar</button>}
              </div>
            ))}
          </div>
          <button className="secondary-button" type="button" onClick={addFaq}>Agregar pregunta</button>
        </section>

        <div className="sticky-actions"><button type="submit" className="primary-button big" disabled={saving}>{saving ? 'Guardando...' : 'Guardar producto'}</button></div>
      </form>
    </div>
  )
}
