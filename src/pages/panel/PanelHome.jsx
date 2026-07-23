import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Banknote, CheckCircle2, Eye, EyeOff, Grid2X2, KeyRound, PackageCheck, PackageSearch, ShieldCheck, TrendingUp, WalletCards } from 'lucide-react'
import { ResellerPanelLayout } from '../../components/ResellerPanelLayout'
import { getCurrentProfile, updateCurrentPassword } from '../../lib/roles'
import { getMyRecentSales, getMySalesSummary, commissionState } from '../../lib/resellerSalesApi'
import { getMyBankAccount } from '../../lib/resellerCommissionsApi'
import { getMyActivity, getMyGoals, updateMyGoals } from '../../lib/resellerExperienceApi'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs, whatsappNumber } from '../../lib/utils'
import { saleStatusLabel } from '../../lib/salesConstants'
import { ProgressBar, Timeline } from '../../components/design'

const defaultGoals = { weekly_sales_goal: 10, weekly_commission_goal: 500000 }

function MetricCard({ title, value, note, icon: Icon, featured = false, tone = 'default' }) {
  return (
    <article className={`reseller-metric-card ${featured ? 'featured' : ''} tone-${tone}`}>
      <div className="metric-icon"><Icon size={20} /></div>
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  )
}

function progressMessage(count) {
  if (count <= 0) return 'Empeza publicando productos hoy.'
  if (count <= 4) return 'Buen comienzo. Segui publicando.'
  if (count <= 9) return 'Estas cerca de completar tu meta semanal.'
  return 'Meta semanal completada.'
}

function goalMessage(value, target) {
  const pct = target > 0 ? (Number(value || 0) / Number(target)) * 100 : 0
  if (pct <= 0) return 'Empeza publicando productos hoy.'
  if (pct < 50) return 'Buen comienzo. Segui avanzando.'
  if (pct < 100) return 'Estas cerca de completar tu objetivo.'
  return 'Objetivo semanal completado.'
}

