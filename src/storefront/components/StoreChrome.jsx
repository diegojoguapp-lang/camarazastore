import { Search, ShoppingBag, X } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { getDisplayImageUrl, imageFallback } from '../../lib/utils'
import { STORE_COPY } from '../config'

export function StoreHeader({ cartCount, onOpenCart }) {
  return (
    <header className="sf-header">
      <div className="sf-header-inner">
        <Link className="sf-brand" to="/" aria-label="Camaraza Store, inicio">
          <img src="/favicon.png" alt="" width="36" height="36" />
          <span>Camaraza <strong>Store</strong></span>
        </Link>
        <button className="sf-cart-button" type="button" onClick={onOpenCart} aria-label={`Abrir carrito, ${cartCount} productos`}>
          <ShoppingBag size={22} />
          {cartCount > 0 && <span>{cartCount > 99 ? '99+' : cartCount}</span>}
        </button>
      </div>
    </header>
  )
}

export function StoreSearch({ value, onChange, onSubmit, onClear, loading = false }) {
  const inputRef = useRef(null)
  const clear = () => {
    onChange('')
    onClear?.()
    requestAnimationFrame(() => inputRef.current?.focus())
  }
  return (
    <form className="sf-search" onSubmit={onSubmit} role="search">
      <Search size={19} aria-hidden="true" />
      <input ref={inputRef} value={value} onChange={(event) => onChange(event.target.value)} placeholder="¿Qué estás buscando?" maxLength="80" aria-label="Buscar productos" />
      {value && <button className="sf-search-clear" type="button" onClick={clear} aria-label="Limpiar búsqueda"><X size={18} /></button>}
      {loading && !value && <span className="sf-search-loader" aria-label="Buscando" />}
    </form>
  )
}

export function CategoryRail({ categories }) {
  const visible = categories?.filter((item) => Number(item.product_count || 0) > 0)
  return (
    <nav className="sf-category-rail" aria-label="Categorías">
      <Link className="sf-category-all" to="/productos"><span><strong>Todos</strong></span><strong>Todos</strong></Link>
      {(visible || []).map((category) => (
        <Link key={category.id || category.slug} to={`/categoria/${category.slug}`}>
          <span><img src={getDisplayImageUrl(category.image_url, { width: 144, height: 144, resize: 'contain' })} alt="" width="72" height="72" loading="lazy" decoding="async" onError={imageFallback} /></span>
          <strong>{category.name}</strong>
        </Link>
      ))}
    </nav>
  )
}

export function StoreFooter() {
  return (
    <footer className="sf-footer">
      <div>
        <strong>Camaraza Store</strong>
        <p>Electronica, tecnologia y mas.</p>
      </div>
      <div>
        <span>{STORE_COPY.delivery}.</span>
        <span>{STORE_COPY.defaultWarranty}.</span>
      </div>
      <small>© {new Date().getFullYear()} Camaraza Store</small>
    </footer>
  )
}

export function StoreSkeleton({ cards = 4 }) {
  return <div className="sf-skeleton-grid" aria-label="Cargando">{Array.from({ length: cards }, (_, index) => <span key={index} />)}</div>
}
