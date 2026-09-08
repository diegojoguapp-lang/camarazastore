import { Minus, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatGs, getDisplayImageUrl, imageFallback } from '../../lib/utils'
import { getStoredCustomer, getStorefrontWhatsapp, saveStoredCustomer, validateRetailCart } from '../../lib/storefrontApi'
import { buildStoreOrderMessage, buildWhatsappUrl } from '../whatsapp'

function cleanPhone(value) {
  return String(value || '').replace(/[^\d+\s()-]/g, '').slice(0, 24)
}

export function CartDrawer({ cart, setCart, open, onClose }) {
  const stored = getStoredCustomer()
  const [customer, setCustomer] = useState({ ...stored, phone: '', note: '' })
  const [message, setMessage] = useState('')
  const [checking, setChecking] = useState(false)
  const total = cart.reduce((sum, item) => sum + Number(item.retail_price || 0) * item.quantity, 0)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', close)
    document.body.classList.add('sf-no-scroll')
    return () => { document.removeEventListener('keydown', close); document.body.classList.remove('sf-no-scroll') }
  }, [onClose, open])

  const setQuantity = (id, requested) => {
    setMessage('')
    setCart((items) => items.map((item) => {
      if (item.id !== id) return item
      const maximum = item.track_inventory === false ? 99 : Math.max(1, item.available_stock_quantity)
      return { ...item, quantity: Math.min(maximum, Math.max(1, Math.floor(Number(requested) || 1))) }
    }))
  }

  const buy = async () => {
    if (!customer.name.trim()) {
      setMessage('Escribi tu nombre para continuar.')
      return
    }
    if (customer.phone.trim() && customer.phone.replace(/\D/g, '').length < 8) {
      setMessage('Revisa el numero de WhatsApp.')
      return
    }
    setChecking(true)
    setMessage('')
    try {
      const checked = await validateRetailCart(cart)
      const oldById = new Map(cart.map((item) => [item.id, item]))
      const unavailable = checked.filter((item) => item.is_available !== true && !(/stock insuficiente/i.test(item.issue || '') && Number(item.available_stock_quantity || 0) > 0))
      if (unavailable.length) {
        const blockedIds = new Set(unavailable.map((item) => item.id))
        setCart((items) => items.filter((item) => !blockedIds.has(item.id)))
        setMessage(`${unavailable[0].name || 'Un producto'} ya no esta disponible y fue retirado del carrito.`)
        return
      }
      const adjusted = checked.map((current) => {
        const previous = oldById.get(current.id)
        const quantity = current.track_inventory === false ? previous.quantity : Math.min(previous.quantity, current.available_stock_quantity)
        return { ...previous, ...current, quantity }
      }).filter((item) => item.quantity > 0)
      const stockChanged = adjusted.find((item) => item.quantity !== oldById.get(item.id)?.quantity)
      const priceChanged = adjusted.find((item) => Number(item.retail_price) !== Number(oldById.get(item.id)?.retail_price))
      const slugChanged = adjusted.find((item) => item.slug && item.slug !== oldById.get(item.id)?.slug)
      setCart(adjusted)
      if (stockChanged) {
        setMessage(`El stock de ${stockChanged.name} cambio. Ajustamos la cantidad disponible; revisa el carrito.`)
        return
      }
      if (priceChanged) {
        setMessage(`El precio de ${priceChanged.name} cambio de ${formatGs(oldById.get(priceChanged.id).retail_price)} a ${formatGs(priceChanged.retail_price)}. Revisa el total.`)
        return
      }
      if (slugChanged) {
        setMessage(`Actualizamos el enlace de ${slugChanged.name}. Revisa el carrito antes de continuar.`)
        return
      }
      const phone = await getStorefrontWhatsapp()
      if (!phone) throw new Error('No hay WhatsApp comercial configurado.')
      saveStoredCustomer(customer)
      window.location.assign(buildWhatsappUrl(phone, buildStoreOrderMessage(adjusted, customer)))
    } catch (error) {
      setMessage(error.message || 'No se pudo verificar el pedido. Intenta nuevamente.')
    } finally {
      setChecking(false)
    }
  }

  if (!open) return null
  return (
    <div className="sf-cart-layer" role="dialog" aria-modal="true" aria-label="Carrito de compras">
      <button className="sf-cart-backdrop" type="button" onClick={onClose} aria-label="Cerrar carrito" />
      <aside className="sf-cart-panel">
        <header><div><small>{cart.length ? `${cart.length} producto${cart.length === 1 ? '' : 's'}` : 'Sin productos'}</small><h2>Tu carrito</h2></div><button type="button" onClick={onClose} aria-label="Cerrar"><X size={22} /></button></header>
        {message && <div className="sf-notice is-warning" role="status">{message}</div>}
        {!cart.length ? <div className="sf-cart-empty"><strong>Tu carrito esta vacio</strong><p>Explora los productos y agrega los que te interesen.</p><button type="button" onClick={onClose}>Seguir comprando</button></div> : <>
          <div className="sf-cart-list">
            {cart.map((item) => <article className="sf-cart-item" key={item.id}>
              <img src={getDisplayImageUrl(item.main_image_url, { width: 160, height: 160, resize: 'contain' })} alt="" width="80" height="80" loading="lazy" decoding="async" onError={imageFallback} />
              <div className="sf-cart-item-info"><strong>{item.name}</strong><span>{formatGs(item.retail_price)} c/u</span><b>Subtotal: {formatGs(item.retail_price * item.quantity)}</b></div>
              <div className="sf-cart-controls">
                <button type="button" aria-label="Disminuir cantidad" onClick={() => setQuantity(item.id, item.quantity - 1)}><Minus size={16} /></button>
                <span>{item.quantity}</span>
                <button type="button" aria-label="Aumentar cantidad" onClick={() => setQuantity(item.id, item.quantity + 1)}><Plus size={16} /></button>
                <button className="is-delete" type="button" aria-label={`Eliminar ${item.name}`} onClick={() => setCart((items) => items.filter((row) => row.id !== item.id))}><Trash2 size={17} /></button>
              </div>
            </article>)}
          </div>
          <section className="sf-customer-fields">
            <h3>Datos para coordinar</h3>
            <label>Nombre *<input value={customer.name} maxLength="80" autoComplete="name" onChange={(event) => setCustomer((value) => ({ ...value, name: event.target.value }))} /></label>
            <div><label>WhatsApp (opcional)<input value={customer.phone} inputMode="tel" autoComplete="tel" onChange={(event) => setCustomer((value) => ({ ...value, phone: cleanPhone(event.target.value) }))} /></label><label>Ciudad / zona (opcional)<input value={customer.city} maxLength="80" onChange={(event) => setCustomer((value) => ({ ...value, city: event.target.value }))} /></label></div>
            <label>Nota (opcional)<textarea rows="2" maxLength="300" value={customer.note} onChange={(event) => setCustomer((value) => ({ ...value, note: event.target.value }))} /></label>
          </section>
          <footer>
            <p><span>Subtotal</span><strong>{formatGs(total)}</strong></p>
            <small>Delivery a coordinar por WhatsApp</small>
            <p className="sf-cart-total"><span>Total</span><strong>{formatGs(total)}</strong></p>
            <button className="sf-whatsapp-button" type="button" disabled={checking} onClick={buy}>{checking ? 'Verificando pedido...' : 'Comprar por WhatsApp'}</button>
            <button className="sf-text-button" type="button" disabled={checking} onClick={() => setCart([])}>Vaciar carrito</button>
          </footer>
        </>}
      </aside>
    </div>
  )
}
