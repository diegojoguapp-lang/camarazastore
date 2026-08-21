import { useEffect, useMemo, useState } from 'react'
import { AdminDataTable, AdminMetric, AdminPageHeader, DateCell, MoneyCell } from '../../components/AdminUX'
import { closeCashSession, getCashSessions, getFinancialAccounts, getFinancialMovements, openCashSession } from '../../lib/adminFinanceApi'

const emptyForm = { financial_account_id: '', counted_balance: '', register_difference: false, notes: '' }

export function CashAdmin() {
  const [accounts, setAccounts] = useState([])
  const [sessions, setSessions] = useState([])
  const [movements, setMovements] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [closeForm, setCloseForm] = useState({ counted_balance: '', register_difference: false, notes: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      const [accountRows, sessionRows, movementRows] = await Promise.all([
        getFinancialAccounts(),
        getCashSessions(),
        getFinancialMovements({})
      ])
      setAccounts(accountRows.filter((account) => account.is_active && account.is_cash_account))
      setSessions(sessionRows)
      setMovements(movementRows)
    } catch (err) {
      setError(err.message || 'No se pudo cargar caja.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openSession = sessions.find((session) => session.status === 'open')
  const selectedOpenAccount = accounts.find((account) => account.id === form.financial_account_id)
  const expectedOpenBalance = Number(selectedOpenAccount?.current_balance || 0)
  const countedOpenBalance = Number(form.counted_balance || 0)
  const openDifference = form.counted_balance === '' ? null : countedOpenBalance - expectedOpenBalance
  const expectedCloseBalance = Number(openSession?.account?.current_balance ?? openSession?.expected_closing_balance ?? 0)
  const countedCloseBalance = Number(closeForm.counted_balance || 0)
  const closeDifference = closeForm.counted_balance === '' ? null : countedCloseBalance - expectedCloseBalance
  const todayMovements = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return movements.filter((row) => row.occurred_at?.slice(0, 10) === today && (!openSession || row.account_id === openSession.financial_account_id))
  }, [movements, openSession])
  const income = todayMovements.filter((row) => row.direction === 'income').reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const expense = todayMovements.filter((row) => row.direction === 'expense').reduce((sum, row) => sum + Number(row.amount || 0), 0)

  const submitOpen = async (event) => {
    event.preventDefault()
    try {
      setError('')
      await openCashSession(form)
      setForm(emptyForm)
      setMessage('Caja abierta.')
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo abrir la caja.')
    }
  }

  const submitClose = async (event) => {
    event.preventDefault()
    try {
      setError('')
      await closeCashSession({ ...closeForm, session_id: openSession.id })
      setCloseForm({ counted_balance: '', register_difference: false, notes: '' })
      setMessage('Caja cerrada.')
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo cerrar la caja.')
    }
  }

  const columns = [
    { key: 'opened', label: 'Apertura', render: (row) => <DateCell value={row.opened_at} /> },
    { key: 'account', label: 'Cuenta', render: (row) => row.account?.name || '-' },
    { key: 'opening', label: 'Diferencia apertura', align: 'right', render: (row) => <MoneyCell value={row.opening_difference} /> },
    { key: 'closing', label: 'Diferencia cierre', align: 'right', render: (row) => row.status === 'closed' ? <MoneyCell value={row.closing_difference} /> : '-' },
    { key: 'status', label: 'Estado', render: (row) => row.status }
  ]

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader eyebrow="Finanzas" title="Caja diaria" description="Apertura, cierre y control de efectivo." />
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <div className="ax-metric-grid">
        <AdminMetric label="Estado" value={openSession ? 'Abierta' : 'Cerrada'} featured />
        <AdminMetric label="Ingresos del dia" value={<MoneyCell value={income} />} />
        <AdminMetric label="Egresos del dia" value={<MoneyCell value={expense} />} />
        <AdminMetric label="Movimientos" value={todayMovements.length} />
      </div>

      <section className="ax-panel">
        <h2>{openSession ? 'Cerrar caja' : 'Abrir caja'}</h2>
        {!openSession ? (
          <form className="cash-session-card" onSubmit={submitOpen}>
            <label>Cuenta de caja<select value={form.financial_account_id} onChange={(e) => setForm((p) => ({ ...p, financial_account_id: e.target.value }))} required><option value="">Seleccionar</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            <div className="cash-readout"><span>Saldo esperado</span><strong><MoneyCell value={expectedOpenBalance} /></strong></div>
            <label>Efectivo contado<input type="number" min="0" value={form.counted_balance} onChange={(e) => setForm((p) => ({ ...p, counted_balance: e.target.value }))} required /></label>
            <div className={`cash-readout ${Number(openDifference || 0) < 0 ? 'negative' : ''}`}><span>Diferencia</span><strong>{openDifference === null ? '-' : <MoneyCell value={openDifference} />}</strong></div>
            <label className="checkbox-label"><input type="checkbox" checked={form.register_difference} onChange={(e) => setForm((p) => ({ ...p, register_difference: e.target.checked }))} /> Registrar diferencia como ajuste</label>
            <button className="primary-button" type="submit">Abrir caja</button>
          </form>
        ) : (
          <form className="cash-session-card" onSubmit={submitClose}>
            <div className="ax-readonly-field"><span>Cuenta abierta</span><strong>{openSession.account?.name}</strong></div>
            <div className="cash-readout"><span>Saldo esperado</span><strong><MoneyCell value={expectedCloseBalance} /></strong></div>
            <label>Efectivo contado<input type="number" min="0" value={closeForm.counted_balance} onChange={(e) => setCloseForm((p) => ({ ...p, counted_balance: e.target.value }))} required /></label>
            <div className={`cash-readout ${Number(closeDifference || 0) < 0 ? 'negative' : ''}`}><span>Diferencia</span><strong>{closeDifference === null ? '-' : <MoneyCell value={closeDifference} />}</strong></div>
            <label className="checkbox-label"><input type="checkbox" checked={closeForm.register_difference} onChange={(e) => setCloseForm((p) => ({ ...p, register_difference: e.target.checked }))} /> Registrar diferencia como ajuste</label>
            <button className="primary-button" type="submit">Cerrar caja</button>
          </form>
        )}
      </section>

      <AdminDataTable columns={columns} rows={sessions} loading={loading} empty="Todavia no hay sesiones de caja." />
    </div>
  )
}
