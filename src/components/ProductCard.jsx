import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { buildWhatsappUrl, calculateProfit, formatGs, publicStatusLabel } from '../lib/utils'

export function ProductCard({ product }) {
  const profit = calculateProfit(product)
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <img src={product.main_image_url || '/placeholder.svg'} alt={product.name} className="product-image" />
        <span className={`status-pill status-${product.public_stock_status || 'consultar_stock'}`}>{publicStatusLabel(product.public_stock_status)}</span>
      </div>
      <div className="product-card-body">
        <p className="eyebrow">{product.category || 'Producto'}</p>
        <h3>{product.name}</h3>
        {(product.brand || product.model) && <p className="muted">{[product.brand, product.model].filter(Boolean).join(' · ')}</p>}
        <div className="price-grid">
          <span>Mayorista</span><strong>{formatGs(product.wholesale_price)}</strong>
          <span>Sugerido</span><strong>{formatGs(product.suggested_price)}</strong>
          <span>Ganancia</span><strong className="profit">{formatGs(profit)}</strong>
        </div>
        <div className="card-actions">
          <Link className="primary-button" to={`/producto/${product.slug}`}>Ver producto</Link>
          <a className="secondary-button" href={buildWhatsappUrl(product)} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Stock</a>
        </div>
      </div>
    </article>
  )
}
