import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { AdminDataTable, AdminPageHeader, DateCell, MoneyCell, StickySummary } from '../../components/AdminUX'
import { createCommissionPayment, getBankAccountForReseller, getCommissionBatch, getEligibleSalesForBatch } from '../../lib/adminCommissionsApi'
import { calculateNetPaid } from '../../lib/commissionConstants'
import { formatDatePy } from '../../lib/dateUtils'

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

  if (loading) return <div className="admin-page ax-page"><p>Cargando...</p></div>

  const columns = [
    { key: 'delivered_at', label: 'Entregada', render: (sale) => <DateCell value={sale.delivered_at} /> },
    { key: 'product', label: 'Producto', render: (sale) => sale.product_name_snapshot },
    { key: 'commission', label: 'Comision', align: 'right', render: (sale) => <MoneyCell value={sale.reseller_commission} /> }
  ]

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader
        eyebrow="Crear pago"
        title={reseller?.full_name || 'Revendedor'}
        description={batch ? `${formatDatePy(batch.period_start)} al ${formatDatePy(batch.period_end)}` : 'Preparacion de pago'}
        actions={<Link className="secondary-button" to={`/admin/comisiones/${batchId}`}><ArrowLeft size={16} /> Volver</Link>}
      />
      {error && <div className="error-box">{error}</div>}

      <form className="ax-sale-form" onSubmit={submit}>
        <div className="ax-form-main">
          <section className="form-section">
            <h2>Cuenta bancaria</h2>
            {bankAccount ? (
              <div className="ax-info-grid">
                <div><span>Banco</span><strong>{bankAccount.bank_name}</strong></div>
                <div><span>Alias</span><strong>{bankAccount.bank_alias || '-'}</strong></div>
                <div><span>Titular</span><strong>{bankAccount.bank_holder}</strong></div>
                <div><span>Documento</span><strong>{bankAccount.bank_document || '-'}</strong></div>
              </div>
            ) : <div className="error-box">Este revendedor no tiene cuenta bancaria cargada.</div>}
          </section>

          <section className="form-section">
            <h2>Ventas incluidas</h2>
            <AdminDataTable
              columns={columns}
              rows={sales}
              loading={false}
              empty="No hay ventas pendientes para este revendedor."
            />
          </section>

          <section className="form-section">
            <h2>Datos del pago</h2>
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
        </div>

        <StickySummary
          title="Resumen de pago"
          items={[
            { label: 'Ventas', value: sales.length },
            { label: 'Total comision', value: <MoneyCell value={gross} /> },
            { label: 'Ajustes', value: <MoneyCell value={form.adjustments} /> },
            { label: 'Descuentos', value: <MoneyCell value={form.discounts} /> },
            { label: 'Neto a pagar', value: <MoneyCell value={net} /> }
          ]}
        >
          <button className="primary-button big" type="submit" disabled={saving || !sales.length || !bankAccount}>
            <Save size={18} /> {saving ? 'Guardando...' : 'Confirmar pago'}
          </button>
        </StickySummary>
      </form>
    </div>
  )
}
