import { Link } from 'react-router-dom'
import { calculateProfit, formatGs, getDisplayImageUrl, imageFallback, publicStatusLabel } from '../lib/utils'

export function ProductCard({ product }) {
  const profit = calculateProfit(product)

  return (
    <article className="product-card marketplace-card simple-product-card">
      <Link className="marketplace-image-link" to={`/producto/${product.slug}`} aria-label={`Ver ${product.name}`}>
        <img
          src={getDisplayImageUrl(product.main_image_url, { width: 520, height: 520 })}
          alt={product.name}
          className="product-image"
          width="520"
          height="520"
          loading="lazy"
          decoding="async"
          onError={imageFallback}
        />
        <span className={`status-pill status-${product.public_stock_status || 'consultar_stock'}`}>
          {publicStatusLabel(product.public_stock_status)}
        </span>
      </Link>

      <div className="marketplace-card-body">
        <h3>{product.name}</h3>
        <div className="profit-card-focus">
          <span>Posible ganancia</span>
          <strong>{formatGs(profit)}</strong>
        </div>
        <p className="suggested-reference">Precio mayorista: {formatGs(product.wholesale_price)}</p>
        <Link className="primary-button full card-view-button" to={`/producto/${product.slug}`}>
          Ver producto
        </Link>
      </div>
    </article>
  )
}
