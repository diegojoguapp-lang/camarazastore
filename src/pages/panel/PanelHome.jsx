import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, LogOut } from 'lucide-react'
import { getCurrentProfile, signOut, updateCurrentPassword } from '../../lib/roles'
import { getMyRecentSales, getMySalesSummary } from '../../lib/resellerSalesApi'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'
import { saleStatusLabel } from '../../lib/salesConstants'

export function PanelHome() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [summary, setSummary] = useState(null)
  const [recentSales, setRecentSales] = useState([])

  useEffect(() => {
    Promise.all([getCurrentProfile(), getMySalesSummary(), getMyRecentSales()])
      .then(([profileData, summaryData, saleRows]) => {
        setProfile(profileData)
        setSummary(summaryData)
        setRecentSales(saleRows)
      })
      .catch(() => setError('No se pudo cargar tu perfil.'))
  }, [])

  const logout = async () => {
    await signOut()
    navigate('/login')
  }

  const submitPassword = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 8) {
      setError('La contrasena nueva debe tener minimo 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contrasenas no coinciden.')
      return
    }

    try {
      setSaving(true)
      await updateCurrentPassword(password)
      setPassword('')
      setConfirmPassword('')
      setMessage('Contrasena actualizada correctamente.')
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la contrasena.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page reseller-panel-page">
      <section className="container narrow">
        <div className="reseller-dashboard-grid">
          <div className="stat-card"><span>Comision pendiente estimada</span><strong>{formatGs(summary?.pendingEstimated)}</strong></div>
          <div className="stat-card"><span>Comision confirmada semana</span><strong>{formatGs(summary?.confirmedWeek)}</strong></div>
          <div className="stat-card"><span>Ventas entregadas semana</span><strong>{summary?.deliveredWeekCount || 0}</strong></div>
          <div className="stat-card"><span>Ventas totales</span><strong>{summary?.deliveredTotalCount || 0}</strong></div>
          <div className="stat-card"><span>Total historico ganado</span><strong>{formatGs(summary?.historicalEarned)}</strong></div>
          <div className="stat-card"><span>Proximo pago</span><strong>Lunes</strong><small>10:00 a 17:00</small></div>
        </div>

        <div className="panel reseller-profile-card">
          <p className="eyebrow">Camaraza Store</p>
          <h1>Panel del revendedor</h1>
          <p>Periodo actual: {formatDatePy(summary?.periodStart)} al {formatDatePy(summary?.periodEnd)}.</p>

          <div className="profile-summary">
            <div>
              <span>Nombre</span>
              <strong>{profile?.full_name || '-'}</strong>
            </div>
            <div>
              <span>Codigo de revendedor</span>
              <strong>{profile?.reseller_code || '-'}</strong>
            </div>
            <div>
              <span>Correo</span>
              <strong>{profile?.email || '-'}</strong>
            </div>
            <div>
              <span>Estado de la cuenta</span>
              <strong>{profile?.is_active ? 'Activa' : 'Inactiva'}</strong>
            </div>
          </div>

          <button className="secondary-button big full" type="button" onClick={logout}>
            <LogOut size={18} />
            Cerrar sesion
          </button>
        </div>

        <section className="panel reseller-profile-card">
          <div className="section-title">
            <h2>Mis ventas recientes</h2>
            <Link to="/panel/ventas">Ver todas</Link>
          </div>
          <div className="reseller-sale-list compact">
            {recentSales.map((sale) => (
              <article className="reseller-recent-row" key={sale.id}>
                <div>
                  <strong>{sale.product_name_snapshot}</strong>
                  <span>{formatDatePy(sale.created_at)} - {sale.customer_name} - {sale.customer_phone_masked}</span>
                </div>
                <div>
                  <span className={`sale-status status-${sale.status}`}>{saleStatusLabel(sale.status)}</span>
                  <strong>{formatGs(sale.reseller_commission)}</strong>
                </div>
              </article>
            ))}
            {!recentSales.length && <div className="empty-state">Todavia no tenes ventas cargadas.</div>}
          </div>
        </section>

        <form className="panel reseller-security-card" onSubmit={submitPassword}>
          <h2><KeyRound size={20} /> Seguridad</h2>
          <p>Cambia tu contrasena. Tu correo no se puede modificar desde esta pantalla.</p>
          {error && <div className="error-box">{error}</div>}
          {message && <div className="toast">{message}</div>}

          <label>
            Nueva contrasena
            <span className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength="8"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          <label>
            Confirmar contrasena nueva
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength="8"
              required
            />
          </label>

          <button className="primary-button big full" type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Cambiar contrasena'}
          </button>
        </form>
      </section>
    </div>
  )
}
