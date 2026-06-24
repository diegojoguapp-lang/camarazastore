import { Link } from 'react-router-dom'
import { BookOpen, HelpCircle, Instagram, MessageCircle, ShoppingBag } from 'lucide-react'
import { whatsappNumber } from '../lib/utils'

export function Home() {
  const message = encodeURIComponent('Hola, quiero información para ser revendedor de Camaraza Store.')
  const links = [
    { label: 'Ver catálogo', to: '/catalogo', icon: ShoppingBag, primary: true },
    { label: 'Videos de ayuda', to: '/ayuda', icon: HelpCircle },
    { label: 'Reglas para revendedores', to: '/reglas', icon: BookOpen },
    { label: 'Contactar por WhatsApp', href: `https://wa.me/${whatsappNumber}?text=${message}`, icon: MessageCircle },
    { label: 'Redes sociales', to: '/redes', icon: Instagram }
  ]

  return (
    <main className="link-home">
      <section className="link-home-card">
        <h1>RE-VENTA CAMARAZA STORE</h1>
        <div className="link-button-list">
          {links.map(({ label, to, href, icon: Icon, primary }) => (
            href ? (
              <a
                key={label}
                className={`link-button ${primary ? 'link-button-primary' : ''}`}
                href={href}
                target="_blank"
                rel="noreferrer"
              >
                <Icon size={20} />
                {label}
              </a>
            ) : (
              <Link
                key={label}
                className={`link-button ${primary ? 'link-button-primary' : ''}`}
                to={to}
              >
                <Icon size={20} />
                {label}
              </Link>
            )
          ))}
        </div>
      </section>
    </main>
  )
}
