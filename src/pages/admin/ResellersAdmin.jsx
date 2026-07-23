import { useEffect, useMemo, useState } from 'react'
import { Copy, KeyRound, Plus, RefreshCw, UserCheck, UserX } from 'lucide-react'
import { createReseller, getResellers, resetResellerPassword, setResellerActive } from '../../lib/resellerApi'
import { copyToClipboard } from '../../lib/utils'

const emptyCreate = {
  fullName: '',
  email: '',
  temporaryPassword: '',
  confirmPassword: '',
  phone: '',
  city: ''
}

const emptyReset = {
  userId: '',
  name: '',
  email: '',
  resellerCode: '',
  password: '',
  confirmPassword: ''
}

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
      setCreated({
        ...result,
        temporaryPassword: form.temporaryPassword
      })
      setForm(emptyCreate)
      setMessage('Revendedor creado correctamente.')
      load()
    } catch (err) {
      setError(err.message || 'No se pudo crear el revendedor.')
    } finally {
      setSaving(false)
    }
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
    if (resetForm.password.length < 8) {
      setError('La nueva contrasena debe tener minimo 8 caracteres.')
      return
    }
    if (resetForm.password !== resetForm.confirmPassword) {
      setError('Las contrasenas no coinciden.')
      return
    }

    try {
      setResetting(true)
      setError('')
      setMessage('')
      await resetResellerPassword(resetForm.userId, resetForm.password)
      setCreated(null)
      setMessage('Contrasena restablecida correctamente.')
      await copyCredentials({
        email: resetForm.email,
        temporaryPassword: resetForm.password,
        resellerCode: resetForm.resellerCode,
        fullName: resetForm.name
      })
      setResetForm(emptyReset)
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
    <div className="admin-page">
      <div className="admin-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Revendedores</h1>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      {created && (
        <section className="panel reseller-created-card">
          <div>
            <p className="eyebrow">Revendedor creado correctamente</p>
            <h2>{created.fullName}</h2>
            <p><strong>Codigo:</strong> {created.resellerCode}</p>
            <p><strong>Correo:</strong> {created.email}</p>
            <p><strong>Contrasena temporal:</strong> {created.temporaryPassword}</p>
          </div>
          <button className="primary-button" type="button" onClick={() => copyCredentials(created)}>
            <Copy size={16} />
            Copiar credenciales
          </button>
        </section>
      )}

      <form className="form-section admin-simple-form" onSubmit={submitCreate}>
        <h2><Plus size={18} /> Nuevo revendedor</h2>
        <div className="form-grid">
          <label>Nombre completo *<input value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} required /></label>
          <label>Correo electronico *<input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} required /></label>
          <label>Contrasena temporal *<input type="password" value={form.temporaryPassword} onChange={(e) => setField('temporaryPassword', e.target.value)} minLength="8" required /></label>
          <label>Confirmar contrasena *<input type="password" value={form.confirmPassword} onChange={(e) => setField('confirmPassword', e.target.value)} minLength="8" required /></label>
          <label>Telefono<input value={form.phone} onChange={(e) => setField('phone', e.target.value)} /></label>
          <label>Ciudad<input value={form.city} onChange={(e) => setField('city', e.target.value)} /></label>
        </div>
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? 'Creando...' : 'Crear revendedor'}
        </button>
      </form>

      {resetForm.userId && (
        <form className="form-section admin-simple-form" onSubmit={submitReset}>
          <h2><KeyRound size={18} /> Restablecer contrasena</h2>
          <p>Revendedor: <strong>{resetForm.name}</strong></p>
          <div className="form-grid">
            <label>Nueva contrasena temporal<input type="password" value={resetForm.password} onChange={(e) => setResetForm((prev) => ({ ...prev, password: e.target.value }))} minLength="8" required /></label>
            <label>Confirmar contrasena<input type="password" value={resetForm.confirmPassword} onChange={(e) => setResetForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} minLength="8" required /></label>
          </div>
          <div className="form-actions-row">
            <button className="primary-button" type="submit" disabled={resetting}>{resetting ? 'Guardando...' : 'Restablecer'}</button>
            <button className="secondary-button" type="button" onClick={() => setResetForm(emptyReset)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        {loading && <p>Cargando revendedores...</p>}
        {!loading && (
          <table className="admin-table resellers-table">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Telefono</th>
                <th>Ciudad</th>
                <th>Estado</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedResellers.map((reseller) => (
                <tr key={reseller.id}>
                  <td><strong>{reseller.reseller_code || '-'}</strong></td>
                  <td>{reseller.full_name || '-'}</td>
                  <td>{reseller.email || '-'}</td>
                  <td>{reseller.phone || '-'}</td>
                  <td>{reseller.city || '-'}</td>
                  <td><span className={`admin-status ${reseller.is_active ? 'status-active' : 'status-disabled'}`}>{reseller.is_active ? 'Activo' : 'Inactivo'}</span></td>
                  <td>{formatDate(reseller.created_at)}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => openReset(reseller)}><KeyRound size={14} /> Restablecer</button>
                      <button type="button" onClick={() => toggleActive(reseller)}>
                        {reseller.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                        {reseller.is_active ? 'Desactivar' : 'Reactivar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !resellers.length && <div className="empty-state">Todavia no hay revendedores cargados.</div>}
      </div>

      <button className="secondary-button refresh-button" type="button" onClick={load}>
        <RefreshCw size={16} />
        Actualizar lista
      </button>
    </div>
  )
}
