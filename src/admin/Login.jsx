import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Spinner } from '../components/ui'

export default function Login() {
  const { signIn, session } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/admin" replace />

  async function handleSubmit() {
    setError('')
    setLoading(true)
    const { error } = await signIn(email.trim(), password)
    setLoading(false)
    if (error) {
      setError('Email o contraseña incorrectos.')
      return
    }
    navigate('/admin')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-crema px-5">
      <div className="w-full max-w-sm rounded-xl2 border border-linea bg-white p-8 shadow-card">
        <Link to="/" className="font-display text-xl font-600 text-tinta">
          Camaraza <span className="italic text-oliva">Store</span>
        </Link>
        <h1 className="mt-6 font-display text-2xl text-tinta">Panel de administración</h1>
        <p className="mt-1 text-sm text-humo">Iniciá sesión para gestionar el catálogo.</p>

        <div className="mt-6 space-y-4">
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full rounded-lg border border-linea bg-crema px-3 py-2.5 text-sm outline-none focus:border-oliva"
              autoComplete="email"
            />
          </Field>
          <Field label="Contraseña">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full rounded-lg border border-linea bg-crema px-3 py-2.5 text-sm outline-none focus:border-oliva"
              autoComplete="current-password"
            />
          </Field>

          {error && <p className="text-sm text-[#b4641f]">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex w-full items-center justify-center rounded-full bg-oliva px-6 py-3 font-medium text-crema transition-colors hover:bg-olivaLight disabled:opacity-60"
          >
            {loading ? <Spinner className="text-crema" /> : 'Iniciar sesión'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-tinta">{label}</span>
      {children}
    </label>
  )
}
