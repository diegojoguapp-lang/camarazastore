import { Link } from 'react-router-dom'
import { calculateProfit, formatGs, publicStatusLabel } from '../lib/utils'

export function ProductCard({ product }) {
  const profit = calculateProfit(product)

  return (
    <article className="product-card marketplace-card simple-product-card">
      <Link className="marketplace-image-link" to={`/producto/${product.slug}`} aria-label={`Ver ${product.name}`}>
        <img src={product.main_image_url || '/placeholder.svg'} alt={product.name} className="product-image" />
        <span className={`status-pill status-${product.public_stock_status || 'consultar_stock'}`}>
          {publicStatusLabel(product.public_stock_status)}
        </span>
      </Link>

      <div className="marketplace-card-body">
        <h3>{product.name}</h3>
        <div className="profit-card-focus">
          <span>Ganancia posible</span>
          <strong>{formatGs(profit)}</strong>
        </div>
        <p className="suggested-reference">Venta sugerida: {formatGs(product.suggested_price)}</p>
        <Link className="primary-button full card-view-button" to={`/producto/${product.slug}`}>
          Ver producto
        </Link>
      </div>
    </article>
  )
}
