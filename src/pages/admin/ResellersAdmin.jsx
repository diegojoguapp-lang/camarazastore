import { useEffect, useMemo, useState } from 'react'
import { Copy, KeyRound, Plus, RefreshCw, UserCheck, UserX } from 'lucide-react'
import { AdminDataTable, AdminPageHeader, Drawer, RowActions } from '../../components/AdminUX'
import { createReseller, getResellers, resetResellerPassword, setResellerActive } from '../../lib/resellerApi'
import { copyToClipboard } from '../../lib/utils'

const emptyCreate = { fullName: '', email: '', temporaryPassword: '', confirmPassword: '', phone: '', city: '' }
const emptyReset = { userId: '', name: '', email: '', resellerCode: '', password: '', confirmPassword: '' }

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'short' }).format(new Date(value))
}

export function ResellersAdmin() {
  const [resellers, setResellers] = useState([])
  const [form, setForm] = useState(emptyCreate)
  const [resetForm, setResetForm] = useState(emptyReset)
  const [created, setCreated] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  const sortedResellers = useMemo(() => resellers, [resellers])

  const load = () => {
    setLoading(true)
    getResellers()
      .then(setResellers)
      .catch((err) => setError(err.message || 'No se pudieron cargar revendedores.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const validateCreate = () => {
    const email = normalizeEmail(form.email)
    if (!form.fullName.trim()) return 'El nombre completo es obligatorio.'
    if (!isEmail(email)) return 'Correo electronico invalido.'
    if (form.temporaryPassword.length < 8) return 'La contrasena temporal debe tener minimo 8 caracteres.'
    if (form.temporaryPassword !== form.confirmPassword) return 'Las contrasenas no coinciden.'
    if (resellers.some((item) => normalizeEmail(item.email) === email)) return 'Ya existe un revendedor con ese correo.'
    return ''
  }

  const copyCredentials = async (payload) => {
    const text = [
      'Credenciales *Panel Revendedor*',
      '',
      '*ACCESO*',
      `*Correo:* ${payload.email}`,
      `*Contraseña:* ${payload.temporaryPassword}`,
      '',
      'Ingresar en:',
      'https://camarazareventa.com/login',
      '',
      `*Código Revendedor:* ${payload.resellerCode}`,
      `*Nombre:* ${payload.fullName}`
    ].join('\n')
    const ok = await copyToClipboard(text)
    setMessage(ok ? 'Credenciales copiadas.' : 'No se pudo copiar.')
  }

  const submitCreate = async (event) => {
    event.preventDefault()
    const validation = validateCreate()
    if (validation) {
      setError(validation)
      return
    }
    try {
      setSaving(true)
      setError('')
      setMessage('')
      const result = await createReseller({
        email: normalizeEmail(form.email),
        temporaryPassword: form.temporaryPassword,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        city: form.city.trim()
      })
      setCreated({ ...result, temporaryPassword: form.temporaryPassword })
      setForm(emptyCreate)
      setMessage('Revendedor creado correctamente.')
      load()
    } catch (err) {
      setError(err.message || 'No se pudo crear el revendedor.')
    } finally {
      setSaving(false)
    }
  }

  const openReset = (reseller) => {
    setResetForm({
      userId: reseller.id,
      name: reseller.full_name || reseller.email,
      email: reseller.email || '',
      resellerCode: reseller.reseller_code || '',
      password: '',
      confirmPassword: ''
    })
    setError('')
    setMessage('')
  }

  const submitReset = async (event) => {
    event.preventDefault()
    if (resetForm.password.length < 8) return setError('La nueva contrasena debe tener minimo 8 caracteres.')
    if (resetForm.password !== resetForm.confirmPassword) return setError('Las contrasenas no coinciden.')
    try {
      setResetting(true)
      setError('')
      setMessage('')
      await resetResellerPassword(resetForm.userId, resetForm.password)
      await copyCredentials({ email: resetForm.email, temporaryPassword: resetForm.password, resellerCode: resetForm.resellerCode, fullName: resetForm.name })
      setResetForm(emptyReset)
      setMessage('Contrasena restablecida correctamente.')
    } catch (err) {
      setError(err.message || 'No se pudo restablecer la contrasena.')
    } finally {
      setResetting(false)
    }
  }

  const toggleActive = async (reseller) => {
    const nextState = !reseller.is_active
    const action = nextState ? 'reactivar' : 'desactivar'
    if (!window.confirm(`Seguro que queres ${action} a ${reseller.full_name || reseller.email}?`)) return
    try {
      setError('')
      setMessage('')
      await setResellerActive(reseller.id, nextState)
      setMessage(nextState ? 'Revendedor reactivado.' : 'Revendedor desactivado.')
      load()
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el estado.')
    }
  }

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader
        title="Revendedores"
        description="Cuentas, accesos y estado operativo del equipo."
        actions={<><button className="secondary-button" type="button" onClick={load}><RefreshCw size={16} /> Actualizar</button><button className="primary-button" type="button" onClick={() => setDrawerOpen(true)}><Plus size={16} /> Nuevo revendedor</button></>}
      />

      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <AdminDataTable
        loading={loading}
        rows={sortedResellers}
        empty="Todavia no hay revendedores cargados."
        columns={[
          { key: 'code', label: 'Codigo', render: (reseller) => <strong>{reseller.reseller_code || '-'}</strong> },
          { key: 'name', label: 'Nombre', render: (reseller) => reseller.full_name || '-' },
          { key: 'email', label: 'Correo', render: (reseller) => reseller.email || '-' },
          { key: 'phone', label: 'Telefono', render: (reseller) => reseller.phone || '-' },
          { key: 'city', label: 'Ciudad', render: (reseller) => reseller.city || '-' },
          { key: 'status', label: 'Estado', render: (reseller) => <span className={`admin-status ${reseller.is_active ? 'status-active' : 'status-disabled'}`}>{reseller.is_active ? 'Activo' : 'Inactivo'}</span> },
          { key: 'created', label: 'Creado', render: (reseller) => formatDate(reseller.created_at) },
          { key: 'actions', label: 'Acciones', render: (reseller) => (
            <RowActions>
              <button type="button" onClick={() => openReset(reseller)}><KeyRound size={14} /> Restablecer</button>
              <button type="button" onClick={() => toggleActive(reseller)}>{reseller.is_active ? <UserX size={14} /> : <UserCheck size={14} />}{reseller.is_active ? 'Desactivar' : 'Reactivar'}</button>
            </RowActions>
          ) }
        ]}
      />

      <Drawer open={drawerOpen} title="Nuevo revendedor" onClose={() => setDrawerOpen(false)}>
        {created && (
          <section className="ax-created-box">
            <strong>{created.fullName}</strong>
            <span>{created.resellerCode}</span>
            <button className="secondary-button" type="button" onClick={() => copyCredentials(created)}><Copy size={16} /> Copiar credenciales</button>
          </section>
        )}
        <form className="ax-drawer-form" onSubmit={submitCreate}>
          <label>Nombre completo *<input value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} required /></label>
          <label>Correo electronico *<input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} required /></label>
          <label>Contrasena temporal *<input type="password" value={form.temporaryPassword} onChange={(e) => setField('temporaryPassword', e.target.value)} minLength="8" required /></label>
          <label>Confirmar contrasena *<input type="password" value={form.confirmPassword} onChange={(e) => setField('confirmPassword', e.target.value)} minLength="8" required /></label>
          <label>Telefono<input value={form.phone} onChange={(e) => setField('phone', e.target.value)} /></label>
          <label>Ciudad<input value={form.city} onChange={(e) => setField('city', e.target.value)} /></label>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Creando...' : 'Crear revendedor'}</button>
        </form>
      </Drawer>

      <Drawer open={Boolean(resetForm.userId)} title="Restablecer contrasena" onClose={() => setResetForm(emptyReset)}>
        <form className="ax-drawer-form" onSubmit={submitReset}>
          <p>Revendedor: <strong>{resetForm.name}</strong></p>
          <label>Nueva contrasena temporal<input type="password" value={resetForm.password} onChange={(e) => setResetForm((prev) => ({ ...prev, password: e.target.value }))} minLength="8" required /></label>
          <label>Confirmar contrasena<input type="password" value={resetForm.confirmPassword} onChange={(e) => setResetForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} minLength="8" required /></label>
          <button className="primary-button" type="submit" disabled={resetting}>{resetting ? 'Guardando...' : 'Restablecer y copiar'}</button>
        </form>
      </Drawer>
    </div>
  )
}
