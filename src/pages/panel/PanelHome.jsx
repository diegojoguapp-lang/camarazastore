import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { signOut } from '../../lib/roles'

export function PanelHome() {
  const navigate = useNavigate()

  const logout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="page auth-page reseller-panel-page">
      <section className="auth-card centered-panel">
        <p className="eyebrow">Camaraza Store</p>
        <h1>Panel del revendedor</h1>
        <p>Tu acceso fue configurado correctamente.</p>
        <p>Las funciones de ventas y comisiones estaran disponibles proximamente.</p>
        <button className="secondary-button big full" type="button" onClick={logout}>
          <LogOut size={18} />
          Cerrar sesion
        </button>
      </section>
    </div>
  )
}
