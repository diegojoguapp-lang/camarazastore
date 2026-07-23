import { useEffect, useState } from 'react'
import { ResellerPanelLayout } from '../../components/ResellerPanelLayout'
import { CompactMetricCard, SegmentedTabs } from '../../components/ResellerUX'
import { getMyAchievements, getMyGoals, getMyPerformance, updateMyGoals } from '../../lib/resellerExperienceApi'
import { getMySalesSummary } from '../../lib/resellerSalesApi'
import { achievementMeta } from '../../lib/resellerDisplay'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'
import { ProgressBar } from '../../components/design'

const tabs = [
  { value: 'summary', label: 'Resumen' },
  { value: 'goals', label: 'Objetivos' },
  { value: 'achievements', label: 'Logros' }
]

function digits(value) {
  return String(value || '').replace(/\D/g, '')
}

function moneyInputValue(value) {
  return value ? formatGs(value) : ''
}

export function PanelProgress() {
  const [tab, setTab] = useState('summary')
  const [performance, setPerformance] = useState({})
  const [summary, setSummary] = useState({})
  const [goals, setGoals] = useState({ weekly_sales_goal: 10, weekly_commission_goal: 500000 })
  const [achievements, setAchievements] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const [performanceData, summaryData, goalData, achievementRows] = await Promise.all([
        getMyPerformance(),
        getMySalesSummary(),
        getMyGoals(),
        getMyAchievements()
      ])
      setPerformance(performanceData || {})
      setSummary(summaryData || {})
      setGoals({ weekly_sales_goal: 10, weekly_commission_goal: 500000, ...(goalData || {}) })
      setAchievements(achievementRows || [])
    } catch (err) {
      setError(err.message || 'No se pudo cargar tu progreso.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const saveGoals = async (event) => {
    event.preventDefault()
    try {
      setSaving(true)
      setMessage('')
      setError('')
      const saved = await updateMyGoals(goals)
      setGoals({ ...goals, ...saved })
      setMessage('Objetivos actualizados.')
    } catch (err) {
      setError(err.message || 'No se pudieron guardar los objetivos.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResellerPanelLayout>
      <div className="rx-page">
        <header className="rx-simple-head">
          <h1>Progreso</h1>
          <p>Rendimiento, metas y logros personales.</p>
        </header>
        <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} />

        {error && <div className="error-box">{error} <button className="secondary-button" type="button" onClick={load}>Reintentar</button></div>}
        {message && <div className="toast">{message}</div>}
        {loading && <div className="rx-skeleton-list"><span /><span /><span /></div>}

        {!loading && tab === 'summary' && (
          <section className="rx-metric-grid progress">
            <CompactMetricCard label="Ultimos 7 dias" value={performance.sales_last_7_days || 0} hint="Ventas entregadas" />
            <CompactMetricCard label="Ultimos 30 dias" value={performance.sales_last_30_days || 0} hint="Ventas entregadas" />
            <CompactMetricCard featured label="Comision generada" value={formatGs(performance.generated_commission)} hint="Historico entregado" />
            <CompactMetricCard label="Comision cobrada" value={formatGs(performance.paid_commission)} hint="Pagos recibidos" />
            <CompactMetricCard label="Promedio por venta" value={formatGs(performance.average_commission)} hint="Ventas entregadas" />
            <CompactMetricCard label="Mejor semana" value={`${performance.best_week_sales || 0} ventas`} hint="Periodo lunes a sabado" />
            <CompactMetricCard label="Racha actual" value={`${performance.current_sales_week_streak || 0} semanas`} hint="Semanas con ventas" />
            <CompactMetricCard label="Producto mas vendido" value={performance.top_product || '-'} hint="Segun ventas entregadas" />
          </section>
        )}

        {!loading && tab === 'goals' && (
          <form className="rx-section rx-goals-form" onSubmit={saveGoals}>
            <div className="rx-section-head"><h2>Objetivos semanales</h2></div>
            <label>Meta de ventas<input type="number" min="0" value={goals.weekly_sales_goal || 0} onChange={(event) => setGoals((prev) => ({ ...prev, weekly_sales_goal: Number(event.target.value || 0) }))} /></label>
            <label>Meta de comision<input value={moneyInputValue(goals.weekly_commission_goal)} onChange={(event) => setGoals((prev) => ({ ...prev, weekly_commission_goal: Number(digits(event.target.value) || 0) }))} /></label>
            <div className="rx-goal-line">
              <strong>{summary.currentPeriodDeliveredSales || 0} de {goals.weekly_sales_goal || 0} ventas</strong>
              <ProgressBar value={summary.currentPeriodDeliveredSales || 0} max={goals.weekly_sales_goal || 1} />
            </div>
            <div className="rx-goal-line">
              <strong>{formatGs(summary.currentPeriodCommission)} de {formatGs(goals.weekly_commission_goal)}</strong>
              <ProgressBar value={summary.currentPeriodCommission || 0} max={goals.weekly_commission_goal || 1} />
            </div>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar objetivos'}</button>
          </form>
        )}

        {!loading && tab === 'achievements' && (
          <section className="rx-achievement-list">
            {achievements.map((item) => {
              const meta = achievementMeta(item.achievement_key)
              const unlocked = Boolean(item.unlocked_at)
              return (
                <article className={`rx-achievement ${unlocked ? 'unlocked' : ''}`} key={item.achievement_key}>
                  <span>{unlocked ? 'OK' : '--'}</span>
                  <div>
                    <strong>{item.title || meta.title}</strong>
                    <p>{item.description || meta.description}</p>
                    {item.unlocked_at && <small>{formatDatePy(item.unlocked_at)}</small>}
                    <ProgressBar value={item.current_value || 0} max={item.target_value || 1} />
                  </div>
                </article>
              )
            })}
            {!achievements.length && <div className="rx-empty">Tu primer logro se desbloquea al completar una venta.</div>}
          </section>
        )}
      </div>
    </ResellerPanelLayout>
  )
}
