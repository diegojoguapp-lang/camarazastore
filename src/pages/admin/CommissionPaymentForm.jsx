import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { createCommissionPayment, getBankAccountForReseller, getCommissionBatch, getEligibleSalesForBatch } from '../../lib/adminCommissionsApi'
import { calculateNetPaid } from '../../lib/commissionConstants'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'

const emptyForm = {
  adjustments: 0,
  discounts: 0,
  payment_method: 'transferencia',
  payment_date: new Date().toISOString().slice(0, 10),
  voucher_url: '',
  voucher_number: '',
  notes: ''
}

export function CommissionPaymentForm() {
  const { batchId, resellerId } = useParams()
  const navigate = useNavigate()
  const [batch, setBatch] = useState(null)
  const [sales, setSales] = useState([])
  const [bankAccount, setBankAccount] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const gross = useMemo(() => sales.reduce((sum, sale) => sum + Number(sale.reseller_commission || 0), 0), [sales])
  const net = calculateNetPaid({ gross_commission: gross, adjustments: form.adjustments, discounts: form.discounts })
  const reseller = sales[0]?.reseller

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const batchData = await getCommissionBatch(batchId)
        const [saleRows, bank] = await Promise.all([
          getEligibleSalesForBatch(batchData),
          getBankAccountForReseller(resellerId)
        ])
        setBatch(batchData)
        setSales(saleRows.filter((sale) => sale.reseller_id === resellerId))
        setBankAccount(bank)
      } catch (err) {
        setError(err.message || 'No se pudo preparar el pago.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [batchId, resellerId])

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    if (!sales.length) {
      setError('No hay ventas pendientes para este revendedor.')
      return
    }
    if (!bankAccount) {
      setError('El revendedor no tiene cuenta bancaria cargada.')
      return
    }

    try {
      setSaving(true)
      setError('')
      const payment = await createCommissionPayment({
        batchId,
        resellerId,
        sales,
        bankAccount,
        form
      })
      navigate(`/admin/comisiones/pagos/${payment.id}`)
    } catch (err) {
      setError(err.message || 'No se pudo crear el pago.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="admin-page"><p>Cargando...</p></div>

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div>
          <p className="eyebrow">Crear pago</p>
          <h1>{reseller?.full_name || 'Revendedor'}</h1>
          {batch && <p>{formatDatePy(batch.period_start)} al {formatDatePy(batch.period_end)}</p>}
        </div>
        <Link className="secondary-button" to={`/admin/comisiones/${batchId}`}><ArrowLeft size={16} /> Volver</Link>
      </div>
      {error && <div className="error-box">{error}</div>}

      <form className="product-form" onSubmit={submit}>
        <section className="form-section">
          <h2>Cuenta bancaria</h2>
          {bankAccount ? (
            <div className="profile-summary">
              <div><span>Banco</span><strong>{bankAccount.bank_name}</strong></div>
              <div><span>Alias</span><strong>{bankAccount.bank_alias || '-'}</strong></div>
              <div><span>Titular</span><strong>{bankAccount.bank_holder}</strong></div>
              <div><span>Documento</span><strong>{bankAccount.bank_document || '-'}</strong></div>
            </div>
          ) : <div className="error-box">Este revendedor no tiene cuenta bancaria cargada.</div>}
        </section>

        <section className="form-section">
          <h2>Ventas incluidas</h2>
          <div className="commission-items-list">
            {sales.map((sale) => (
              <div key={sale.id}>
                <span>{formatDatePy(sale.delivered_at)} - {sale.product_name_snapshot}</span>
                <strong>{formatGs(sale.reseller_commission)}</strong>
              </div>
            ))}
          </div>
          {!sales.length && <div className="empty-state">No hay ventas pendientes para este revendedor.</div>}
        </section>

        <section className="form-section">
          <h2>Pago</h2>
          <div className="money-preview">
            <div><span>Total comision</span><strong>{formatGs(gross)}</strong></div>
            <div><span>Ajustes</span><strong>{formatGs(form.adjustments)}</strong></div>
            <div><span>Neto a pagar</span><strong>{formatGs(net)}</strong></div>
          </div>
          <div className="form-grid">
            <label>Ajuste positivo<input type="number" min="0" value={form.adjustments} onChange={(e) => setField('adjustments', e.target.value)} /></label>
            <label>Descuento<input type="number" min="0" value={form.discounts} onChange={(e) => setField('discounts', e.target.value)} /></label>
            <label>Fecha<input type="date" value={form.payment_date} onChange={(e) => setField('payment_date', e.target.value)} /></label>
            <label>Metodo<input value={form.payment_method} onChange={(e) => setField('payment_method', e.target.value)} /></label>
            <label>Comprobante URL<input value={form.voucher_url} onChange={(e) => setField('voucher_url', e.target.value)} /></label>
            <label>Nro. transferencia<input value={form.voucher_number} onChange={(e) => setField('voucher_number', e.target.value)} /></label>
          </div>
          <label>Observacion<textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} /></label>
        </section>

        <button className="primary-button big" type="submit" disabled={saving || !sales.length || !bankAccount}>
          <Save size={18} /> {saving ? 'Guardando...' : 'Confirmar pago'}
        </button>
      </form>
    </div>
  )
}
