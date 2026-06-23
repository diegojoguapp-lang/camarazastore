import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Package, Smartphone } from 'lucide-react'
import { whatsappNumber } from '../lib/utils'

export function Home() {
  const message = encodeURIComponent('Hola, quiero ser revendedor de Camaraza Store.')
  return (
    <div className="page">
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">Re-venta Camaraza Store</p>
          <h1>Productos físicos para revender desde tu celular.</h1>
          <p className="lead">Te damos productos, fotos, videos, descripciones, precio mayorista y precio sugerido. Vos publicás, conseguís clientes y ganás por cada venta concretada.</p>
          <div className="hero-actions">
            <a className="primary-button big" href={`https://wa.me/${whatsappNumber}?text=${message}`} target="_blank" rel="noreferrer">Quiero ser revendedor <ArrowRight size={18} /></a>
            <Link className="secondary-button big" to="/catalogo">Ver catálogo</Link>
          </div>
        </div>
        <div className="hero-card">
          <span className="floating-pill">Ganancia estimada</span>
          <h2>60.000 Gs</h2>
          <p>Ejemplo: comprás al precio mayorista y vendés al precio sugerido.</p>
          <div className="mini-list">
            <span>Mayorista: 85.000 Gs</span>
            <span>Sugerido: 145.000 Gs</span>
            <span>Delivery no incluido</span>
          </div>
        </div>
      </section>
      <section className="container section-grid">
        <div className="info-card"><Package /><h3>Material listo</h3><p>Fotos, videos y textos preparados para publicar.</p></div>
        <div className="info-card"><Smartphone /><h3>Venta desde el celular</h3><p>Publicá en estados, Facebook, Marketplace o grupos.</p></div>
        <div className="info-card"><BadgeCheck /><h3>Reglas claras</h3><p>Consultá stock, coordiná entrega y cobrá por ventas concretadas.</p></div>
      </section>
    </div>
  )
}
