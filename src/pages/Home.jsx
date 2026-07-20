import { Link } from 'react-router-dom'
import { BookOpen, HelpCircle, Instagram, MessageCircle, ShoppingBag, UserRound } from 'lucide-react'
import { whatsappNumber } from '../lib/utils'

export function Home() {
  const message = encodeURIComponent('Hola, quiero información para ser revendedor de Camaraza Store.')
  const links = [
    { label: 'Ver catálogo', to: '/catalogo', icon: ShoppingBag, primary: true },
    { label: 'Videos de ayuda', to: '/ayuda', icon: HelpCircle },
    { label: 'Contactar por WhatsApp', href: `https://wa.me/${whatsappNumber}?text=${message}`, icon: MessageCircle },
    { label: 'Redes sociales', to: '/redes', icon: Instagram },
    { label: 'Panel del revendedor', description: 'ConsultÃ¡ tus ventas, comisiones y pagos.', to: '/login', icon: UserRound },
    { label: 'Reglas para revendedores', to: '/reglas', icon: BookOpen, quiet: true }
  ]

  return (
    <main className="link-home">
      <section className="link-home-card">
        <h1>RE-VENTA CAMARAZA STORE</h1>
        <div className="link-button-list">
          {links.map(({ label, description, to, href, icon: Icon, primary, quiet }) => (
            href ? (
              <a
                key={label}
                className={`link-button ${primary ? 'link-button-primary' : ''} ${quiet ? 'link-button-quiet' : ''}`}
                href={href}
                target="_blank"
                rel="noreferrer"
              >
                <Icon size={20} />
                <span className="link-button-copy">
                  <strong>{label}</strong>
                  {description && <small>{description}</small>}
                </span>
              </a>
            ) : (
              <Link
                key={label}
                className={`link-button ${primary ? 'link-button-primary' : ''} ${quiet ? 'link-button-quiet' : ''}`}
                to={to}
              >
                <Icon size={20} />
                <span className="link-button-copy">
                  <strong>{label}</strong>
                  {description && <small>{description}</small>}
                </span>
              </Link>
            )
          ))}
        </div>
      </section>
    </main>
  )
}
