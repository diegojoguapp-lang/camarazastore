import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getProductoBySlug } from '../lib/api'
import {
  formatGs,
  ganancia,
  waLink,
  mensajeConsultaStock,
  copiar,
} from '../lib/utils'
import { StatusBadge, Spinner } from '../components/ui'
import { useToast } from '../components/Toast'

export default function Producto() {
  const { slug } = useParams()
  const toast = useToast()
  const [p, setP] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeImg, setActiveImg] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    getProductoBySlug(slug)
      .then((data) => {
        if (!active) return
        setP(data)
        setActiveImg(data.main_image_url)
      })
      .catch((e) => active && setError(e.message || 'Producto no encontrado.'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [slug])

  if (loading)
    return <div className="flex justify-center py-32 text-oliva"><Spinner /></div>
  if (error || !p)
    return (
      <div className="mx-auto max-w-md px-5 py-32 text-center">
        <p className="text-humo">{error || 'Producto no encontrado.'}</p>
        <Link to="/catalogo" className="mt-4 inline-block text-oliva underline-offset-4 hover:underline">
          Volver al catálogo
        </Link>
      </div>
    )

  const profit = ganancia(p.suggested_price, p.wholesale_price)
  const gallery = [p.main_image_url, ...(p.product_images || []).map((i) => i.image_url)].filter(Boolean)

  async function handleCopy(text, ok) {
    if (!text) return toast('No hay texto para copiar')
    const done = await copiar(text)
    toast(done ? ok : 'No se pudo copiar')
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Link to="/catalogo" className="text-sm text-humo hover:text-tinta">
        ← Catálogo
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        {/* Galería */}
        <div>
          <div className="aspect-square overflow-hidden rounded-xl2 border border-linea bg-cremaDark">
            {activeImg ? (
              <img src={activeImg} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-humo/40">Sin imagen</div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {gallery.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(url)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                    activeImg === url ? 'border-oliva' : 'border-transparent'
                  }`}
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-center gap-3">
            {p.brand && (
              <span className="text-xs font-medium uppercase tracking-wide text-dorado">
                {p.brand}{p.model ? ` · ${p.model}` : ''}
              </span>
            )}
            <StatusBadge status={p.public_stock_status} />
          </div>
          <h1 className="mt-2 font-display text-3xl leading-tight text-tinta sm:text-4xl">
            {p.name}
          </h1>
          {p.short_description && (
            <p className="mt-3 leading-relaxed text-humo">{p.short_description}</p>
          )}

          {/* Precios */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <PriceBox label="Mayorista" value={formatGs(p.wholesale_price)} />
            <PriceBox label="Sugerido" value={formatGs(p.suggested_price)} />
            <PriceBox label="Ganás" value={formatGs(profit)} highlight />
          </div>

          {/* Acciones principales */}
          <div className="mt-6 space-y-3">
            <a
              href={waLink(mensajeConsultaStock(p))}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center rounded-full bg-wa px-6 py-3.5 font-medium text-white transition-colors hover:bg-waDark"
            >
              Consultar stock por WhatsApp
            </a>
            {p.drive_link && (
              <a
                href={p.drive_link}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center rounded-full bg-oliva px-6 py-3.5 font-medium text-crema transition-colors hover:bg-olivaLight"
              >
                Descargar material
              </a>
            )}
          </div>

          {/* Botones de copiar */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <CopyBtn onClick={() => handleCopy(p.long_description || p.short_description, 'Descripción copiada')}>
              Copiar descripción
            </CopyBtn>
            <CopyBtn onClick={() => handleCopy(p.whatsapp_status_text, 'Texto para estado copiado')}>
              Texto para estado
            </CopyBtn>
            <CopyBtn onClick={() => handleCopy(p.marketplace_text, 'Texto para Marketplace copiado')}>
              Texto Marketplace
            </CopyBtn>
            <CopyBtn onClick={() => handleCopy(p.reseller_group_text, 'Texto para grupo copiado')}>
              Texto para grupo
            </CopyBtn>
          </div>

          {/* Detalles */}
          <dl className="mt-8 divide-y divide-linea border-t border-linea text-sm">
            <Detail label="Categoría" value={p.category} />
            <Detail label="Tiempo de entrega" value={p.delivery_time} />
            <Detail label="Delivery incluido" value={p.delivery_included ? 'Sí' : 'No'} />
            <Detail label="Nota de delivery" value={p.delivery_note} />
            <Detail label="Garantía" value={p.warranty} />
            <Detail label="Cambios / devolución" value={p.return_policy} />
          </dl>

          {p.video_url && (
            <a
              href={p.video_url}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-block text-sm font-medium text-oliva underline-offset-4 hover:underline"
            >
              Ver video del producto →
            </a>
          )}
        </div>
      </div>

      {p.long_description && (
        <section className="mt-12 max-w-2xl">
          <h2 className="font-display text-2xl text-tinta">Descripción</h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-humo">
            {p.long_description}
          </p>
        </section>
      )}
    </div>
  )
}

function PriceBox({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border px-3 py-3 text-center ${
      highlight ? 'border-oliva/30 bg-oliva/8' : 'border-linea bg-white'
    }`}>
      <div className={`text-xs ${highlight ? 'text-oliva' : 'text-humo'}`}>{label}</div>
      <div className={`mt-1 font-display text-base font-600 ${highlight ? 'text-oliva' : 'text-tinta'}`}>
        {value}
      </div>
    </div>
  )
}

function CopyBtn({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-tinta/15 px-3 py-2.5 text-sm font-medium text-tinta transition-colors hover:border-tinta/40 hover:bg-white"
    >
      {children}
    </button>
  )
}

function Detail({ label, value }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-humo">{label}</dt>
      <dd className="text-right font-medium text-tinta">{value}</dd>
    </div>
  )
}
