import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requestPasswordRecovery } from '../lib/roles'

export function PasswordRecovery() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    try {
      setLoading(true)
      await requestPasswordRecovery(email)
      setMessage('Si el correo esta registrado, recibiras un enlace para cambiar tu contrasena.')
      setEmail('')
    } catch {
      setMessage('Si el correo esta registrado, recibiras un enlace para cambiar tu contrasena.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page auth-page">
      <form className="auth-card" onSubmit={submit}>
        <p className="eyebrow">Camaraza Store</p>
        <h1>Recuperar contrasena</h1>
        <p>Escribi tu correo y te enviaremos un enlace seguro para cambiar tu contrasena.</p>
        {message && <div className="toast">{message}</div>}
        {error && <div className="error-box">{error}</div>}

        <label>
          Correo electronico
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
            required
          />
        </label>

        <button className="primary-button big full" type="submit" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar enlace de recuperacion'}
        </button>

        <Link className="support-link" to="/login">Volver a iniciar sesion</Link>
      </form>
    </div>
  )
}
