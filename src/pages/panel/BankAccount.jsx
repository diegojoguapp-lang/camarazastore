import { useEffect, useState } from 'react'
import { Save, WalletCards } from 'lucide-react'
import { ResellerPanelLayout } from '../../components/ResellerPanelLayout'
import { getMyBankAccount, saveMyBankAccount } from '../../lib/resellerCommissionsApi'

const emptyForm = {
  bank_name: '',
  bank_alias: '',
  bank_holder: '',
  bank_document: '',
  account_type: ''
}

export function BankAccount() {
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getMyBankAccount()
      .then((account) => { if (account) setForm({ ...emptyForm, ...account }) })
      .catch((err) => setError(err.message || 'No se pudo cargar la cuenta bancaria.'))
      .finally(() => setLoading(false))
  }, [])

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    if (!form.bank_name.trim() || !form.bank_holder.trim()) {
      setError('Banco y titular son obligatorios.')
      return
    }
    try {
      setSaving(true)
      setError('')
      setMessage('')
      const saved = await saveMyBankAccount(form)
      setForm({ ...emptyForm, ...saved })
      setMessage('Cuenta bancaria guardada.')
    } catch (err) {
      setError(err.message || 'No se pudo guardar la cuenta bancaria.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <ResellerPanelLayout><div className="reseller-dashboard-page"><div className="panel">Cargando cuenta bancaria...</div></div></ResellerPanelLayout>

  return (
    <ResellerPanelLayout>
      <div className="reseller-dashboard-page">
        <form className="panel reseller-security-card" onSubmit={submit}>
          <p className="eyebrow">Mi panel</p>
          <h1><WalletCards size={26} /> Cuenta bancaria</h1>
          <p>Usamos estos datos para pagar tus comisiones. Solo puede haber una cuenta principal.</p>
          {!form.id && <div className="notice-box">Completa tus datos bancarios para recibir tus comisiones.</div>}
          {error && <div className="error-box">{error}</div>}
          {message && <div className="toast">{message}</div>}
          <label>Banco *<input value={form.bank_name || ''} onChange={(e) => setField('bank_name', e.target.value)} required /></label>
          <label>Alias<input value={form.bank_alias || ''} onChange={(e) => setField('bank_alias', e.target.value)} /></label>
          <label>Titular *<input value={form.bank_holder || ''} onChange={(e) => setField('bank_holder', e.target.value)} required /></label>
          <label>Documento<input value={form.bank_document || ''} onChange={(e) => setField('bank_document', e.target.value)} /></label>
          <label>Tipo de cuenta<input value={form.account_type || ''} onChange={(e) => setField('account_type', e.target.value)} /></label>
          <button className="primary-button big full" type="submit" disabled={saving}><Save size={18} /> {saving ? 'Guardando...' : 'Guardar cuenta'}</button>
        </form>
      </div>
    </ResellerPanelLayout>
  )
}
