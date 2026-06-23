import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const login = async (event) => {
    event.preventDefault()
    setError('')
    if (!isSupabaseConfigured) {
      setError('Primero configurá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env')
      return
    }
    setLoading(true)
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (loginError) {
      setError(loginError.message)
      return
    }
    navigate('/admin')
  }

  return (
    <div className="page auth-page">
      <form className="auth-card" onSubmit={login}>
        <p className="eyebrow">Panel privado</p>
        <h1>Iniciar sesión</h1>
        <p>Entrá al admin para cargar productos, precios, fotos y textos de reventa.</p>
        {error && <div className="error-box">{error}</div>}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required /></label>
        <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" required /></label>
        <button className="primary-button big full" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
      </form>
    </div>
  )
}
