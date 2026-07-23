import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Banknote, Home, LogOut, PackageSearch, TrendingUp, UserRound } from 'lucide-react'
import { signOut } from '../lib/roles'

const navItems = [
  { to: '/panel', label: 'Inicio', icon: Home },
  { to: '/panel/ventas', label: 'Ventas', icon: PackageSearch },
  { to: '/panel/pagos', label: 'Pagos', icon: Banknote },
  { to: '/panel/progreso', label: 'Progreso', icon: TrendingUp },
  { to: '/panel/perfil', label: 'Perfil', icon: UserRound }
]

export function ResellerPanelLayout({ children }) {
  const navigate = useNavigate()

  const logout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="reseller-app-shell">
      <aside className="reseller-sidebar">
        <Link className="reseller-brand" to="/panel">
          <span>C</span>
          <strong>Camaraza</strong>
        </Link>
        <nav className="reseller-nav">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/panel'}><Icon size={18} /> {label}</NavLink>
          ))}
        </nav>
        <button className="reseller-logout" type="button" onClick={logout}>
          <LogOut size={18} /> Cerrar sesion
        </button>
      </aside>
      <main className="reseller-main">{children}</main>
      <nav className="reseller-mobile-nav">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/panel'}><Icon size={18} /><span>{label}</span></NavLink>
        ))}
      </nav>
    </div>
  )
}
