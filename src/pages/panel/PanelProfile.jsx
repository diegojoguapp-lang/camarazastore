import { useEffect, useState } from 'react'
import { Mail, MapPin, Phone, ShieldCheck, UserRound, WalletCards } from 'lucide-react'
import { ResellerPanelLayout } from '../../components/ResellerPanelLayout'
import { MetricCard, PageHeader } from '../../components/design'
import { getCurrentProfile } from '../../lib/roles'
import { getMyBankAccount } from '../../lib/resellerCommissionsApi'
import { getMyPerformance } from '../../lib/resellerExperienceApi'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'

export function PanelProfile() {
  const [profile, setProfile] = useState(null)
  const [account, setAccount] = useState(null)
  const [performance, setPerformance] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getCurrentProfile(), getMyBankAccount(), getMyPerformance()])
      .then(([profileData, accountData, performanceData]) => {
        setProfile(profileData)
        setAccount(accountData)
        setPerformance(performanceData)
      })
      .catch((err) => setError(err.message || 'No se pudo cargar tu perfil.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <ResellerPanelLayout>
      <div className="reseller-dashboard-page">
        <PageHeader eyebrow="Cuenta" title="Mi perfil" description="Datos de tu cuenta de revendedor y resumen de actividad." />
        {error && <div className="error-box">{error}</div>}
        {loading && <div className="panel">Cargando perfil...</div>}
        {!loading && (
          <>
            <section className="profile-hero-card panel">
              <div className="profile-avatar">{(profile?.full_name || profile?.email || 'R').slice(0, 2).toUpperCase()}</div>
              <div>
                <h2>{profile?.full_name || '-'}</h2>
                <p>Codigo: <strong>{profile?.reseller_code || '-'}</strong></p>
                <span className={`account-pill ${profile?.is_active ? 'active' : ''}`}>{profile?.is_active ? 'Cuenta activa' : 'Cuenta suspendida'}</span>
              </div>
            </section>

            <section className="reseller-metrics-grid">
              <MetricCard icon={UserRound} label="Ventas totales" value={performance.total_sales || 0} hint="Pedidos registrados" />
              <MetricCard icon={ShieldCheck} label="Ventas entregadas" value={performance.delivered_sales || 0} hint="Pedidos completados" />
              <MetricCard icon={WalletCards} label="Comisiones generadas" value={formatGs(performance.generated_commission)} hint="Historico entregado" />
              <MetricCard icon={WalletCards} label="Comisiones cobradas" value={formatGs(performance.paid_commission)} hint="Pagos recibidos" />
            </section>

            <section className="reseller-two-column">
              <article className="panel">
                <h2>Datos personales</h2>
                <div className="profile-summary">
                  <div><span><Mail size={14} /> Correo</span><strong>{profile?.email || '-'}</strong></div>
                  <div><span><Phone size={14} /> WhatsApp</span><strong>{profile?.phone || '-'}</strong></div>
                  <div><span><MapPin size={14} /> Ciudad</span><strong>{profile?.city || '-'}</strong></div>
                  <div><span>Fecha de ingreso</span><strong>{formatDatePy(profile?.created_at)}</strong></div>
                  <div><span>Ultima venta</span><strong>{formatDatePy(performance.last_sale_at)}</strong></div>
                </div>
              </article>
              <article className="panel">
                <h2>Cuenta bancaria</h2>
                {account ? (
                  <div className="profile-summary">
                    <div><span>Banco</span><strong>{account.bank_name}</strong></div>
                    <div><span>Alias</span><strong>{account.bank_alias || '-'}</strong></div>
                    <div><span>Titular</span><strong>{account.bank_holder}</strong></div>
                    <div><span>Estado</span><strong>Configurada</strong></div>
                  </div>
                ) : <div className="empty-state">Completa tu cuenta bancaria para recibir pagos.</div>}
              </article>
            </section>
          </>
        )}
      </div>
    </ResellerPanelLayout>
  )
}
