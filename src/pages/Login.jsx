import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getCurrentProfile, getCurrentSession, isActiveAdmin, isActiveReseller, signOut } from '../lib/roles'
import { whatsappNumber } from '../lib/utils'

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const supportMessage = encodeURIComponent('Hola, no puedo ingresar a mi cuenta de Camaraza Store.')

  const routeByProfile = async () => {
    const profile = await getCurrentProfile()
    if (!profile) {
      await signOut()
      setError('Tu usuario no tiene un perfil configurado. Contacta con soporte.')
      return false
    }
    if (!profile.is_active) {
      await signOut()
      setError('Tu cuenta esta desactivada. Contacta con soporte.')
      return false
    }
    if (isActiveAdmin(profile)) {
      navigate('/admin')
      return true
    }
    if (isActiveReseller(profile)) {
      navigate('/panel')
      return true
    }

    await signOut()
    setError('Tu usuario no tiene un rol valido. Contacta con soporte.')
    return false
  }

  useEffect(() => {
    let active = true

    async function checkExistingSession() {
      if (!isSupabaseConfigured) {
        setChecking(false)
        return
      }

      try {
        const session = await getCurrentSession()
        if (!active) return
        if (session) await routeByProfile()
      } catch {
        if (active) setError('No se pudo validar tu sesion.')
      } finally {
        if (active) setChecking(false)
      }
    }

    checkExistingSession()
    return () => { active = false }
  }, [])

  const login = async (event) => {
    event.preventDefault()
    setError('')
    if (!isSupabaseConfigured) {
      setError('Primero configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env')
      return
    }

    setLoading(true)
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    })

    if (loginError) {
      setLoading(false)
      setError('Correo o contrasena incorrectos.')
      return
    }

    try {
      await routeByProfile()
    } catch {
      await signOut()
      setError('No se pudo validar tu perfil. Contacta con soporte.')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="page auth-page">
        <div className="auth-card">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page auth-page">
      <form className="auth-card" onSubmit={login}>
        <p className="eyebrow">Panel privado</p>
        <h1>Iniciar sesion</h1>
        <p>Ingresa con el usuario configurado por Camaraza Store.</p>
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

        <label>
          Contrasena
          <span className="password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              autoComplete="current-password"
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

        <button className="primary-button big full" disabled={loading}>
          {loading ? 'Ingresando...' : 'Iniciar sesion'}
        </button>

        <a className="support-link" href={`https://wa.me/${whatsappNumber}?text=${supportMessage}`} target="_blank" rel="noreferrer">
          No podes ingresar? Contacta con soporte.
        </a>
      </form>
    </div>
  )
}
