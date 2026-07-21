import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { signOut, updateCurrentPassword } from '../lib/roles'

function hasRecoveryError() {
  const params = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const error = params.get('error') || hashParams.get('error')
  const errorCode = params.get('error_code') || hashParams.get('error_code')
  return Boolean(error || errorCode)
}

function getRecoveryCode() {
  const params = new URLSearchParams(window.location.search)
  return params.get('code')
}

export function UpdatePassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [invalidLink, setInvalidLink] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const canSubmit = useMemo(() => ready && !invalidLink && !saving, [ready, invalidLink, saving])

  useEffect(() => {
    let active = true
    let recoveryAuthorized = false
    let invalidTimer = null

    if (!isSupabaseConfigured) {
      setInvalidLink(true)
      setReady(true)
      return undefined
    }

    if (hasRecoveryError()) {
      setInvalidLink(true)
      setReady(true)
      return undefined
    }

    async function loadRecoverySession() {
      const code = getRecoveryCode()
      if (!code) {
        invalidTimer = window.setTimeout(() => {
          if (!active || recoveryAuthorized) return
          setInvalidLink(true)
          setReady(true)
        }, 800)
        return
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      if (exchangeError) throw exchangeError

      const { data } = await supabase.auth.getSession()
      if (!data.session) throw new Error('No recovery session')

      if (!active) return
      recoveryAuthorized = true
      setInvalidLink(false)
      setReady(true)
    }

    loadRecoverySession().catch(() => {
      if (!active) return
      setInvalidLink(true)
      setReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' && session) {
        recoveryAuthorized = true
        if (invalidTimer) window.clearTimeout(invalidTimer)
        setInvalidLink(false)
        setReady(true)
      }
    })

    return () => {
      active = false
      if (invalidTimer) window.clearTimeout(invalidTimer)
      listener?.subscription?.unsubscribe()
    }
  }, [])

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
      setMessage('Tu contrasena fue actualizada correctamente. Ya podes iniciar sesion.')
      await signOut()
      window.setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: { message: 'Tu contrasena fue actualizada correctamente. Ya podes iniciar sesion.' }
        })
      }, 1200)
    } catch {
      setError('No se pudo actualizar la contrasena. Solicita un nuevo enlace.')
    } finally {
      setSaving(false)
    }
  }

  if (!ready) {
    return <div className="page auth-page"><div className="auth-card"><p>Cargando...</p></div></div>
  }

  if (invalidLink) {
    return (
      <div className="page auth-page">
        <div className="auth-card">
          <p className="eyebrow">Recuperacion</p>
          <h1>Enlace vencido</h1>
          <p>Este enlace vencio o ya fue utilizado. Solicita uno nuevo.</p>
          <Link className="primary-button big full" to="/recuperar-contrasena">Solicitar un nuevo enlace</Link>
          <Link className="secondary-button big full" to="/login">Volver al login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page auth-page">
      <form className="auth-card" onSubmit={submit}>
        <p className="eyebrow">Recuperacion</p>
        <h1>Actualizar contrasena</h1>
        <p>Escribi una nueva contrasena para tu cuenta.</p>
        {message && <div className="toast">{message}</div>}
        {error && <div className="error-box">{error}</div>}

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

        <button className="primary-button big full" type="submit" disabled={!canSubmit}>
          {saving ? 'Guardando...' : 'Guardar nueva contrasena'}
        </button>
      </form>
    </div>
  )
}
