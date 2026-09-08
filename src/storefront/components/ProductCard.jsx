import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatGs, getDisplayImageUrl, imageFallback } from '../../lib/utils'

export function stockText(product) {
  if (product.track_inventory === false) return 'Disponible'
  const amount = Number(product.available_stock_quantity || 0)
  if (amount <= 0) return 'Agotado'
  if (amount <= 5) return `Solo ${amount} disponibles`
  return 'Disponible'
}

export function canAdd(product, quantity = 1) {
  return product.track_inventory === false || Number(product.available_stock_quantity || 0) >= quantity
}

export function ProductCard({ product, onAdd, compact = false }) {
  const compare = Number(product.retail_compare_at_price || 0)
  const hasCompare = compare > Number(product.retail_price || 0)
  return (
    <article className={`sf-product-card${compact ? ' is-compact' : ''}`}>
      <Link className="sf-product-link" to={`/producto/${product.slug}`} aria-label={`Ver ${product.name}`}>
        <span className="sf-product-media">
          <img src={getDisplayImageUrl(product.main_image_url, { width: 420, height: 420, resize: 'contain' })} alt={product.name} width="420" height="420" loading="lazy" decoding="async" onError={imageFallback} />
        </span>
        <span className="sf-product-content">
          <span className="sf-product-title">{product.name}</span>
          {hasCompare && <span className="sf-compare-price">{formatGs(compare)}</span>}
          <strong>{formatGs(product.retail_price)}</strong>
          <span className={`sf-stock${Number(product.available_stock_quantity) <= 5 ? ' is-low' : ''}`}>{stockText(product)}</span>
        </span>
      </Link>
      <button className="sf-quick-add" type="button" aria-label={`Agregar ${product.name} al carrito`} disabled={!canAdd(product)} onClick={() => onAdd(product)}>
        <Plus size={19} />
      </button>
    </article>
  )
}

export function ProductRail({ title, slug, products, onAdd }) {
  if (!products?.length) return null
  return (
    <section className="sf-section">
      <div className="sf-section-heading">
        <h2>{title}</h2>
        {slug && <Link to={`/categoria/${slug}`}>Ver todos <span aria-hidden="true">›</span></Link>}
      </div>
      <div className="sf-product-rail">
        {products.map((product) => <ProductCard key={product.id} product={product} onAdd={onAdd} compact />)}
      </div>
    </section>
  )
}

