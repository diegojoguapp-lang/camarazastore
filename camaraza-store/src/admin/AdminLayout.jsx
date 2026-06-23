import { Navigate, NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Spinner } from '../components/ui'

export function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  if (loading)
    return <div className="flex justify-center py-32 text-oliva"><Spinner /></div>
  if (!session) return <Navigate to="/login" replace />
  return children
}

const navLink = ({ isActive }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-oliva text-crema' : 'text-humo hover:bg-cremaDark hover:text-tinta'
  }`

export default function AdminLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-crema">
      <header className="border-b border-linea bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-6">
            <Link to="/admin" className="font-display text-lg font-600 text-tinta">
              Camaraza <span className="italic text-oliva">Admin</span>
            </Link>
            <nav className="hidden gap-1 sm:flex">
              <NavLink to="/admin" end className={navLink}>Dashboard</NavLink>
              <NavLink to="/admin/productos" className={navLink}>Productos</NavLink>
              <NavLink to="/admin/productos/nuevo" className={navLink}>Agregar</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/catalogo" className="text-sm text-humo hover:text-tinta">
              Ver catálogo
            </Link>
            <span className="hidden text-sm text-humo sm:inline">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="rounded-full border border-tinta/15 px-3 py-1.5 text-sm font-medium text-tinta hover:border-tinta/40"
            >
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  )
}
