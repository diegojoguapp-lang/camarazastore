import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Copy, Download, MessageCircle } from 'lucide-react'
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
    await copyToClipboard(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 1800)
  }

  if (loading) return <div className="page"><div className="container"><p>Cargando producto...</p></div></div>
  if (error || !data) return <div className="page"><div className="container"><div className="error-box">Producto no encontrado.</div><Link to="/catalogo">Volver al catálogo</Link></div></div>

  const { product, images } = data
  const gallery = [product.main_image_url, ...(images || []).map(i => i.image_url)].filter(Boolean)
  const profit = calculateProfit(product)
  const descriptionToCopy = `${product.name}\n\n${product.long_description || product.short_description || ''}\n\nPrecio: ${formatGs(product.suggested_price)}\nEntrega: ${product.delivery_time || 'Consultar disponibilidad'}`

  return (
    <div className="page">
      <section className="container product-detail">
        <div className="gallery-panel">
          <img src={product.main_image_url || '/placeholder.svg'} alt={product.name} className="detail-main-image" />
          {gallery.length > 1 && <div className="thumb-row">{gallery.map((url, index) => <img key={`${url}-${index}`} src={url} alt={`${product.name} ${index + 1}`} />)}</div>}
          {product.video_url && <a className="secondary-button full" href={product.video_url} target="_blank" rel="noreferrer">Ver video del producto</a>}
        </div>
        <div className="detail-info">
          <p className="eyebrow">{product.category || 'Producto'} · {publicStatusLabel(product.public_stock_status)}</p>
          <h1>{product.name}</h1>
          {(product.brand || product.model) && <p className="muted large">{[product.brand, product.model].filter(Boolean).join(' · ')}</p>}
          <p className="lead small-lead">{product.short_description}</p>
          <div className="detail-prices">
            <div><span>Precio mayorista</span><strong>{formatGs(product.wholesale_price)}</strong></div>
            <div><span>Precio sugerido</span><strong>{formatGs(product.suggested_price)}</strong></div>
            <div className="profit-box"><span>Ganancia posible</span><strong>{formatGs(profit)}</strong></div>
          </div>
          <div className="button-stack">
            <a className="primary-button big" href={buildWhatsappUrl(product)} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Consultar stock por WhatsApp</a>
            {product.drive_link && <a className="secondary-button big" href={product.drive_link} target="_blank" rel="noreferrer"><Download size={18} /> Descargar material</a>}
          </div>
          {copied && <div className="toast">{copied} copiado</div>}
        </div>
      </section>
      <section className="container two-columns product-extra">
        <div className="panel"><h2>Descripción</h2><p className="preline">{product.long_description || product.short_description}</p><h3>Entrega y garantía</h3><p><strong>Entrega:</strong> {product.delivery_time || 'Consultar disponibilidad'}</p><p><strong>Delivery:</strong> {product.delivery_included ? 'Incluido' : 'No incluido'}</p>{product.delivery_note && <p>{product.delivery_note}</p>}<p><strong>Garantía:</strong> {product.warranty || 'Consultar'}</p>{product.return_policy && <p>{product.return_policy}</p>}</div>
        <div className="panel"><h2>Textos para copiar</h2><div className="copy-list"><button onClick={() => handleCopy('Descripción', descriptionToCopy)}><Copy size={16} /> Copiar descripción</button><button onClick={() => handleCopy('Texto para estado', product.whatsapp_status_text)}><Copy size={16} /> Copiar texto para estado</button><button onClick={() => handleCopy('Texto para Marketplace', product.marketplace_text)}><Copy size={16} /> Copiar texto para Marketplace</button><button onClick={() => handleCopy('Texto para grupo', product.reseller_group_text)}><Copy size={16} /> Copiar texto para grupo de revendedores</button></div></div>
      </section>
    </div>
  )
}
