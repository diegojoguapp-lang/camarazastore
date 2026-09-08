import { ArrowLeft, Minus, Plus, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getRetailProductBySlug, getStorefrontWhatsapp, validateRetailCart } from '../../lib/storefrontApi'
import { copyToClipboard, formatGs } from '../../lib/utils'
import { ProductGallery } from '../components/ProductGallery'
import { canAdd, ProductRail, stockText } from '../components/ProductCard'
import { StoreFooter, StoreSkeleton } from '../components/StoreChrome'
import { getPublicProductUrl, STORE_COPY } from '../config'
import { useStoreSeo } from '../seo'
import { buildStoreOrderMessage, buildWhatsappUrl } from '../whatsapp'

function Description({ text }) {
  const blocks = String(text || '').split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
  if (!blocks.length) return null
  return <section className="sf-description"><h2>Descripcion</h2>{blocks.map((block, index) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    if (lines.length > 1) return <ul key={index}>{lines.map((line, item) => <li key={item}>{line.replace(/^[•✓✅📌📦\-]+\s*/, '')}</li>)}</ul>
    return <p key={index}>{block}</p>
  })}</section>
}

export function ProductPage({ onAdd, onOpenCart }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [buying, setBuying] = useState(false)
  const product = data?.product
  useStoreSeo({ title: product?.name || 'Producto', description: product?.public_description?.slice(0, 155) || 'Compra este producto en Camaraza Store y coordina por WhatsApp.', canonical: getPublicProductUrl(slug), image: product?.main_image_url || '', type: 'product' })

  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setNotice(''); setQuantity(1)
    getRetailProductBySlug(slug).then((result) => active && setData(result)).catch((reason) => active && setError(reason.message)).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [slug])

  if (loading) return <main className="sf-main"><StoreSkeleton cards={4} /></main>
  if (error || !product) return <main className="sf-main"><button className="sf-back" onClick={() => navigate(-1)}><ArrowLeft size={18} /> Volver</button><div className="sf-empty"><strong>Producto no disponible</strong><p>{error || 'Este enlace ya no corresponde a un producto publicado.'}</p><Link to="/">Ir al inicio</Link></div></main>
  const compare = Number(product.retail_compare_at_price || 0)

  const share = async () => {
    const url = getPublicProductUrl(product.slug)
    try {
      if (navigator.share) await navigator.share({ title: product.name, text: 'Mira este producto en Camaraza Store', url })
      else { await copyToClipboard(url); setNotice('Enlace copiado') }
    } catch (reason) {
      if (reason?.name !== 'AbortError') setNotice('No se pudo compartir el enlace.')
    }
  }
  const buyNow = async () => {
    if (!canAdd(product, quantity)) { setNotice('Este producto esta sin stock.'); return }
    setBuying(true); setNotice('')
    try {
      const [current] = await validateRetailCart([{ ...product, quantity }])
      if (!current?.is_available) { setNotice(current?.issue || 'Este producto ya no esta disponible.'); return }
      if (Number(current.retail_price) !== Number(product.retail_price)) { setData((value) => ({ ...value, product: { ...value.product, ...current } })); setNotice(`El precio cambio a ${formatGs(current.retail_price)}. Revisalo antes de continuar.`); return }
      const phone = await getStorefrontWhatsapp()
      if (!phone) throw new Error('No hay WhatsApp comercial configurado.')
      const message = buildStoreOrderMessage([{ ...current, slug: current.slug || product.slug, quantity }], { name: '' })
      window.location.assign(buildWhatsappUrl(phone, message))
    } catch (reason) { setNotice(reason.message || 'No pudimos verificar el producto.') } finally { setBuying(false) }
  }

  return <>
    <main className="sf-main sf-product-page">
      <button className="sf-back" type="button" onClick={() => navigate(-1)}><ArrowLeft size={18} /> Volver</button>
      <div className="sf-product-layout">
        <ProductGallery product={product} />
        <section className="sf-product-details">
          {(product.parent_category_name || product.category_name) && <Link className="sf-product-category" to={`/categoria/${product.category_slug}`}>{product.parent_category_name ? `${product.parent_category_name} / ` : ''}{product.category_name}</Link>}
          <div className="sf-product-heading"><h1>{product.name}</h1><button type="button" onClick={share} aria-label="Compartir producto"><Share2 size={19} /></button></div>
          {(product.brand || product.model) && <p className="sf-product-meta">{[product.brand, product.model].filter(Boolean).join(' · ')}</p>}
          {compare > product.retail_price && <span className="sf-detail-compare">{formatGs(compare)}</span>}
          <strong className="sf-detail-price">{formatGs(product.retail_price)}</strong>
          {stockText(product) && <span className="sf-detail-stock is-out">{stockText(product)}</span>}
          <div className="sf-buy-controls"><div className="sf-quantity"><button type="button" disabled={!canAdd(product)} aria-label="Disminuir" onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={17} /></button><span>{quantity}</span><button type="button" disabled={!canAdd(product)} aria-label="Aumentar" onClick={() => setQuantity((value) => canAdd(product, value + 1) ? value + 1 : value)}><Plus size={17} /></button></div><button className="sf-primary-button" type="button" disabled={!canAdd(product, quantity)} onClick={() => onAdd(product, quantity)}>Agregar al carrito</button></div>
          <button className="sf-whatsapp-button" type="button" disabled={buying || !canAdd(product, quantity)} onClick={buyNow}>{buying ? 'Verificando...' : 'Comprar por WhatsApp'}</button>
          {notice && <div className="sf-notice is-warning" role="status">{notice}</div>}
          <div className="sf-trust-grid"><div><strong>Garantia</strong><span>{product.warranty || STORE_COPY.defaultWarranty}</span></div><div><strong>Delivery</strong><span>{product.delivery_included ? 'Incluido' : STORE_COPY.delivery}{product.delivery_time ? ` · ${product.delivery_time}` : ''}</span></div><div><strong>Pago</strong><span>{STORE_COPY.payment}</span></div></div>
        </section>
      </div>
      <Description text={product.public_description} />
      <ProductRail title="Tambien te puede interesar" slug={product.category_slug} products={data.related} onAdd={onAdd} />
    </main>
    <div className="sf-mobile-buy"><strong>{formatGs(product.retail_price)}</strong><button type="button" disabled={!canAdd(product, quantity)} onClick={() => { if (onAdd(product, quantity)) onOpenCart() }}>{canAdd(product, quantity) ? 'Comprar' : 'Sin stock'}</button></div>
    <StoreFooter />
  </>
}
