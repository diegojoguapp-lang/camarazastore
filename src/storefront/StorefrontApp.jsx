import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Minus, Plus, Search, ShoppingBag, Trash2 } from 'lucide-react'
import { formatGs, getDisplayImageUrl, imageFallback } from '../lib/utils'
import {
  getRetailProductBySlug,
  getRetailProducts,
  getStoredCart,
  getStorefrontWhatsapp,
  saveStoredCart,
  validateRetailCart
} from '../lib/storefrontApi'

function StoreHeader({ cartCount, onOpenCart }) {
  return (
    <header className="store-header">
      <Link className="store-brand" to="/">
        <span>CS</span>
        <strong>Camaraza Store</strong>
      </Link>
      <button className="store-cart-button" type="button" onClick={onOpenCart} aria-label="Abrir carrito">
        <ShoppingBag size={20} />
        {cartCount > 0 && <em>{cartCount}</em>}
      </button>
    </header>
  )
}

function stockText(product) {
  if (product.track_inventory === false) return 'Disponible'
  const available = Number(product.available_stock_quantity || 0)
  return `${available} disponibles`
}

function canAdd(product, quantity = 1) {
  return product.track_inventory === false || Number(product.available_stock_quantity || 0) >= quantity
}

function ProductCard({ product, onAdd }) {
  return (
    <article className="store-product-card">
      <Link to={`/producto/${product.slug}`} className="store-product-image">
        <img
          src={getDisplayImageUrl(product.main_image_url, { width: 520, height: 520, resize: 'contain' })}
          alt={product.name}
          width="520"
          height="520"
          loading="lazy"
          decoding="async"
          onError={imageFallback}
        />
      </Link>
      <div className="store-product-body">
        <Link to={`/producto/${product.slug}`}><h3>{product.name}</h3></Link>
        {(product.brand || product.model) && <p>{[product.brand, product.model].filter(Boolean).join(' ')}</p>}
        <strong>{formatGs(product.retail_price)}</strong>
        <span>{stockText(product)}</span>
        <div className="store-card-actions">
          <Link className="store-secondary" to={`/producto/${product.slug}`}>Ver producto</Link>
          <button className="store-primary" type="button" onClick={() => onAdd(product)} disabled={!canAdd(product)}>
            Agregar
          </button>
        </div>
      </div>
    </article>
  )
}

function CatalogPage({ onAdd }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')

  useEffect(() => {
    document.title = 'Camaraza Store | Catalogo'
    getRetailProducts()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => ['Todos', ...new Set(products.map((item) => item.category).filter(Boolean))], [products])
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter((product) => {
      const text = [product.name, product.brand, product.model].join(' ').toLowerCase()
      return (!term || text.includes(term)) && (category === 'Todos' || product.category === category)
    })
  }, [products, search, category])
  const featured = products.filter((product) => product.is_featured).slice(0, 6)

  return (
    <main className="store-page">
      <section className="store-hero">
        <p>Camaraza Store</p>
        <h1>Productos listos para comprar desde tu celular.</h1>
        <label className="store-search">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto" />
        </label>
      </section>

      <section className="store-section">
        <div className="store-category-row">
          {categories.map((item) => (
            <button key={item} type="button" className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="store-section">
          <h2>Destacados</h2>
          <div className="store-grid">
            {featured.map((product) => <ProductCard key={product.id} product={product} onAdd={onAdd} />)}
          </div>
        </section>
      )}

      <section className="store-section">
        <h2>Catalogo</h2>
        {loading && <p className="store-muted">Cargando productos...</p>}
        {error && <div className="error-box">{error}</div>}
        {!loading && !filtered.length && <div className="empty-state">No hay productos disponibles.</div>}
        <div className="store-grid">
          {filtered.map((product) => <ProductCard key={product.id} product={product} onAdd={onAdd} />)}
        </div>
      </section>
    </main>
  )
}