function PipelineItem({ label, value }) {
  return (
    <div className="pipeline-item">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

export function PanelHome() {
  const [profile, setProfile] = useState(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [summary, setSummary] = useState(null)
  const [recentSales, setRecentSales] = useState([])
  const [bankAccount, setBankAccount] = useState(null)
  const [goals, setGoals] = useState(defaultGoals)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingGoals, setSavingGoals] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const [profileData, summaryData, saleRows, account, goalRows, activityRows] = await Promise.all([
        getCurrentProfile(),
        getMySalesSummary(),
        getMyRecentSales(),
        getMyBankAccount(),
        getMyGoals(),
        getMyActivity(8)
      ])
      setProfile(profileData)
      setSummary(summaryData)
      setRecentSales(saleRows)
      setBankAccount(account)
      setGoals({ ...defaultGoals, ...goalRows })
      setActivity(activityRows.map((item) => ({
        id: item.activity_id,
        title: item.title,
        detail: item.detail,
        date: item.created_at,
        amount: item.amount
      })))
    } catch (err) {
      setError(err.message || 'No se pudo cargar tu panel.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const progress = useMemo(() => {
    const count = Number(summary?.currentPeriodDeliveredSales || 0)
    return Math.min((count / Number(goals.weekly_sales_goal || 1)) * 100, 100)
  }, [summary, goals.weekly_sales_goal])

  const saveGoals = async (event) => {
    event.preventDefault()
    try {
      setSavingGoals(true)
      setMessage('')
      setError('')
      const saved = await updateMyGoals(goals)
      setGoals({ ...defaultGoals, ...saved })
      setMessage('Objetivos actualizados.')
    } catch (err) {
      setError(err.message || 'No se pudieron guardar los objetivos.')
    } finally {
      setSavingGoals(false)
    }
  }

  const submitPassword = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 8) {
      setError('La contrasena nueva debe tener minimo 8 caracteres.')
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
      setMessage('Contrasena actualizada correctamente.')
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la contrasena.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResellerPanelLayout>
      <div className="reseller-dashboard-page">
        <header className="reseller-dashboard-head">
          <div>
            <p className="eyebrow">Panel del revendedor</p>
            <h1>Hola, {profile?.full_name || 'revendedor'}</h1>
            <p>Codigo: <strong>{profile?.reseller_code || '-'}</strong></p>
          </div>
          <div className="dashboard-head-actions">
            <span className={`account-pill ${profile?.is_active ? 'active' : ''}`}>{profile?.is_active ? 'Cuenta activa' : 'Cuenta inactiva'}</span>
            <span className="next-pay-pill">Proximo pago: {formatDatePy(summary?.nextPaymentDate)}</span>
            <Link className="primary-button" to="/catalogo"><Grid2X2 size={18} /> Ver catalogo</Link>
          </div>
        </header>

        {error && <div className="error-box">{error} <button className="secondary-button" type="button" onClick={load}>Reintentar</button></div>}
        {loading && <div className="panel">Cargando tablero...</div>}

        {!loading && (
          <>
            <section className="reseller-metrics-grid">
              <MetricCard featured tone="success" title="Comision disponible" value={formatGs(summary?.unpaidConfirmedCommission)} note="Disponible para proximo cierre" icon={WalletCards} />
              <MetricCard title="Comision en proceso" value={formatGs(summary?.estimatedCommission)} note="Se confirma al entregar" icon={TrendingUp} />
              <MetricCard title="Total ganado" value={formatGs(summary?.totalHistoricalCommission)} note="Historico de ventas entregadas" icon={Banknote} />
              <MetricCard title="Ventas entregadas" value={summary?.totalDeliveredSales || 0} note="Total historico" icon={PackageCheck} />
              <MetricCard title="Comision de esta semana" value={formatGs(summary?.currentPeriodCommission)} note={`${formatDatePy(summary?.periodStart)} al ${formatDatePy(summary?.periodEnd)}`} icon={CheckCircle2} />
              <MetricCard title="Ventas de esta semana" value={summary?.currentPeriodDeliveredSales || 0} note="Periodo lunes a sabado" icon={PackageSearch} />
              <MetricCard title="Proximo pago" value={formatDatePy(summary?.nextPaymentDate)} note="Lunes de 10:00 a 17:00" icon={Banknote} />
              <MetricCard title="Pagos recibidos" value={formatGs(summary?.totalPaidCommission)} note={`Pendiente en pagos: ${formatGs(summary?.totalPendingPayments)}`} icon={ShieldCheck} />
            </section>

            <section className="reseller-two-column">
              <article className="panel progress-panel">
                <div className="section-title">
                  <h2>Tu progreso esta semana</h2>
                  <span>{summary?.currentPeriodDeliveredSales || 0} de {goals.weekly_sales_goal || 0} ventas</span>
                </div>
                <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
                <div className="profile-summary">
                  <div><span>Ventas entregadas</span><strong>{summary?.currentPeriodDeliveredSales || 0}</strong></div>
                  <div><span>Comision generada</span><strong>{formatGs(summary?.currentPeriodCommission)}</strong></div>
                  <div><span>Periodo</span><strong>Lunes a sabado</strong></div>
                </div>
                <p>{progressMessage(summary?.currentPeriodDeliveredSales || 0)}</p>
              </article>

              <article className="panel bank-status-panel">
                <div className="section-title">
                  <h2>Datos bancarios</h2>
                  <WalletCards size={20} />
                </div>
                {bankAccount ? (
                  <>
                    <strong>Cuenta para pagos configurada</strong>
                    <p>{bankAccount.bank_name} - Alias {bankAccount.bank_alias ? `${String(bankAccount.bank_alias).slice(0, 4)}***` : '-'}</p>
                    <Link className="secondary-button full" to="/panel/cuenta-bancaria">Actualizar cuenta bancaria</Link>
                  </>
                ) : (
                  <>
                    <strong>Completa tus datos bancarios para recibir tus comisiones.</strong>
                    <Link className="primary-button full" to="/panel/cuenta-bancaria">Completar ahora</Link>
                  </>
                )}
              </article>
            </section>

            <section className="reseller-two-column">
              <form className="panel goals-panel" onSubmit={saveGoals}>
                <div className="section-title">
                  <h2>Objetivos semanales</h2>
                  <button className="secondary-button" type="submit" disabled={savingGoals}>{savingGoals ? 'Guardando...' : 'Guardar metas'}</button>
                </div>
                <div className="form-grid">
                  <label>Meta semanal de ventas<input type="number" min="0" value={goals.weekly_sales_goal || 0} onChange={(event) => setGoals((prev) => ({ ...prev, weekly_sales_goal: Number(event.target.value || 0) }))} /></label>
                  <label>Meta semanal de comision<input type="number" min="0" value={goals.weekly_commission_goal || 0} onChange={(event) => setGoals((prev) => ({ ...prev, weekly_commission_goal: Number(event.target.value || 0) }))} /></label>
                </div>
                <div className="goal-line">
                  <strong>{summary?.currentPeriodDeliveredSales || 0} de {goals.weekly_sales_goal || 0} ventas</strong>
                  <ProgressBar value={summary?.currentPeriodDeliveredSales || 0} max={goals.weekly_sales_goal || 1} />
                  <p>{goalMessage(summary?.currentPeriodDeliveredSales || 0, goals.weekly_sales_goal)}</p>
                </div>
                <div className="goal-line">
                  <strong>{formatGs(summary?.currentPeriodCommission)} de {formatGs(goals.weekly_commission_goal)}</strong>
                  <ProgressBar value={summary?.currentPeriodCommission || 0} max={goals.weekly_commission_goal || 1} />
                  <p>{goalMessage(summary?.currentPeriodCommission || 0, goals.weekly_commission_goal)}</p>
                </div>
              </form>

              <article className="panel payment-calendar-card">
                <h2>Proximo pago</h2>
                <strong>{formatDatePy(summary?.nextPaymentDate)}</strong>
                <p>Lunes, de 10:00 a 17:00</p>
                <div className="profile-summary">
                  <div><span>Periodo</span><strong>Lunes a sabado</strong></div>
                  <div><span>Domingo</span><strong>No trabajamos</strong></div>
                </div>
                <small>Si el lunes es feriado, el pago puede realizarse el martes.</small>
              </article>
            </section>

            <section className="panel">
              <div className="section-title">
                <h2>Estado de tus pedidos</h2>
                <span>Solo tus ventas</span>
              </div>
              <div className="pipeline-grid">
                <PipelineItem label="Pendientes" value={summary?.pipeline?.pending_contact || 0} />
                <PipelineItem label="Confirmados" value={summary?.pipeline?.confirmed || 0} />
                <PipelineItem label="En preparacion" value={summary?.pipeline?.preparing || 0} />
                <PipelineItem label="En reparto" value={summary?.pipeline?.out_for_delivery || 0} />
                <PipelineItem label="Entregados" value={summary?.pipeline?.delivered_paid || 0} />
                <PipelineItem label="Cancelados / fallidos" value={summary?.pipeline?.cancelled_group || 0} />
              </div>
            </section>

            <section className="panel">
              <div className="section-title">
                <h2>Actividad reciente</h2>
                <Link to="/panel/rendimiento">Ver rendimiento</Link>
              </div>
              {activity.length ? <Timeline items={activity} /> : <div className="empty-state">Tu actividad aparecera aca cuando tengas ventas, pagos o logros.</div>}
            </section>

            <section className="panel">
              <div className="section-title">
                <h2>Ventas recientes</h2>
                <Link to="/panel/ventas">Ver todas mis ventas <ArrowRight size={16} /></Link>
              </div>
              <div className="reseller-recent-list">
                {recentSales.map((sale) => (
                  <article className="reseller-recent-row pro" key={sale.id}>
                    <div>
                      <strong>{sale.product_name_snapshot}</strong>
                      <span>{sale.customer_name} - {sale.customer_phone_masked}</span>
                      <small>{formatDatePy(sale.created_at)}</small>
                    </div>
                    <div>
                      <span className={`sale-status status-${sale.status}`}>{saleStatusLabel(sale.status)}</span>
                      <strong>{formatGs(sale.reseller_commission)}</strong>
                      <small>{commissionState(sale)}</small>
                    </div>
                  </article>
                ))}
                {!recentSales.length && <div className="empty-state">Todavia no tenes ventas cargadas. Empeza publicando productos del catalogo.</div>}
              </div>
            </section>

            <section className="panel quick-actions-panel">
              <h2>Acciones rapidas</h2>
              <div className="quick-actions-grid">
                <Link className="secondary-button big" to="/catalogo">Ver productos para publicar</Link>
                <Link className="secondary-button big" to="/materiales">Descargar materiales</Link>
                <Link className="secondary-button big" to="/ayuda">Ver videos de ayuda</Link>
                <a className="secondary-button big" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer">Contactar soporte</a>
                <Link className="secondary-button big" to="/panel/cuenta-bancaria">Actualizar cuenta bancaria</Link>
              </div>
            </section>

            <form id="seguridad" className="panel reseller-security-card" onSubmit={submitPassword}>
              <h2><KeyRound size={20} /> Seguridad</h2>
              <p>Cambia tu contrasena. Tu correo no se puede modificar desde esta pantalla.</p>
              {message && <div className="toast">{message}</div>}

              <label>
                Nueva contrasena
                <span className="password-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength="8"
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
                Confirmar contrasena nueva
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength="8"
                  required
                />
              </label>

              <button className="primary-button big full" type="submit" disabled={saving}>
                {saving ? 'Guardando...' : 'Cambiar contrasena'}
              </button>
            </form>
          </>
        )}
      </div>
    </ResellerPanelLayout>
  )
}
