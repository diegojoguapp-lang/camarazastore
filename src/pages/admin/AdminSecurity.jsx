import { useState } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { AdminPageHeader } from '../../components/AdminUX'
import { updateCurrentPassword } from '../../lib/roles'

export function AdminSecurity() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 8) {
      setError('La nueva contrasena debe tener minimo 8 caracteres.')
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
      setMessage('Tu contrasena fue actualizada correctamente.')
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la contrasena.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader
        eyebrow="Sistema"
        title="Seguridad"
        description="Actualizacion de la contrasena del usuario administrador actual."
      />

      <form className="ax-panel ax-settings-panel security-form" onSubmit={submit}>
        <div className="ax-section-title">
          <KeyRound size={18} />
          <div>
            <h2>Cambiar mi contrasena</h2>
            <p>Esta accion cambia solamente tu propia contrasena de acceso.</p>
          </div>
        </div>
        {message && <div className="toast">{message}</div>}
        {error && <div className="error-box">{error}</div>}

        <div className="form-grid">
          <label>
            Nueva contrasena
            <span className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength="8"
                autoComplete="new-password"
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
            Confirmar nueva contrasena
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength="8"
              autoComplete="new-password"
              required
            />
          </label>
        </div>

        <button className="primary-button big" type="submit" disabled={saving}>
          {saving ? 'Guardando...' : 'Cambiar contrasena'}
        </button>
      </form>
    </div>
  )
}
