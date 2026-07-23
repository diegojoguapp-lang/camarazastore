import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Grid2X2, HelpCircle, KeyRound, LogOut, MessageCircle, ShieldCheck, UserRound, WalletCards } from 'lucide-react'
import { ResellerPanelLayout } from '../../components/ResellerPanelLayout'
import { ActivityListItem, CompactPageHeader, SettingsRow } from '../../components/ResellerUX'
import { getCurrentProfile, signOut, updateCurrentPassword } from '../../lib/roles'
import { getMyBankAccount } from '../../lib/resellerCommissionsApi'
import { getMyActivity } from '../../lib/resellerExperienceApi'
import { formatDatePy } from '../../lib/dateUtils'
import { whatsappNumber } from '../../lib/utils'

export function PanelProfile() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [account, setAccount] = useState(null)
  const [activity, setActivity] = useState([])
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const [profileData, accountData, activityRows] = await Promise.all([
        getCurrentProfile(),
        getMyBankAccount(),
        getMyActivity(8)
      ])
      setProfile(profileData)
      setAccount(accountData)
      setActivity(activityRows || [])
    } catch (err) {
      setError(err.message || 'No se pudo cargar tu cuenta.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const logout = async () => {
    await signOut()
    navigate('/login')
  }

  const submitPassword = async (event) => {
    event.preventDefault()
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
      setError('')
      setMessage('')
      await updateCurrentPassword(password)
      setPassword('')
      setConfirmPassword('')
      setShowPassword(false)
      setMessage('Contrasena actualizada correctamente.')
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la contrasena.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResellerPanelLayout>
      <div className="rx-page">
        <CompactPageHeader profile={profile} title="Mi cuenta" subtitle="Datos, seguridad y accesos." />
        {error && <div className="error-box">{error}</div>}
        {message && <div className="toast">{message}</div>}
        {loading && <div className="rx-skeleton-list"><span /><span /><span /></div>}

        {!loading && (
          <>
            <section className="rx-settings-group">
              <h2>Informacion de cuenta</h2>
              <div className="rx-info-list">
                <div><span>Nombre</span><strong>{profile?.full_name || '-'}</strong></div>
                <div><span>Codigo</span><strong>{profile?.reseller_code || '-'}</strong></div>
                <div><span>Correo</span><strong>{profile?.email || '-'}</strong></div>
                <div><span>WhatsApp</span><strong>{profile?.phone || '-'}</strong></div>
                <div><span>Ciudad</span><strong>{profile?.city || '-'}</strong></div>
                <div><span>Ingreso</span><strong>{formatDatePy(profile?.created_at)}</strong></div>
              </div>
            </section>

            <section className="rx-settings-group">
              <h2>Datos bancarios</h2>
              <SettingsRow icon={WalletCards} label={account ? account.bank_name : 'Cuenta bancaria pendiente'} detail={account?.bank_alias ? `Alias ${String(account.bank_alias).slice(0, 4)}***` : 'Editar datos bancarios'} to="/panel/cuenta-bancaria" />
            </section>

            <section className="rx-settings-group">
              <h2>Seguridad</h2>
              <SettingsRow icon={KeyRound} label="Cambiar contrasena" detail="Actualiza tu acceso" onClick={() => setShowPassword((value) => !value)} />
              {showPassword && (
                <form className="rx-inline-form" onSubmit={submitPassword}>
                  <label>Nueva contrasena<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" required /></label>
                  <label>Confirmar contrasena<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength="8" required /></label>
                  <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar contrasena'}</button>
                </form>
              )}
              <SettingsRow icon={LogOut} label="Cerrar sesion" detail="Salir de este dispositivo" onClick={logout} danger />
            </section>

            <section className="rx-settings-group">
              <h2>Actividad</h2>
              <div className="rx-activity-list">
                {activity.map((item) => <ActivityListItem key={item.activity_id || item.id} item={item} />)}
                {!activity.length && <div className="rx-empty">Tu actividad aparecera aca cuando tengas ventas, pagos o logros.</div>}
              </div>
            </section>

            <section className="rx-settings-group">
              <h2>Ayuda y accesos</h2>
              <SettingsRow icon={Grid2X2} label="Ver catalogo" to="/catalogo" />
              <SettingsRow icon={HelpCircle} label="Videos de ayuda" to="/ayuda" />
              <SettingsRow icon={BookOpen} label="Reglas" to="/reglas" />
              <SettingsRow icon={MessageCircle} label="Contactar soporte" onClick={() => window.open(`https://wa.me/${whatsappNumber}`, '_blank', 'noreferrer')} />
              <SettingsRow icon={ShieldCheck} label="Estado de cuenta" detail={profile?.is_active ? 'Cuenta activa' : 'Cuenta suspendida'} />
              <SettingsRow icon={UserRound} label="Perfil publico" detail="No editable desde esta pantalla" />
            </section>
          </>
        )}
      </div>
    </ResellerPanelLayout>
  )
}
