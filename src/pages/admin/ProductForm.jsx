import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createProduct, getProductById, updateProduct } from '../../lib/api'
import { calculateProfit, formatGs, imageFallback, slugify } from '../../lib/utils'

const initial = {
  name: '', slug: '', brand: '', model: '', category: '',
  internal_status: 'active', public_stock_status: 'consultar_stock',
  cost_price: 0, wholesale_price: 0, suggested_price: 0, stock_quantity: '',
  delivery_time: 'Dentro de las 24 horas según disponibilidad', delivery_included: false, delivery_note: 'El delivery no está incluido en el precio mayorista.',
  warranty: '48 horas por falla de fábrica', return_policy: 'La comisión se confirma cuando la venta fue entregada correctamente y no hay reclamo pendiente.',
  short_description: '', long_description: '', whatsapp_status_text: '', marketplace_text: '', reseller_group_text: '', custom_whatsapp_message: '',
  drive_link: '', video_url: '', main_image_url: ''
}

export function ProductForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(initial)
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
      setExistingImages(data.images || [])
    }).catch((err) => setError(err.message))
  }, [id, editing])

  const profit = useMemo(() => calculateProfit(form), [form])

  const setField = (name, value) => {
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'name' && !editing) next.slug = slugify(value)
      return next
    })
  }

  const generateTexts = () => {
    const price = formatGs(form.suggested_price)
    const wholesale = formatGs(form.wholesale_price)
    const profitText = formatGs(profit)
    setForm((prev) => ({
      ...prev,
      whatsapp_status_text: `Disponible ${prev.name}. ${prev.short_description || ''} Precio: ${price}. Consultar disponibilidad.`,
      marketplace_text: `${prev.name}. Producto nuevo. ${prev.long_description || prev.short_description || ''} Entrega disponible. Consultar stock.`,
      reseller_group_text: `📦 PRODUCTO DISPONIBLE PARA REVENTA\n\nProducto: ${prev.name}\nPrecio mayorista: ${wholesale}\nPrecio sugerido: ${price}\nPosible ganancia: ${profitText}\nDelivery no incluido. Consultar stock antes de vender.`
    }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        cost_price: Number(form.cost_price || 0),
        wholesale_price: Number(form.wholesale_price || 0),
        suggested_price: Number(form.suggested_price || 0),
        stock_quantity: form.stock_quantity === '' ? null : Number(form.stock_quantity),
        slug: slugify(form.slug || form.name)
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

  const toggleDeleteImage = (imageId) => setDeleteImages((prev) => prev.includes(imageId) ? prev.filter(item => item !== imageId) : [...prev, imageId])

  return (
    <div className="admin-page">
      <div className="admin-head"><div><p className="eyebrow">Productos</p><h1>{editing ? 'Editar producto' : 'Agregar producto'}</h1></div><Link className="secondary-button" to="/admin/productos">Volver</Link></div>
      {error && <div className="error-box">{error}</div>}
      <form className="product-form" onSubmit={submit}>
        <section className="form-section"><h2>Datos básicos</h2><div className="form-grid"><label>Nombre<input value={form.name} onChange={(e) => setField('name', e.target.value)} required /></label><label>Slug<input value={form.slug} onChange={(e) => setField('slug', e.target.value)} required /></label><label>Marca<input value={form.brand || ''} onChange={(e) => setField('brand', e.target.value)} /></label><label>Modelo<input value={form.model || ''} onChange={(e) => setField('model', e.target.value)} /></label><label>Categoría<input value={form.category || ''} onChange={(e) => setField('category', e.target.value)} /></label><label>Estado interno<select value={form.internal_status} onChange={(e) => setField('internal_status', e.target.value)}><option value="active">Activo</option><option value="hidden">Oculto</option><option value="sold_out">Agotado</option></select></label><label>Estado público<select value={form.public_stock_status} onChange={(e) => setField('public_stock_status', e.target.value)}><option value="disponible">Disponible</option><option value="consultar_stock">Consultar stock</option><option value="ultimas_unidades">Últimas unidades</option><option value="agotado">Agotado</option></select></label></div></section>
        <section className="form-section"><h2>Precios</h2><div className="form-grid"><label>Costo interno<input type="number" value={form.cost_price || 0} onChange={(e) => setField('cost_price', e.target.value)} /></label><label>Precio mayorista *<input type="number" value={form.wholesale_price || 0} onChange={(e) => setField('wholesale_price', e.target.value)} required /></label><label>Precio sugerido *<input type="number" value={form.suggested_price || 0} onChange={(e) => setField('suggested_price', e.target.value)} required /></label><div className="calculated-box"><span>Posible ganancia</span><strong>{formatGs(profit)}</strong></div></div></section>
        <section className="form-section"><h2>Stock, entrega y garantía</h2><div className="form-grid"><label>Stock interno<input type="number" value={form.stock_quantity || ''} onChange={(e) => setField('stock_quantity', e.target.value)} /></label><label>Tiempo de entrega<input value={form.delivery_time || ''} onChange={(e) => setField('delivery_time', e.target.value)} /></label><label className="checkbox-label"><input type="checkbox" checked={Boolean(form.delivery_included)} onChange={(e) => setField('delivery_included', e.target.checked)} /> Delivery incluido</label><label>Nota de delivery<textarea value={form.delivery_note || ''} onChange={(e) => setField('delivery_note', e.target.value)} /></label><label>Garantía<textarea value={form.warranty || ''} onChange={(e) => setField('warranty', e.target.value)} /></label><label>Condiciones de cambio/devolución<textarea value={form.return_policy || ''} onChange={(e) => setField('return_policy', e.target.value)} /></label></div></section>
        <section className="form-section"><h2>Descripciones y textos</h2><button type="button" className="secondary-button" onClick={generateTexts}>Generar textos base</button><div className="form-grid single"><label>Descripción corta<textarea value={form.short_description || ''} onChange={(e) => setField('short_description', e.target.value)} /></label><label>Descripción larga<textarea rows="5" value={form.long_description || ''} onChange={(e) => setField('long_description', e.target.value)} /></label><label>Texto para estado WhatsApp<textarea rows="4" value={form.whatsapp_status_text || ''} onChange={(e) => setField('whatsapp_status_text', e.target.value)} /></label><label>Texto para Marketplace<textarea rows="5" value={form.marketplace_text || ''} onChange={(e) => setField('marketplace_text', e.target.value)} /></label><label>Texto para grupo de revendedores<textarea rows="5" value={form.reseller_group_text || ''} onChange={(e) => setField('reseller_group_text', e.target.value)} /></label><label>Mensaje personalizado de WhatsApp<textarea rows="4" value={form.custom_whatsapp_message || ''} onChange={(e) => setField('custom_whatsapp_message', e.target.value)} /></label></div></section>
        <section className="form-section"><h2>Material</h2><div className="form-grid"><label>Foto principal<input type="file" accept="image/*" onChange={(e) => setMainFile(e.target.files?.[0] || null)} /></label><label>URL foto principal<input value={form.main_image_url || ''} onChange={(e) => setField('main_image_url', e.target.value)} /></label><label>Fotos secundarias<input type="file" accept="image/*" multiple onChange={(e) => setGalleryFiles(Array.from(e.target.files || []))} /></label><label>Video URL<input value={form.video_url || ''} onChange={(e) => setField('video_url', e.target.value)} /></label><label>Link carpeta Google Drive<input value={form.drive_link || ''} onChange={(e) => setField('drive_link', e.target.value)} /></label></div>{existingImages.length > 0 && <div className="existing-images"><h3>Fotos actuales</h3>{existingImages.map(image => <label key={image.id} className="image-delete"><img src={image.image_url || '/placeholder.svg'} alt="Producto" onError={imageFallback} /><input type="checkbox" checked={deleteImages.includes(image.id)} onChange={() => toggleDeleteImage(image.id)} /> Eliminar</label>)}</div>}</section>
        <div className="sticky-actions"><button type="submit" className="primary-button big" disabled={saving}>{saving ? 'Guardando...' : 'Guardar producto'}</button></div>
      </form>
    </div>
  )
}
