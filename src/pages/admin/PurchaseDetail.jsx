import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { AdminDataTable, AdminPageHeader, DateCell, MoneyCell, StickySummary } from '../../components/AdminUX'
import { getFinancialAccounts } from '../../lib/adminFinanceApi'
import { confirmPurchase, getPurchase } from '../../lib/adminPurchasesApi'

export function PurchaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [purchase, setPurchase] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [registerPayment, setRegisterPayment] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const [purchaseData, accountRows] = await Promise.all([getPurchase(id), getFinancialAccounts()])
      setPurchase(purchaseData)
      setAccounts(accountRows.filter((account) => account.is_active))
    } catch (err) {
      setError(err.message || 'No se pudo cargar la compra.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const submitConfirm = async (event) => {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      await confirmPurchase({ purchase_id: id, register_payment: registerPayment, financial_account_id: accountId })
      setMessage('Compra confirmada. Stock actualizado.')
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo confirmar la compra.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="admin-page ax-page"><p>Cargando...</p></div>
  if (!purchase) return <div className="admin-page ax-page"><div className="error-box">Compra no encontrada.</div></div>

  const columns = [
    { key: 'product', label: 'Producto', render: (row) => row.product_name_snapshot },
    { key: 'quantity', label: 'Cantidad', align: 'right' },
    { key: 'cost', label: 'Costo unitario', align: 'right', render: (row) => <MoneyCell value={row.unit_cost} /> },
    { key: 'total', label: 'Subtotal', align: 'right', render: (row) => <MoneyCell value={row.line_total} /> }
  ]

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader
        eyebrow="Compra"
        title={purchase.supplier?.name || 'Sin proveedor'}
        description={`${purchase.status} - ${purchase.purchase_date}`}
        actions={<Link className="secondary-button" to="/admin/compras"><ArrowLeft size={16} /> Volver</Link>}
      />
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}
      {purchase.status === 'confirmed' && !purchase.payment_registered && <div className="warning-box">Pago no registrado en finanzas.</div>}

      <div className="ax-detail-layout">
        <section className="ax-panel">
          <h2>Items</h2>
          <AdminDataTable columns={columns} rows={purchase.items || []} loading={false} empty="Sin items." />
        </section>
        <StickySummary
          title="Resumen"
          items={[
            { label: 'Fecha', value: <DateCell value={purchase.purchase_date} /> },
            { label: 'Estado', value: purchase.status },
            { label: 'Total', value: <MoneyCell value={purchase.total_amount} /> },
            { label: 'Pago', value: purchase.payment_registered ? purchase.account?.name || 'Registrado' : 'No registrado' }
          ]}
        >
          {purchase.status === 'draft' ? (
            <form className="ax-drawer-form" onSubmit={submitConfirm}>
              <label className="checkbox-label"><input type="checkbox" checked={registerPayment} onChange={(e) => setRegisterPayment(e.target.checked)} /> Registrar tambien el pago</label>
              {registerPayment && (
                <label>Cuenta
                  <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                    <option value="">Seleccionar cuenta</option>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                </label>
              )}
              <button className="primary-button" type="submit" disabled={saving}><CheckCircle2 size={16} /> {saving ? 'Confirmando...' : 'Confirmar compra'}</button>
            </form>
          ) : (
            <button className="secondary-button" type="button" onClick={() => navigate('/admin/compras')}>Volver a compras</button>
          )}
        </StickySummary>
      </div>
    </div>
  )
}
