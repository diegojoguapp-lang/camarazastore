import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Copy, Download } from 'lucide-react'
import { getProductBySlug } from '../lib/api'
import { calculateProfit, copyToClipboard, formatGs, publicStatusLabel } from '../lib/utils'

const fallbackFaqs = [
  {
    question: '¿Cuánto dura la batería de este producto?',
    answer: 'La batería de este producto dura aproximadamente 2 a 3 horas.'
  },
  {
    question: '¿Este producto tiene garantía?',
    answer: 'Sí, este producto cuenta con garantía de 48 horas por error de fábrica.'
  }
]

function normalizeFaqs(product) {
  if (Array.isArray(product?.faqs)) return product.faqs
  if (Array.isArray(product?.faq_items)) return product.faq_items
  if (typeof product?.faq_items === 'string') {
    try {
      const parsed = JSON.parse(product.faq_items)
      if (Array.isArray(parsed)) return parsed
    } catch {
      return fallbackFaqs
    }
  }
  return fallbackFaqs
}

export function ProductDetail() {
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    getProductBySlug(slug)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  const handleCopy = async (label, text) => {
    const ok = await copyToClipboard(text)
    setCopied(ok ? label : 'No se pudo copiar')
    setTimeout(() => setCopied(''), 1800)
  }

  const product = data?.product
  const images = data?.images || []
  const faqs = useMemo(() => normalizeFaqs(product), [product])

  if (loading) return <div className="page"><div className="container"><p>Cargando producto...</p></div></div>
  if (error || !data) return <div className="page"><div className="container"><div className="error-box">Producto no encontrado.</div><Link to="/catalogo">Volver al catálogo</Link></div></div>

  const gallery = [product.main_image_url, ...images.map((image) => image.image_url)].filter(Boolean)
  const profit = calculateProfit(product)
  const descriptionToCopy = `${product.name}\n\n${product.long_description || product.short_description || ''}\n\nPrecio: ${formatGs(product.suggested_price)}\nEntrega: ${product.delivery_time || 'Consultar disponibilidad'}`

  return (
    <div className="page product-sale-page simple-detail-page">
      <section className="container product-sale-layout simple-detail-layout">
        <Link className="back-link" to="/catalogo">
          <ArrowLeft size={17} />
          Volver
        </Link>

        <div className="product-sale-media">
          <img src={product.main_image_url || '/placeholder.svg'} alt={product.name} className="detail-main-image" />
          {gallery.length > 1 && (
            <div className="thumb-row">
              {gallery.map((url, index) => <img key={`${url}-${index}`} src={url} alt={`${product.name} ${index + 1}`} />)}
            </div>
          )}
        </div>

        <div className="product-sale-info">
          <h1>{product.name}</h1>
          <span className={`stock-chip status-${product.public_stock_status || 'consultar_stock'}`}>
            {publicStatusLabel(product.public_stock_status)}
          </span>

          <div className="sale-price-list">
            <div>
              <span>Precio sugerido</span>
              <strong>{formatGs(product.suggested_price)}</strong>
            </div>
            <div>
              <span>Precio mayorista</span>
              <strong>{formatGs(product.wholesale_price)}</strong>
            </div>
            <div className="profit-highlight">
              <span>Ganancia posible</span>
              <strong>{formatGs(profit)}</strong>
            </div>
          </div>

          {product.short_description && <p className="lead small-lead">{product.short_description}</p>}

          <div className="sale-action-list two-actions-only">
            {product.drive_link ? (
              <a className="primary-button big full" href={product.drive_link} target="_blank" rel="noreferrer">
                <Download size={18} />
                Descargar imágenes y videos
              </a>
            ) : (
              <button className="primary-button big full" type="button" disabled>
                <Download size={18} />
                Descargar imágenes y videos
              </button>
            )}
            <button className="secondary-button big full" type="button" onClick={() => handleCopy('Descripción copiada', descriptionToCopy)}>
              <Copy size={18} />
              Copiar descripción
            </button>
          </div>

          <section className="faq-section">
            <h2>Preguntas frecuentes</h2>
            <div className="faq-list">
              {faqs.map((faq, index) => (
                <article className="faq-item" key={`${faq.question}-${index}`}>
                  <h3>{faq.question}</h3>
                  <p>{faq.answer}</p>
                  <button className="secondary-button" type="button" onClick={() => handleCopy('Respuesta copiada', faq.answer)}>
                    <Copy size={16} />
                    Copiar respuesta
                  </button>
                </article>
              ))}
            </div>
          </section>

          {copied && <div className="toast">{copied}</div>}
        </div>
      </section>
    </div>
  )
}
