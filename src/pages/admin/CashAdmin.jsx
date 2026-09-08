import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminDataTable, AdminMetric, AdminPageHeader, DateCell, MoneyCell } from '../../components/AdminUX'
import { closeCashSession, getCashSessions, openCashSession } from '../../lib/adminFinanceApi'
import { operationRpc } from '../../lib/operationApi'
import { businessDate } from '../../lib/operationDates'
import { formatDatePy } from '../../lib/dateUtils'

const emptyForm = { financial_account_id: '', counted_balance: '', register_difference: false, notes: '' }

export function CashAdmin() {
  const [accounts, setAccounts] = useState([])
  const [sessions, setSessions] = useState([])
  const [dayAccounts, setDayAccounts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [closeForm, setCloseForm] = useState({ counted_balance: '', register_difference: false, notes: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      const [accountRows, sessionRows] = await Promise.all([
        operationRpc('admin_cash_day_v2', { p_day: businessDate() }),
        getCashSessions()
      ])
      setAccounts(accountRows.filter((account) => account.is_active && account.is_cash_account))
      setSessions(sessionRows)
      setDayAccounts(accountRows)
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
  const cashDay = dayAccounts.filter((a) => a.is_cash_account && (!openSession || a.id === openSession.financial_account_id))
  const income = cashDay.reduce((sum, a) => sum + Number(a.day_income), 0)
  const expense = cashDay.reduce((sum, a) => sum + Number(a.day_expense), 0)

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
      <AdminPageHeader eyebrow="Finanzas" title={`Caja diaria · ${formatDatePy(businessDate())}`} />
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <div className="ax-metric-grid">
        <AdminMetric label="Estado" value={openSession ? 'Abierta' : 'Cerrada'} featured />
        <AdminMetric label="Saldo inicial del dia" value={<MoneyCell value={cashDay.reduce((sum, a) => sum + Number(a.day_opening_balance || 0), 0)} />} />
        <AdminMetric label="Ingresos del dia" value={<MoneyCell value={income} />} />
        <AdminMetric label="Egresos del dia" value={<MoneyCell value={expense} />} />
        <AdminMetric label="Movimientos" value={cashDay.reduce((sum, a) => sum + Number(a.day_count), 0)} />
      </div>

      <section className="ax-panel">
        <h2>{openSession ? 'Cerrar caja' : 'Abrir caja'}</h2>
        {!accounts.length && !openSession ? (
          <div className="ax-empty-state-pro">
            <strong>Todavia no configuraste una cuenta de efectivo.</strong>
            <p>Crea una cuenta financiera de tipo Caja/Efectivo para comenzar a utilizar Caja diaria.</p>
            <Link className="primary-button" to="/admin/finanzas">Crear cuenta</Link>
          </div>
        ) : !openSession ? (
          <form className="cash-session-card cash-session-card-pro" onSubmit={submitOpen}>
            <label>Cuenta de caja<select value={form.financial_account_id} onChange={(e) => setForm((p) => ({ ...p, financial_account_id: e.target.value }))} required><option value="">Seleccionar</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            <div className="cash-readout"><span>Saldo esperado</span><strong><MoneyCell value={expectedOpenBalance} /></strong></div>
            <label>Efectivo contado<input type="number" min="0" value={form.counted_balance} onChange={(e) => setForm((p) => ({ ...p, counted_balance: e.target.value }))} required /></label>
            <div className={`cash-readout ${Number(openDifference || 0) < 0 ? 'negative' : ''}`}><span>Diferencia</span><strong>{openDifference === null ? '-' : <MoneyCell value={openDifference} />}</strong></div>
            <label className="checkbox-label"><input type="checkbox" checked={form.register_difference} onChange={(e) => setForm((p) => ({ ...p, register_difference: e.target.checked }))} /> Registrar diferencia como ajuste</label>
            <button className="primary-button" type="submit">Abrir caja</button>
          </form>
        ) : (
          <form className="cash-session-card cash-session-card-pro" onSubmit={submitClose}>
            <div className="ax-readonly-field"><span>Cuenta abierta</span><strong>{openSession.account?.name}</strong></div>
            <div className="cash-readout"><span>Saldo esperado</span><strong><MoneyCell value={expectedCloseBalance} /></strong></div>
            <label>Efectivo contado<input type="number" min="0" value={closeForm.counted_balance} onChange={(e) => setCloseForm((p) => ({ ...p, counted_balance: e.target.value }))} required /></label>
            <div className={`cash-readout ${Number(closeDifference || 0) < 0 ? 'negative' : ''}`}><span>Diferencia</span><strong>{closeDifference === null ? '-' : <MoneyCell value={closeDifference} />}</strong></div>
            <label className="checkbox-label"><input type="checkbox" checked={closeForm.register_difference} onChange={(e) => setCloseForm((p) => ({ ...p, register_difference: e.target.checked }))} /> Registrar diferencia como ajuste</label>
            <button className="primary-button" type="submit">Cerrar caja</button>
          </form>
        )}
      </section>

      <section className="ax-panel"><h2>Bancos · saldo continuo</h2>
        <div className="ax-account-grid">{dayAccounts.filter((a) => a.account_type === 'bank').map((a) => <article className="ax-account-card" key={a.id}><h3>{a.name}</h3><strong>Saldo actual: <MoneyCell value={a.current_balance} /></strong><span>Recibido hoy: <MoneyCell value={a.day_income} /></span><span>Egresos hoy: <MoneyCell value={a.day_expense} /></span></article>)}</div>
        {!loading && !dayAccounts.some((a) => a.account_type === 'bank') && <p>Sin cuentas bancarias activas.</p>}
      </section>
      <AdminDataTable columns={columns} rows={sessions} loading={loading} empty="Todavia no hay sesiones de caja." />
    </div>
  )
}
