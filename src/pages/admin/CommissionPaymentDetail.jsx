import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { AdminDataTable, AdminPageHeader, AdminStatusBadge, DateCell, MoneyCell, StickySummary } from '../../components/AdminUX'
import { getCommissionPayment, getPaymentAdjustments, getPaymentItems } from '../../lib/adminCommissionsApi'
import { paymentStatusLabel } from '../../lib/commissionConstants'
import { formatDatePy } from '../../lib/dateUtils'

export function CommissionPaymentDetail() {
  const { id } = useParams()
  const [payment, setPayment] = useState(null)
  const [items, setItems] = useState([])
  const [adjustments, setAdjustments] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [paymentData, itemRows, adjustmentRows] = await Promise.all([getCommissionPayment(id), getPaymentItems(id), getPaymentAdjustments(id)])
        setPayment(paymentData)
        setItems(itemRows)
        setAdjustments(adjustmentRows)
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

      <div className="ax-detail-layout">
        <section className="ax-panel">
          <h2>Ventas pagadas</h2>
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
            { label: 'Neto pagado', value: <MoneyCell value={payment.net_paid} /> },
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
