import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Copy, Download, MessageCircle } from 'lucide-react'
import { getProductBySlug } from '../lib/api'
import { buildWhatsappUrl, calculateProfit, copyToClipboard, formatGs, publicStatusLabel } from '../lib/utils'

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

  if (loading) return <div className="page"><div className="container"><p>Cargando producto...</p></div></div>
  if (error || !data) return <div className="page"><div className="container"><div className="error-box">Producto no encontrado.</div><Link to="/catalogo">Volver al catálogo</Link></div></div>

  const { product, images } = data
  const gallery = [product.main_image_url, ...(images || []).map((image) => image.image_url)].filter(Boolean)
  const profit = calculateProfit(product)
  const descriptionToCopy = `${product.name}\n\n${product.long_description || product.short_description || ''}\n\nPrecio: ${formatGs(product.suggested_price)}\nEntrega: ${product.delivery_time || 'Consultar disponibilidad'}`

  return (
    <div className="page product-sale-page">
      <section className="container product-sale-layout">
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

          <div className="sale-action-list">
            {product.drive_link ? (
              <a className="primary-button big full" href={product.drive_link} target="_blank" rel="noreferrer">
                <Download size={18} />
                Descargar material
              </a>
            ) : (
              <button className="primary-button big full" type="button" disabled>
                <Download size={18} />
                Descargar material
              </button>
            )}
            <button className="secondary-button big full" type="button" onClick={() => handleCopy('Descripción copiada', descriptionToCopy)}>
              <Copy size={18} />
              Copiar descripción
            </button>
            <button className="secondary-button big full" type="button" onClick={() => handleCopy('Texto para estado copiado', product.whatsapp_status_text)}>
              <Copy size={18} />
              Copiar texto para estado
            </button>
            <button className="secondary-button big full" type="button" onClick={() => handleCopy('Texto para Marketplace copiado', product.marketplace_text)}>
              <Copy size={18} />
              Copiar texto para Marketplace
            </button>
            <a className="whatsapp-button big full" href={buildWhatsappUrl(product)} target="_blank" rel="noreferrer">
              <MessageCircle size={18} />
              Consultar stock por WhatsApp
            </a>
          </div>

          {copied && <div className="toast">{copied}</div>}
        </div>
      </section>
    </div>
  )
}
