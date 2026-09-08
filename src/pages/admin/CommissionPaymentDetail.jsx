import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { AdminDataTable, AdminPageHeader, AdminStatusBadge, DateCell, MoneyCell, StickySummary } from '../../components/AdminUX'
import { confirmCommissionPayment, cancelCommissionPayment, getCommissionPayment, getPaymentAdjustments, getPaymentItems } from '../../lib/adminCommissionsApi'
import { getFinancialAccounts } from '../../lib/adminFinanceApi'
import { businessDate, orderCode } from '../../lib/operationDates'
import { paymentStatusLabel } from '../../lib/commissionConstants'
import { formatDatePy } from '../../lib/dateUtils'

export function CommissionPaymentDetail() {
  const { id } = useParams()
  const [payment, setPayment] = useState(null)
  const [items, setItems] = useState([])
  const [adjustments, setAdjustments] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState(() => ({ financial_account_id: '', payment_date: businessDate(), payment_method: 'transferencia', voucher_number: '', voucher_url: '' }))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [paymentData, itemRows, adjustmentRows, accountRows] = await Promise.all([getCommissionPayment(id), getPaymentItems(id), getPaymentAdjustments(id), getFinancialAccounts()])
        setPayment(paymentData)
        setItems(itemRows)
        setAdjustments(adjustmentRows)
        setAccounts(accountRows.filter((a) => a.is_active))
      } catch (err) {
        setError(err.message || 'No se pudo cargar el pago.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return <div className="admin-page ax-page"><p>Cargando...</p></div>
  if (!payment) return <div className="admin-page ax-page"><div className="error-box">Pago no encontrado.</div></div>

  const columns = [
    { key: 'order', label: 'Pedido', render: (item) => item.sale ? <Link to={`/admin/ventas/${item.sale.id}`}>{orderCode(item.sale)}</Link> : '-' },
    { key: 'delivered_at', label: 'Entregada', render: (item) => <DateCell value={item.sale?.delivered_at} /> },
    { key: 'product', label: 'Producto', render: (item) => item.sale?.product_name_snapshot || '-' },
    { key: 'commission', label: 'Comision', align: 'right', render: (item) => <MoneyCell value={item.commission_amount_snapshot} /> }
  ]
  const adjustmentColumns = [
    { key: 'reason', label: 'Motivo', render: (item) => item.adjustment?.reason || '-' },
    { key: 'amount', label: 'Aplicado', align: 'right', render: (item) => <MoneyCell value={item.amount_applied} /> }
  ]
  const phone = String(payment.reseller?.phone || '').replace(/\D/g, '')
  const whatsappUrl = phone ? `https://wa.me/${phone}` : ''

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader
        eyebrow="Pago"
        title={payment.reseller?.full_name || 'Revendedor'}
        description={`${paymentStatusLabel(payment.status)} - ${formatDatePy(payment.payment_date)}`}
        actions={<Link className="secondary-button" to={`/admin/comisiones/${payment.batch_id}`}><ArrowLeft size={16} /> Volver</Link>}
      />
      {error && <div className="error-box">{error}</div>}
      {payment.status === 'pending' && <section className="ax-panel"><h2>Confirmar pago de liquidacion</h2>
        <form className="form-grid" onSubmit={async (event) => {
          event.preventDefault(); setSaving(true); setError('')
          try { setPayment(await confirmCommissionPayment(id, form)) } catch (err) { setError(err.message) } finally { setSaving(false) }
        }}>
          <label>Cuenta de origen<select required value={form.financial_account_id} onChange={(e) => setForm((prev) => ({ ...prev, financial_account_id: e.target.value }))}><option value="">Seleccionar</option>{accounts.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}</select></label>
          <label>Fecha<input type="date" required value={form.payment_date} onChange={(e) => setForm((prev) => ({ ...prev, payment_date: e.target.value }))} /></label>
          <label>Metodo<select value={form.payment_method} onChange={(e) => setForm((prev) => ({ ...prev, payment_method: e.target.value }))}><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option></select></label>
          <label>Numero de comprobante<input value={form.voucher_number} onChange={(e) => setForm((prev) => ({ ...prev, voucher_number: e.target.value }))} /></label>
          <label>URL del comprobante<input type="url" value={form.voucher_url} onChange={(e) => setForm((prev) => ({ ...prev, voucher_url: e.target.value }))} /></label>
          <button className="primary-button" disabled={saving}>{saving ? 'Guardando...' : 'Confirmar pago'}</button>
          <button className="secondary-button" type="button" disabled={saving} onClick={async () => {
            if (!window.confirm('Cancelar esta liquidacion pendiente y liberar las ventas y ajustes?')) return
            setSaving(true); setError('')
            try { setPayment(await cancelCommissionPayment(id)) } catch (err) { setError(err.message) } finally { setSaving(false) }
          }}>Cancelar liquidacion</button>
        </form>
      </section>}

      <div className="ax-detail-layout">
        <section className="ax-panel">
          <h2>Ventas de la liquidacion</h2>
          <AdminDataTable
            columns={columns}
            rows={items}
            loading={false}
            empty="Este pago no tiene ventas asociadas."
          />
          {adjustments.length > 0 && (
            <>
              <h2>Ajustes aplicados</h2>
              <AdminDataTable
                columns={adjustmentColumns}
                rows={adjustments}
                loading={false}
                empty="Sin ajustes aplicados."
              />
            </>
          )}
        </section>

        <StickySummary
          title="Resumen"
          items={[
            { label: 'Estado', value: <AdminStatusBadge tone={payment.status === 'paid' ? 'success' : 'neutral'}>{paymentStatusLabel(payment.status)}</AdminStatusBadge> },
            { label: 'Banco', value: payment.bank_name_snapshot || '-' },
            { label: 'Alias', value: payment.bank_alias_snapshot || '-' },
            { label: 'Total comision', value: <MoneyCell value={payment.gross_commission} /> },
            { label: 'Ajustes positivos', value: <MoneyCell value={payment.adjustments} /> },
            { label: 'Descuentos y ajustes aplicados', value: <MoneyCell value={payment.discounts} /> },
            { label: payment.status === 'paid' ? 'Neto pagado' : 'Neto de liquidacion', value: <MoneyCell value={payment.net_paid} /> },
            { label: 'Nro.', value: payment.voucher_number || '-' }
          ]}
        >
          {payment.voucher_url && <a className="secondary-button" href={payment.voucher_url} target="_blank" rel="noreferrer">Ver comprobante</a>}
          {payment.status === 'paid' && whatsappUrl && <a className="primary-button" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Avisar por WhatsApp</a>}
        </StickySummary>
      </div>
    </div>
  )
}