function ProductPage({ onAdd }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [buying, setBuying] = useState(false)

  useEffect(() => {
    getRetailProductBySlug(slug)
      .then((data) => {
        setProduct(data)
        document.title = data ? `${data.name} | Camaraza Store` : 'Producto no encontrado | Camaraza Store'
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <main className="store-page"><p className="store-muted">Cargando producto...</p></main>
  if (error || !product) return <main className="store-page"><div className="empty-state">Producto no disponible.</div></main>

  const images = [product.main_image_url, ...(product.gallery_images || []).map((image) => image.image_url)].filter(Boolean)

  const buyNow = async () => {
    setBuying(true)
    setNotice('')
    try {
      const checked = await validateRetailCart([{ ...product, quantity: 1 }])
      const current = checked[0]
      if (!current?.is_available) {
        setNotice(current?.issue || 'Producto no disponible.')
        return
      }
      if (Number(current.retail_price) !== Number(product.retail_price)) {
        setProduct((prev) => ({ ...prev, ...current }))
        setNotice('Actualizamos el precio vigente. Revisa el producto y toca comprar otra vez.')
        return
      }
      const phone = await getStorefrontWhatsapp()
      if (!phone) {
        setNotice('No hay WhatsApp comercial configurado.')
        return
      }
      const text = [
        'Hola, quiero realizar este pedido en Camaraza Store:',
        '',
        `1x ${product.name} - ${formatGs(current.retail_price)}`,
        '',
        `Total: ${formatGs(current.retail_price)}`,
        '',
        'El delivery se coordina por WhatsApp.',
        'Esta disponible?'
      ].join('\n')
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setNotice(err.message || 'No se pudo validar el producto.')
    } finally {
      setBuying(false)
    }
  }

  return (
    <main className="store-page store-detail">
      <button className="store-back" type="button" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} />
        Volver
      </button>
      <section className="store-detail-grid">
        <div className="store-detail-media">
          <img
            src={getDisplayImageUrl(product.main_image_url, { width: 900, height: 760, resize: 'contain' })}
            alt={product.name}
            width="900"
            height="760"
            decoding="async"
            onError={imageFallback}
          />
          {images.length > 1 && (
            <div className="store-thumbs">
              {images.map((url, index) => (
                <img key={`${url}-${index}`} src={getDisplayImageUrl(url, { width: 180, height: 180, resize: 'contain' })} alt={`${product.name} ${index + 1}`} width="180" height="180" loading="lazy" decoding="async" onError={imageFallback} />
              ))}
            </div>
          )}
        </div>
        <div className="store-detail-info">
          <h1>{product.name}</h1>
          {(product.brand || product.model) && <p>{[product.brand, product.model].filter(Boolean).join(' ')}</p>}
          <strong className="store-detail-price">{formatGs(product.retail_price)}</strong>
          <span className="store-stock">{stockText(product)}</span>
          <div className="store-detail-actions">
            <button className="store-primary big" type="button" onClick={() => onAdd(product)} disabled={!canAdd(product)}>
              Agregar al carrito
            </button>
            <button className="store-whatsapp big" type="button" onClick={buyNow} disabled={!canAdd(product) || buying}>
              {buying ? 'Validando...' : 'Comprar por WhatsApp'}
            </button>
          </div>
          {notice && <div className="warning-box">{notice}</div>}
          {product.public_description && <p className="store-description">{product.public_description}</p>}
          <div className="store-info-list">
            <span>Garantia: {product.warranty || '48 horas por falla de fabrica'}</span>
            <span>{product.delivery_included ? 'Delivery incluido' : 'El delivery se coordina por WhatsApp.'}</span>
            {product.delivery_time && <span>Entrega: {product.delivery_time}</span>}
          </div>
        </div>
      </section>
    </main>
  )
}

function CartDrawer({ cart, setCart, open, onClose }) {
  const [message, setMessage] = useState('')
  const [checking, setChecking] = useState(false)

  const total = cart.reduce((sum, item) => sum + Number(item.retail_price || 0) * Number(item.quantity || 0), 0)

  const updateQuantity = (id, quantity) => {
    setMessage('')
    setCart((items) => items.map((item) => {
      if (item.id !== id) return item
      const nextQuantity = Math.max(1, Number(quantity || 1))
      if (item.track_inventory !== false && nextQuantity > Number(item.available_stock_quantity || 0)) {
        setMessage(`Solo quedan ${item.available_stock_quantity} unidades disponibles.`)
        return item
      }
      return { ...item, quantity: nextQuantity }
    }))
  }

  const removeItem = (id) => setCart((items) => items.filter((item) => item.id !== id))

  const buy = async () => {
    if (!cart.length) return
    setChecking(true)
    setMessage('')
    try {
      const checked = await validateRetailCart(cart)
      const checkedMap = new Map(checked.map((item) => [item.id, item]))
      const nextCart = cart.map((item) => {
        const current = checkedMap.get(item.id)
        return current ? { ...item, ...current, quantity: Math.min(item.quantity, current.track_inventory === false ? item.quantity : current.available_stock_quantity) } : item
      })
      const blocked = checked.find((item) => !item.is_available)
      const priceChanged = nextCart.some((item) => Number(item.retail_price) !== Number(cart.find((old) => old.id === item.id)?.retail_price))
      setCart(nextCart.filter((item) => item.quantity > 0))
      if (blocked) {
        setMessage(`${blocked.name}: ${blocked.issue || 'No disponible'}.`)
        return
      }
      if (priceChanged) {
        setMessage('Actualizamos precios vigentes. Revisa el total y toca comprar otra vez.')
        return
      }
      const phone = await getStorefrontWhatsapp()
      if (!phone) {
        setMessage('No hay WhatsApp comercial configurado.')
        return
      }
      const lines = nextCart.map((item) => `${item.quantity}x ${item.name} - ${formatGs(item.retail_price * item.quantity)}`)
      const text = [
        'Hola, quiero realizar este pedido en Camaraza Store:',
        '',
        ...lines,
        '',
        `Total: ${formatGs(nextCart.reduce((sum, item) => sum + item.retail_price * item.quantity, 0))}`,
        '',
        'El delivery se coordina por WhatsApp.',
        'Esta disponible?'
      ].join('\n')
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setMessage(err.message || 'No se pudo validar el carrito.')
    } finally {
      setChecking(false)
    }
  }

  if (!open) return null

  return (
    <div className="store-cart-overlay" role="dialog" aria-modal="true" aria-label="Carrito">
      <button className="store-cart-backdrop" type="button" onClick={onClose} aria-label="Cerrar carrito" />
      <aside className="store-cart-panel">
        <header>
          <h2>Carrito</h2>
          <button type="button" onClick={onClose}>Cerrar</button>
        </header>
        {message && <div className="warning-box">{message}</div>}
        {!cart.length ? (
          <div className="empty-state">Tu carrito esta vacio.</div>
        ) : (
          <div className="store-cart-list">
            {cart.map((item) => (
              <article key={item.id} className="store-cart-item">
                <img src={getDisplayImageUrl(item.main_image_url, { width: 120, height: 120, resize: 'contain' })} alt={item.name} width="120" height="120" onError={imageFallback} />
                <div>
                  <strong>{item.name}</strong>
                  <span>{formatGs(item.retail_price)}</span>
                  <div className="store-qty">
                    <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus size={15} /></button>
                    <input value={item.quantity} inputMode="numeric" onChange={(event) => updateQuantity(item.id, Number(event.target.value || 1))} />
                    <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus size={15} /></button>
                    <button type="button" onClick={() => removeItem(item.id)}><Trash2 size={15} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        <footer>
          <div><span>Total</span><strong>{formatGs(total)}</strong></div>
          <button className="store-whatsapp big" type="button" onClick={buy} disabled={!cart.length || checking}>
            {checking ? 'Validando...' : 'Comprar por WhatsApp'}
          </button>
          {cart.length > 0 && <button className="store-secondary" type="button" onClick={() => setCart([])}>Vaciar carrito</button>}
        </footer>
      </aside>
    </div>
  )
}

export function StorefrontApp() {
  const [cart, setCartState] = useState(() => getStoredCart())
  const [cartOpen, setCartOpen] = useState(false)

  useEffect(() => {
    document.documentElement.lang = 'es'
    document.title = 'Camaraza Store | Productos para comprar'
    const description = 'Catalogo de Camaraza Store para clientes finales. Compra productos fisicos por WhatsApp.'
    document.querySelector('meta[name="description"]')?.setAttribute('content', description)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', 'Camaraza Store')
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description)
  }, [])

  const setCart = (updater) => {
    setCartState((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater
      saveStoredCart(next)
      return next
    })
  }

  const addToCart = (product, options = {}) => {
    setCart((items) => {
      const existing = items.find((item) => item.id === product.id)
      const nextQuantity = Number(existing?.quantity || 0) + 1
      if (!canAdd(product, nextQuantity)) return items
      if (existing) return items.map((item) => item.id === product.id ? { ...item, ...product, quantity: nextQuantity } : item)
      return [...items, { ...product, quantity: 1 }]
    })
    if (options.openCart) setCartOpen(true)
  }

  const cartCount = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0)

  return (
    <div className="store-shell">
      <StoreHeader cartCount={cartCount} onOpenCart={() => setCartOpen(true)} />
      <Routes>
        <Route path="/" element={<CatalogPage onAdd={addToCart} />} />
        <Route path="/producto/:slug" element={<ProductPage onAdd={addToCart} />} />
        <Route path="*" element={<CatalogPage onAdd={addToCart} />} />
      </Routes>
      <CartDrawer cart={cart} setCart={setCart} open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  )
}
