import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  createProduct,
  updateProduct,
  getProductById,
  uploadImage,
  addProductImage,
  deleteProductImage,
} from '../lib/api'
import { slugify, formatGs, ganancia } from '../lib/utils'
import { CATEGORIES, PUBLIC_STATUS, INTERNAL_STATUS } from '../config/site'
import { Spinner } from '../components/ui'
import { useToast } from '../components/Toast'

const empty = {
  name: '', slug: '', brand: '', model: '', category: '',
  internal_status: 'active', public_stock_status: 'consultar_stock',
  cost_price: '', wholesale_price: '', suggested_price: '',
  stock_quantity: '', delivery_time: '', delivery_included: false,
  delivery_note: '', warranty: '', return_policy: '',
  short_description: '', long_description: '',
  whatsapp_status_text: '', marketplace_text: '', reseller_group_text: '',
  custom_whatsapp_message: '', drive_link: '', video_url: '', main_image_url: '',
}

export default function ProductForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState(empty)
  const [images, setImages] = useState([]) // product_images existentes
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)

  useEffect(() => {
    if (!editing) return
    getProductById(id)
      .then((p) => {
        setForm({ ...empty, ...p })
        setImages(p.product_images || [])
        setSlugTouched(true)
      })
      .catch(() => toast('No se pudo cargar el producto'))
      .finally(() => setLoading(false))
  }, [id])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function onName(value) {
    set('name', value)
    if (!slugTouched) set('slug', slugify(value))
  }

  const profit = ganancia(form.suggested_price, form.wholesale_price)

  // payload limpio para Supabase (numéricos como número, vacíos como null)
  function buildPayload() {
    const num = (v) => (v === '' || v == null ? null : Number(v))
    return {
      name: form.name,
      slug: form.slug || slugify(form.name),
      brand: form.brand || null,
      model: form.model || null,
      category: form.category || null,
      internal_status: form.internal_status,
      public_stock_status: form.public_stock_status,
      cost_price: num(form.cost_price) ?? 0,
      wholesale_price: num(form.wholesale_price) ?? 0,
      suggested_price: num(form.suggested_price) ?? 0,
      stock_quantity: num(form.stock_quantity),
      delivery_time: form.delivery_time || null,
      delivery_included: !!form.delivery_included,
      delivery_note: form.delivery_note || null,
      warranty: form.warranty || null,
      return_policy: form.return_policy || null,
      short_description: form.short_description || null,
      long_description: form.long_description || null,
      whatsapp_status_text: form.whatsapp_status_text || null,
      marketplace_text: form.marketplace_text || null,
      reseller_group_text: form.reseller_group_text || null,
      custom_whatsapp_message: form.custom_whatsapp_message || null,
      drive_link: form.drive_link || null,
      video_url: form.video_url || null,
      main_image_url: form.main_image_url || null,
    }
  }

  async function handleMainImage(file) {
    if (!file) return
    try {
      toast('Subiendo imagen…')
      const url = await uploadImage(file)
      set('main_image_url', url)
      toast('Imagen principal lista')
    } catch (e) {
      toast('Error al subir la imagen')
    }
  }

  async function handleSecondaryImages(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return
    if (!editing) {
      toast('Guardá primero el producto para agregar fotos secundarias')
      return
    }
    try {
      toast('Subiendo fotos…')
      for (const f of files) {
        const url = await uploadImage(f)
        const row = await addProductImage(id, url, images.length)
        setImages((prev) => [...prev, row])
      }
      toast('Fotos agregadas')
    } catch (e) {
      toast('Error al subir fotos')
    }
  }

  async function removeSecondary(imgId) {
    try {
      await deleteProductImage(imgId)
      setImages((prev) => prev.filter((i) => i.id !== imgId))
      toast('Foto eliminada')
    } catch {
      toast('No se pudo eliminar')
    }
  }

  async function handleSubmit() {
    if (!form.name.trim()) return toast('El nombre es obligatorio')
    setSaving(true)
    try {
      if (editing) {
        await updateProduct(id, buildPayload())
        toast('Cambios guardados')
      } else {
        const created = await createProduct(buildPayload())
        toast('Producto creado')
        navigate(`/admin/productos/${created.id}/editar`)
        return
      }
    } catch (e) {
      toast(e.message?.includes('duplicate') ? 'Ese slug ya existe' : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return <div className="flex justify-center py-24 text-oliva"><Spinner /></div>

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-tinta">
          {editing ? 'Editar producto' : 'Nuevo producto'}
        </h1>
        {editing && form.slug && (
          <Link to={`/producto/${form.slug}`} target="_blank" className="text-sm text-oliva hover:underline">
            Vista previa →
          </Link>
        )}
      </div>

      <div className="mt-6 space-y-8">
        {/* Datos básicos */}
        <Section title="Datos básicos">
          <Grid>
            <Field label="Nombre del producto" full>
              <Input value={form.name} onChange={onName} />
            </Field>
            <Field label="Slug (URL)">
              <Input
                value={form.slug}
                onChange={(v) => { setSlugTouched(true); set('slug', v) }}
              />
            </Field>
            <Field label="Categoría">
              <Select value={form.category} onChange={(v) => set('category', v)} options={['', ...CATEGORIES]} labels={{ '': 'Sin categoría' }} />
            </Field>
            <Field label="Marca">
              <Input value={form.brand} onChange={(v) => set('brand', v)} />
            </Field>
            <Field label="Modelo">
              <Input value={form.model} onChange={(v) => set('model', v)} />
            </Field>
            <Field label="Estado interno">
              <Select value={form.internal_status} onChange={(v) => set('internal_status', v)} options={Object.keys(INTERNAL_STATUS)} labels={INTERNAL_STATUS} />
            </Field>
            <Field label="Estado público">
              <Select value={form.public_stock_status} onChange={(v) => set('public_stock_status', v)} options={Object.keys(PUBLIC_STATUS)} labels={Object.fromEntries(Object.entries(PUBLIC_STATUS).map(([k, v]) => [k, v.label]))} />
            </Field>
          </Grid>
        </Section>

        {/* Precios */}
        <Section title="Precios">
          <Grid>
            <Field label="Precio costo (solo admin)">
              <Input type="number" value={form.cost_price} onChange={(v) => set('cost_price', v)} />
            </Field>
            <Field label="Precio mayorista">
              <Input type="number" value={form.wholesale_price} onChange={(v) => set('wholesale_price', v)} />
            </Field>
            <Field label="Precio sugerido">
              <Input type="number" value={form.suggested_price} onChange={(v) => set('suggested_price', v)} />
            </Field>
            <Field label="Ganancia estimada (automática)">
              <div className="rounded-lg border border-oliva/30 bg-oliva/8 px-3 py-2.5 font-medium text-oliva">
                {formatGs(profit)}
              </div>
            </Field>
          </Grid>
        </Section>

        {/* Stock y entrega */}
        <Section title="Stock y entrega">
          <Grid>
            <Field label="Stock interno (opcional)">
              <Input type="number" value={form.stock_quantity} onChange={(v) => set('stock_quantity', v)} />
            </Field>
            <Field label="Tiempo de entrega">
              <Input value={form.delivery_time} onChange={(v) => set('delivery_time', v)} placeholder="Ej: dentro de 24hs" />
            </Field>
            <Field label="Delivery incluido">
              <label className="flex items-center gap-2 py-2.5 text-sm text-tinta">
                <input type="checkbox" checked={form.delivery_included} onChange={(e) => set('delivery_included', e.target.checked)} className="h-4 w-4 accent-oliva" />
                Sí, incluye delivery
              </label>
            </Field>
            <Field label="Nota de delivery">
              <Input value={form.delivery_note} onChange={(v) => set('delivery_note', v)} />
            </Field>
          </Grid>
        </Section>

        {/* Garantía */}
        <Section title="Garantía">
          <Grid>
            <Field label="Garantía">
              <Input value={form.warranty} onChange={(v) => set('warranty', v)} placeholder="Ej: 48hs por falla de fábrica" />
            </Field>
            <Field label="Cambios / devolución">
              <Input value={form.return_policy} onChange={(v) => set('return_policy', v)} />
            </Field>
          </Grid>
        </Section>

        {/* Descripciones y textos */}
        <Section title="Descripciones y textos de venta">
          <Field label="Descripción corta" full>
            <Textarea rows={2} value={form.short_description} onChange={(v) => set('short_description', v)} />
          </Field>
          <Field label="Descripción larga" full>
            <Textarea rows={4} value={form.long_description} onChange={(v) => set('long_description', v)} />
          </Field>
          <Field label="Texto para estado de WhatsApp" full>
            <Textarea rows={2} value={form.whatsapp_status_text} onChange={(v) => set('whatsapp_status_text', v)} />
          </Field>
          <Field label="Texto para Marketplace" full>
            <Textarea rows={2} value={form.marketplace_text} onChange={(v) => set('marketplace_text', v)} />
          </Field>
          <Field label="Texto para grupo de revendedores" full>
            <Textarea rows={2} value={form.reseller_group_text} onChange={(v) => set('reseller_group_text', v)} />
          </Field>
          <Field label="Mensaje personalizado de WhatsApp (opcional)" full>
            <Textarea rows={2} value={form.custom_whatsapp_message} onChange={(v) => set('custom_whatsapp_message', v)} placeholder="Si lo dejás vacío se genera automáticamente." />
          </Field>
        </Section>

        {/* Material */}
        <Section title="Material">
          <Field label="Foto principal" full>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-cremaDark">
                {form.main_image_url && <img src={form.main_image_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <input type="file" accept="image/*" onChange={(e) => handleMainImage(e.target.files[0])} className="text-sm text-humo file:mr-3 file:rounded-full file:border-0 file:bg-oliva file:px-4 file:py-2 file:text-sm file:font-medium file:text-crema" />
            </div>
          </Field>

          <Field label="Fotos secundarias" full>
            {!editing && <p className="mb-2 text-xs text-humo">Guardá el producto primero para poder subir fotos secundarias.</p>}
            <div className="flex flex-wrap gap-2">
              {images.map((img) => (
                <div key={img.id} className="relative h-20 w-20 overflow-hidden rounded-lg bg-cremaDark">
                  <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => removeSecondary(img.id)} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-tinta/80 text-xs text-crema">×</button>
                </div>
              ))}
            </div>
            <input type="file" accept="image/*" multiple disabled={!editing} onChange={(e) => handleSecondaryImages(e.target.files)} className="mt-2 text-sm text-humo file:mr-3 file:rounded-full file:border-0 file:bg-tinta/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-tinta disabled:opacity-50" />
          </Field>

          <Grid>
            <Field label="Video URL">
              <Input value={form.video_url} onChange={(v) => set('video_url', v)} placeholder="Link de YouTube, Drive, etc." />
            </Field>
            <Field label="Link de carpeta Google Drive">
              <Input value={form.drive_link} onChange={(v) => set('drive_link', v)} />
            </Field>
          </Grid>
        </Section>

        {/* Guardar */}
        <div className="sticky bottom-4 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center justify-center rounded-full bg-oliva px-8 py-3 font-medium text-crema shadow-cardHover transition-colors hover:bg-olivaLight disabled:opacity-60"
          >
            {saving ? <Spinner className="text-crema" /> : editing ? 'Guardar cambios' : 'Crear producto'}
          </button>
          <Link
            to="/admin/productos"
            className="flex items-center rounded-full border border-tinta/15 bg-white px-6 py-3 font-medium text-tinta hover:border-tinta/40"
          >
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ---- subcomponentes de formulario ---- */
function Section({ title, children }) {
  return (
    <section className="rounded-xl2 border border-linea bg-white p-6 shadow-card">
      <h2 className="mb-4 font-display text-xl text-tinta">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
function Grid({ children }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>
}
function Field({ label, children, full }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-sm font-medium text-tinta">{label}</span>
      {children}
    </label>
  )
}
function Input({ value, onChange, type = 'text', placeholder }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-linea bg-crema px-3 py-2.5 text-sm outline-none focus:border-oliva"
    />
  )
}
function Textarea({ value, onChange, rows = 3, placeholder }) {
  return (
    <textarea
      rows={rows}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-y rounded-lg border border-linea bg-crema px-3 py-2.5 text-sm outline-none focus:border-oliva"
    />
  )
}
function Select({ value, onChange, options, labels = {} }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-linea bg-crema px-3 py-2.5 text-sm outline-none focus:border-oliva"
    >
      {options.map((o) => (
        <option key={o} value={o}>{labels[o] ?? o}</option>
      ))}
    </select>
  )
}
