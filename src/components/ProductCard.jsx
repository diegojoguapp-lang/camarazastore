import { Link } from 'react-router-dom'
import { calculateProfit, formatGs, isBestSeller, publicStatusLabel } from '../lib/utils'

export function ProductCard({ product }) {
  const profit = calculateProfit(product)

  return (
    <article className="product-card marketplace-card">
      <Link className="marketplace-image-link" to={`/producto/${product.slug}`} aria-label={`Ver ${product.name}`}>
        <img src={product.main_image_url || '/placeholder.svg'} alt={product.name} className="product-image" />
        <span className={`status-pill status-${product.public_stock_status || 'consultar_stock'}`}>
          {publicStatusLabel(product.public_stock_status)}
        </span>
        {isBestSeller(product) && <span className="best-seller-pill">Más vendido</span>}
      </Link>

      <div className="marketplace-card-body">
        <h3>{product.name}</h3>
        <div className="marketplace-prices">
          <div>
            <span>Precio sugerido</span>
            <strong>{formatGs(product.suggested_price)}</strong>
          </div>
          <div>
            <span>Precio mayorista</span>
            <strong>{formatGs(product.wholesale_price)}</strong>
          </div>
        </div>
        <div className="profit-badge">
          <span>Ganancia posible</span>
          <strong>{formatGs(profit)}</strong>
        </div>
        <Link className="secondary-button full card-view-button" to={`/producto/${product.slug}`}>
          Ver producto
        </Link>
      </div>
    </article>
  )
}
