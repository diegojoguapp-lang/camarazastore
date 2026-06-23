import { Link, NavLink, Outlet } from 'react-router-dom'
import { STORE } from '../config/site'
import { waLink } from '../lib/utils'

function Wordmark() {
  return (
    <Link to="/" className="group flex items-baseline gap-2">
      <span className="font-display text-xl font-600 tracking-tight text-tinta">
        Camaraza
      </span>
      <span className="font-display text-xl italic font-400 text-oliva">
        Store
      </span>
    </Link>
  )
}

const navLink = ({ isActive }) =>
  `text-sm font-medium transition-colors ${
    isActive ? 'text-oliva' : 'text-humo hover:text-tinta'
  }`

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-crema">
      <header className="sticky top-0 z-40 border-b border-linea bg-crema/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Wordmark />
          <nav className="flex items-center gap-6">
            <NavLink to="/catalogo" className={navLink}>
              Catálogo
            </NavLink>
            <NavLink to="/reventa" className={navLink}>
              Cómo funciona
            </NavLink>
            <a
              href={waLink('Hola, quiero ser revendedor de Camaraza Store.')}
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-full bg-oliva px-4 py-2 text-sm font-medium text-crema transition-colors hover:bg-olivaLight sm:inline-block"
            >
              Ser revendedor
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-linea bg-cremaDark/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-humo sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {STORE.name}</span>
          <span className="text-humo/80">{STORE.tagline}</span>
        </div>
      </footer>
    </div>
  )
}
