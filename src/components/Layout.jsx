import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Boxes,
  Eye,
  FileVideo,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  ReceiptText,
  Search,
  Share2,
  ShoppingCart,
  Users,
  UserRound,
  X
} from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { adminGlobalSearch } from '../lib/adminDashboardApi'

export function Layout({ children }) {
  const [open, setOpen] = useState(false)
  const nav = [
    ['/', 'Inicio'],
    ['/reventa', 'Como funciona'],
    ['/catalogo', 'Catalogo']
  ]

  return (
    <div className="site-shell">
      <header className="topbar">
        <Link to="/" className="brand public-brand" onClick={() => setOpen(false)}>
          <span className="public-wordmark">Camaraza <em>Store</em></span>
        </Link>
        <button className="icon-button menu-button" onClick={() => setOpen(!open)} aria-label="Abrir menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className={`nav ${open ? 'nav-open' : ''}`}>
          {nav.map(([to, label]) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <div>
          <strong>Camaraza Store</strong>
          <p>Catalogo de reventa. Consultar stock antes de vender.</p>
        </div>
        <Link to="/reglas">Reglas para revendedores</Link>
      </footer>
    </div>
  )
}

export function AdminLayout({ children }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const logout = async () => {
    if (supabase) await supabase.auth.signOut()
    navigate('/login')
  }

  const runSearch = async (value) => {
    setSearchTerm(value)
    if (value.trim().length < 2) {
      setSearchResults([])
      return
    }
    try {
      setSearchResults(await adminGlobalSearch(value))
    } catch {
      setSearchResults([])
    }
  }

  const navGroups = [
    ['Operacion', [
      ['/admin', 'Dashboard', LayoutDashboard],
      ['/admin/ventas', 'Ventas', ShoppingCart],
      ['/admin/clientes', 'Clientes', Users]
    ]],
    ['Finanzas', [
      ['/admin/comisiones', 'Comisiones', ReceiptText]
    ]],
    ['Catalogo', [
      ['/admin/productos', 'Productos', Boxes]
    ]],
    ['Equipo', [
      ['/admin/revendedores', 'Revendedores', UserRound]
    ]],
    ['Contenido', [
      ['/admin/videos', 'Videos', FileVideo],
      ['/admin/redes', 'Redes', Share2]
    ]],
    ['Sistema', [
      ['/admin/seguridad', 'Seguridad', LockKeyhole],
      ['/catalogo', 'Ver catalogo', Eye]
    ]]
  ]

  return (
    <div className="admin-shell ax-shell">
      <aside className={`admin-sidebar ax-sidebar ${open ? 'admin-sidebar-open' : ''}`}>
        <Link to="/admin" className="brand admin-brand ax-brand" onClick={() => setOpen(false)}>
          <span className="brand-mark">CS</span>
          <span>Operaciones</span>
        </Link>
        <nav className="admin-nav ax-nav">
          {navGroups.map(([group, items]) => (
            <div className="ax-nav-group" key={group}>
              <small>{group}</small>
              {items.map(([to, label, Icon]) => (
                <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}>
                  <Icon size={16} /> {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <button className="secondary-button logout ax-logout" onClick={logout}><LogOut size={16} /> Cerrar sesion</button>
      </aside>
      <div className="admin-main ax-main">
        <header className="ax-topbar">
          <button className="icon-button admin-menu" onClick={() => setOpen(!open)} aria-label="Menu admin">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <label className="ax-top-search">
            <Search size={16} />
            <input placeholder="Buscar ventas, clientes, productos..." value={searchTerm} onChange={(event) => runSearch(event.target.value)} />
            {!!searchResults.length && (
              <div className="ax-top-search-results">
                {searchResults.slice(0, 8).map((item) => (
                  <Link key={`${item.result_type}-${item.result_id}`} to={item.path} onClick={() => { setSearchTerm(''); setSearchResults([]) }}>
                    <span>{item.result_type}</span>
                    <strong>{item.title}</strong>
                  </Link>
                ))}
              </div>
            )}
          </label>
          <span><BarChart3 size={16} /> Admin</span>
        </header>
        {children}
      </div>
    </div>
  )
}
