import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener?.subscription?.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) return <Navigate to="/login" replace />
  if (loading) return <div className="page"><div className="container"><p>Cargando...</p></div></div>
  if (!session) return <Navigate to="/login" replace />
  return children
}
