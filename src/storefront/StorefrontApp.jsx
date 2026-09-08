import { useEffect, useRef, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { getStoredCart, saveStoredCart } from '../lib/storefrontApi'
import { CartDrawer } from './components/CartDrawer'
import { StoreHeader } from './components/StoreChrome'
import { canAdd } from './components/ProductCard'
import { CategoryPage } from './pages/CategoryPage'
import { HomePage } from './pages/HomePage'
import { ProductPage } from './pages/ProductPage'

export function StorefrontApp() {
  const [cart, setCartState] = useState(() => getStoredCart())
  const cartRef = useRef(cart)
  const [cartOpen, setCartOpen] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    document.documentElement.lang = 'es'
  }, [])
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(timer)
  }, [toast])

  const setCart = (updater) => {
    const next = typeof updater === 'function' ? updater(cartRef.current) : updater
    cartRef.current = next
    saveStoredCart(next)
    setCartState(next)
  }

  const addToCart = (product, amount = 1) => {
    const current = cartRef.current
    const existing = current.find((item) => item.id === product.id)
    const addedAmount = Math.max(1, Number(amount || 1))
    const nextQuantity = Number(existing?.quantity || 0) + addedAmount
    if (!canAdd(product, nextQuantity)) {
      setToast('No hay suficiente stock')
      return false
    }
    setCart(existing
      ? current.map((item) => item.id === product.id ? { ...item, ...product, quantity: nextQuantity } : item)
      : [...current, { ...product, quantity: addedAmount }])
    setToast('Agregado al carrito')
    return true
  }

  const count = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  return <div className="sf-shell">
    <StoreHeader cartCount={count} onOpenCart={() => setCartOpen(true)} />
    <Routes>
      <Route path="/" element={<HomePage onAdd={addToCart} />} />
      <Route path="/productos" element={<CategoryPage onAdd={addToCart} allProducts />} />
      <Route path="/categoria/:slug" element={<CategoryPage onAdd={addToCart} />} />
      <Route path="/producto/:slug" element={<ProductPage onAdd={addToCart} onOpenCart={() => setCartOpen(true)} />} />
      <Route path="*" element={<HomePage onAdd={addToCart} />} />
    </Routes>
    <CartDrawer cart={cart} setCart={setCart} open={cartOpen} onClose={() => setCartOpen(false)} />
    {toast && <div className="sf-toast" role="status">{toast}</div>}
  </div>
}
