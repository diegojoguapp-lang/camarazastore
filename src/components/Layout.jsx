import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Layout({ children }) {
  const [open, setOpen] = useState(false)
  const nav = [
    ['/', 'Inicio'],
    ['/reventa', 'Cómo funciona'],
    ['/catalogo', 'Catálogo']
  ]

  return (
    <div className="site-shell">
      <header className="topbar">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark">CS</span>
          <span>Camaraza Store</span>
        </Link>
        <button className="icon-button menu-button" onClick={() => setOpen(!open)} aria-label="Abrir menú">
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
          <p>Catálogo de reventa. Consultar stock antes de vender.</p>
        </div>
        <Link to="/reglas">Reglas para revendedores</Link>
      </footer>
    </div>
  )
}

export function AdminLayout({ children }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const logout = async () => {
    if (supabase) await supabase.auth.signOut()
    navigate('/login')
  }
  const nav = [
    ['/admin', 'Dashboard'],
    ['/admin/productos', 'Productos'],
    ['/admin/productos/nuevo', 'Agregar producto'],
    ['/admin/videos', 'Videos'],
    ['/admin/redes', 'Redes'],
    ['/catalogo', 'Ver catálogo']
  ]

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${open ? 'admin-sidebar-open' : ''}`}>
        <Link to="/admin" className="brand admin-brand" onClick={() => setOpen(false)}>
          <span className="brand-mark">CS</span>
          <span>Admin</span>
        </Link>
        <nav className="admin-nav">
          {nav.map(([to, label]) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}>
              {label}
            </NavLink>
          ))}
        </nav>
        <button className="secondary-button logout" onClick={logout}><LogOut size={16} /> Cerrar sesión</button>
      </aside>
      <div className="admin-main">
        <button className="icon-button admin-menu" onClick={() => setOpen(!open)} aria-label="Menú admin">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        {children}
      </div>
    </div>
  )
}
