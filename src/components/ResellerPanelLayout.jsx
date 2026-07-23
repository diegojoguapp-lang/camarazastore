import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Award, Banknote, BookOpen, Grid2X2, HelpCircle, Home, KeyRound, LogOut, PackageSearch, TrendingUp, UserRound, WalletCards } from 'lucide-react'
import { signOut } from '../lib/roles'

const navItems = [
  { to: '/panel', label: 'Inicio', icon: Home },
  { to: '/panel/ventas', label: 'Mis ventas', icon: PackageSearch },
  { to: '/panel/pagos', label: 'Mis pagos', icon: Banknote },
  { to: '/panel/cuenta-bancaria', label: 'Mi cuenta bancaria', icon: WalletCards },
  { to: '/panel/rendimiento', label: 'Mi rendimiento', icon: TrendingUp },
  { to: '/panel/logros', label: 'Mis logros', icon: Award },
  { to: '/panel/perfil', label: 'Perfil', icon: UserRound },
  { to: '/catalogo', label: 'Catalogo', icon: Grid2X2 },
  { to: '/ayuda', label: 'Videos de ayuda', icon: HelpCircle },
  { to: '/reglas', label: 'Reglas', icon: BookOpen },
  { to: '/panel#seguridad', label: 'Seguridad', icon: KeyRound }
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
            to.includes('#') || to.startsWith('/catalogo') || to.startsWith('/ayuda') ? (
              <Link key={to} to={to}><Icon size={18} /> {label}</Link>
            ) : (
              <NavLink key={to} to={to} end={to === '/panel'}><Icon size={18} /> {label}</NavLink>
            )
          ))}
        </nav>
        <button className="reseller-logout" type="button" onClick={logout}>
          <LogOut size={18} /> Cerrar sesion
        </button>
      </aside>
      <main className="reseller-main">{children}</main>
      <nav className="reseller-mobile-nav">
        <NavLink to="/panel" end><Home size={18} /><span>Inicio</span></NavLink>
        <NavLink to="/panel/ventas"><PackageSearch size={18} /><span>Ventas</span></NavLink>
        <NavLink to="/panel/pagos"><Banknote size={18} /><span>Pagos</span></NavLink>
        <NavLink to="/panel/rendimiento"><TrendingUp size={18} /><span>Rend.</span></NavLink>
      </nav>
    </div>
  )
}
