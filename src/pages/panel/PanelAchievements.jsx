import { useEffect, useState } from 'react'
import { Award, LockKeyhole, Trophy } from 'lucide-react'
import { ResellerPanelLayout } from '../../components/ResellerPanelLayout'
import { EmptyState, PageHeader, ProgressBar } from '../../components/design'
import { getMyAchievements } from '../../lib/resellerExperienceApi'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'

function displayValue(key, value) {
  if (key.includes('commission')) return formatGs(value)
  return Number(value || 0)
}

export function PanelAchievements() {
  const [achievements, setAchievements] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      setAchievements(await getMyAchievements())
    } catch (err) {
      setError(err.message || 'No se pudieron cargar tus logros.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <ResellerPanelLayout>
      <div className="reseller-dashboard-page">
        <PageHeader eyebrow="Progreso personal" title="Mis logros" description="Insignias personales por ventas, comisiones y objetivos. Sin ranking ni comparaciones." />
        {error && <div className="error-box">{error} <button className="secondary-button" type="button" onClick={load}>Reintentar</button></div>}
        {loading && <div className="panel">Cargando logros...</div>}
        {!loading && (
          <section className="achievement-grid">
            {achievements.map((item) => {
              const unlocked = Boolean(item.unlocked_at)
              return (
                <article className={`achievement-card ${unlocked ? 'unlocked' : 'locked'}`} key={item.achievement_key}>
                  <span className="achievement-icon">{unlocked ? <Trophy size={24} /> : <LockKeyhole size={24} />}</span>
                  <div>
                    <h2>{item.title}</h2>
                    <p>{item.description}</p>
                  </div>
                  <ProgressBar value={item.current_value} max={item.target_value || 1} />
                  <small>{displayValue(item.achievement_key, item.current_value)} de {displayValue(item.achievement_key, item.target_value)}</small>
                  <strong>{unlocked ? `Desbloqueado: ${formatDatePy(item.unlocked_at)}` : 'Bloqueado'}</strong>
                </article>
              )
            })}
            {!achievements.length && <EmptyState title="Tu primer logro se desbloquea al completar una venta." action={<Award size={28} />} />}
          </section>
        )}
      </div>
    </ResellerPanelLayout>
  )
}
