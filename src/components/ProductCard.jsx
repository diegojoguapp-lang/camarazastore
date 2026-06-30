import { Link } from 'react-router-dom'
import { calculateProfit, formatGs, getDisplayImageUrl, imageFallback, publicStatusLabel } from '../lib/utils'

export function ProductCard({ product }) {
  const profit = calculateProfit(product)

  return (
    <article className="product-card marketplace-card simple-product-card">
      <Link className="marketplace-card-link" to={`/producto/${product.slug}`} aria-label={`Ver ${product.name}`}>
        <div className="marketplace-image-frame">
          <img
            src={getDisplayImageUrl(product.main_image_url, { width: 420, height: 420, resize: 'contain' })}
            alt={product.name}
            className="product-image"
            width="420"
            height="420"
            loading="lazy"
            decoding="async"
            onError={imageFallback}
          />
          <span className={`status-pill status-${product.public_stock_status || 'consultar_stock'}`}>
            {publicStatusLabel(product.public_stock_status)}
          </span>
          {product.is_featured && <span className="featured-pill">⭐ Destacado</span>}
        </div>

        <div className="marketplace-card-body">
          <h3>{product.name}</h3>
          <div className="profit-card-focus">
            <span>Posible ganancia</span>
            <strong>{formatGs(profit)}</strong>
          </div>
          <div className="card-wholesale-price">
            <span>Precio mayorista</span>
            <strong>{formatGs(product.wholesale_price)}</strong>
          </div>
        </div>
      </Link>
    </article>
  )
}
