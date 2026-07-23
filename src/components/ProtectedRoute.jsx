import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { isSupabaseConfigured } from '../lib/supabase'
import { getCurrentProfile, getCurrentSession, hasActiveRole, ROLES, signOut } from '../lib/roles'

function AccessDenied({ profile, allowedRole }) {
  const isAdmin = profile?.role === ROLES.admin
  const isReseller = profile?.role === ROLES.reseller
  const title = !profile
    ? 'Acceso no configurado'
    : !profile.is_active
      ? 'Cuenta inactiva'
      : 'No tenes permiso para entrar'

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <p className="eyebrow">Panel privado</p>
        <h1>{title}</h1>
        <p>
          {allowedRole === ROLES.admin
            ? 'Esta seccion esta reservada para administradores activos.'
            : 'Esta seccion esta reservada para revendedores activos.'}
        </p>
        <div className="button-stack">
          {isAdmin && <Link className="primary-button big full" to="/admin">Ir al admin</Link>}
          {isReseller && <Link className="primary-button big full" to="/panel">Ir a mi panel</Link>}
          <Link className="secondary-button big full" to="/login">Volver al login</Link>
        </div>
      </div>
    </div>
  )
}

export function RoleRoute({ role, children }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (!isSupabaseConfigured) {
      setLoading(false)
      return undefined
    }

    async function loadAccess() {
      try {
        const nextSession = await getCurrentSession()
        if (!active) return
        setSession(nextSession)

        if (nextSession) {
          const nextProfile = await getCurrentProfile()
          if (!active) return
          if (nextProfile && !nextProfile.is_active) {
            await signOut()
            if (!active) return
            setSession(null)
            setError('Tu cuenta esta inactiva. Contacta con soporte.')
            return
          }
          setProfile(nextProfile)
        }
      } catch (err) {
        if (active) setError(err.message || 'No se pudo validar el acceso.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadAccess()
    return () => { active = false }
  }, [role])

  if (!isSupabaseConfigured) return <Navigate to="/login" replace />
  if (loading) return <div className="page"><div className="container"><p>Cargando...</p></div></div>
  if (!session) return <Navigate to="/login" replace />
  if (error) return <div className="page"><div className="container"><div className="error-box">{error}</div></div></div>
  if (!hasActiveRole(profile, role)) return <AccessDenied profile={profile} allowedRole={role} />
  return children
}

export function AdminRoute({ children }) {
  return <RoleRoute role={ROLES.admin}>{children}</RoleRoute>
}

export function ResellerRoute({ children }) {
  return <RoleRoute role={ROLES.reseller}>{children}</RoleRoute>
}

export function ProtectedRoute({ children }) {
  return <AdminRoute>{children}</AdminRoute>
}
