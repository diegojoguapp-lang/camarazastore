import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Landmark, Plus, Repeat, Search } from 'lucide-react'
import { AdminDataTable, AdminMetric, AdminModal, AdminPageHeader, DateCell, FilterToolbar, MoneyCell } from '../../components/AdminUX'
import { createAccountTransfer, createManualMovement, getFinancialAccounts, getFinancialDashboard, getFinancialMovements, saveFinancialAccount } from '../../lib/adminFinanceApi'
import { formatGs } from '../../lib/utils'

const emptyAccount = { name: '', account_type: 'cash', bank_name: '', account_number: '', account_holder: '', initial_balance: 0, is_cash_account: true, sort_order: 0 }
const emptyMovement = { account_id: '', direction: 'income', amount: '', description: '', movement_type: '', reference: '' }
const emptyTransfer = { from_account_id: '', to_account_id: '', amount: '', description: '' }

export function FinanceAdmin() {
  const [dashboard, setDashboard] = useState({})
  const [accounts, setAccounts] = useState([])
  const [movements, setMovements] = useState([])
  const [filters, setFilters] = useState({ search: '', account_id: '', direction: '' })
  const [accountForm, setAccountForm] = useState(emptyAccount)
  const [movementForm, setMovementForm] = useState(emptyMovement)
  const [transferForm, setTransferForm] = useState(emptyTransfer)
  const [modal, setModal] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      const [dashboardData, accountRows, movementRows] = await Promise.all([
        getFinancialDashboard().catch(() => ({})),
        getFinancialAccounts(),
        getFinancialMovements(filters)
      ])
      setDashboard(dashboardData || {})
      setAccounts(accountRows)
      setMovements(movementRows)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las finanzas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const activeAccounts = accounts.filter((account) => account.is_active)
  const totals = useMemo(() => ({
    money: accounts.filter((account) => account.is_active).reduce((sum, account) => sum + Number(account.current_balance || 0), 0)
  }), [accounts])

  const saveAccount = async (event) => {
    event.preventDefault()
    try {
      setError('')
      await saveFinancialAccount(accountForm)
      setAccountForm(emptyAccount)
      setModal('')
      setMessage('Cuenta guardada correctamente.')
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo guardar la cuenta.')
    }
  }

  const saveMovement = async (event) => {
    event.preventDefault()
    try {
      setError('')
      await createManualMovement(movementForm)
      setMovementForm(emptyMovement)
      setModal('')
      setMessage('Movimiento registrado.')
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo registrar el movimiento.')
    }
  }

  const saveTransfer = async (event) => {
    event.preventDefault()
    try {
      setError('')
      await createAccountTransfer(transferForm)
      setTransferForm(emptyTransfer)
      setModal('')
      setMessage('Transferencia registrada.')
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo registrar la transferencia.')
    }
  }

  const movementColumns = [
    { key: 'date', label: 'Fecha', render: (row) => <DateCell value={row.occurred_at} /> },
    { key: 'type', label: 'Tipo', render: (row) => row.movement_type },
    { key: 'description', label: 'Descripcion' },
    { key: 'account', label: 'Cuenta', render: (row) => row.account?.name || '-' },
    { key: 'income', label: 'Entrada', align: 'right', render: (row) => row.direction === 'income' ? <MoneyCell value={row.amount} /> : '-' },
    { key: 'expense', label: 'Salida', align: 'right', render: (row) => row.direction === 'expense' ? <MoneyCell value={row.amount} /> : '-' },
    { key: 'source', label: 'Origen', render: (row) => row.source_type }
  ]

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader eyebrow="Finanzas" title="Centro financiero" description="Cuentas, ledger y flujo de caja real." />
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <div className="ax-metric-grid">
        <AdminMetric label="Dinero actual" value={formatGs(totals.money || dashboard.money_current)} featured />
        <AdminMetric label="Ingresos del mes" value={<MoneyCell value={dashboard.month_income || 0} />} />
        <AdminMetric label="Egresos del mes" value={<MoneyCell value={dashboard.month_expense || 0} />} />
        <AdminMetric label="Ganancia neta mes" value={<MoneyCell value={dashboard.month_net_profit || 0} />} />
      </div>

      <section className="ax-panel">
        <h2>Cuentas</h2>
        <div className="ax-account-grid">
          {accounts.map((account) => (
            <div className="ax-account-card" key={account.id}>
              <strong>{account.name}</strong>
              <span>{account.account_type}</span>
              <b>{formatGs(account.current_balance)}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="ax-panel">
        <div className="ax-panel-header">
          <div>
            <h2>Operaciones</h2>
            <p>Registra movimientos solo cuando los necesites.</p>
          </div>
          <div className="ax-actions">
            <button className="primary-button" type="button" onClick={() => setModal('movement')}><Plus size={14} /> Movimiento</button>
            <button className="secondary-button" type="button" onClick={() => setModal('transfer')}><Repeat size={14} /> Transferir</button>
            <button className="secondary-button" type="button" onClick={() => setModal('account')}><Landmark size={14} /> Nueva cuenta</button>
          </div>
        </div>
      </section>

      <FilterToolbar>
        <label className="ax-search-field"><Search size={15} /><input placeholder="Buscar movimientos" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} /></label>
        <label>Cuenta<select value={filters.account_id} onChange={(e) => setFilters((p) => ({ ...p, account_id: e.target.value }))}><option value="">Todas</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        <label>Direccion<select value={filters.direction} onChange={(e) => setFilters((p) => ({ ...p, direction: e.target.value }))}><option value="">Todas</option><option value="income">Ingresos</option><option value="expense">Egresos</option></select></label>
        <button className="secondary-button" type="button" onClick={load}>Filtrar</button>
      </FilterToolbar>

      <AdminDataTable columns={movementColumns} rows={movements} loading={loading} empty="Todavia no hay movimientos financieros." />

      <AdminModal
        open={modal === 'movement'}
        title="Registrar movimiento"
        onClose={() => setModal('')}
        footer={(
          <>
            <button className="secondary-button" type="button" onClick={() => setModal('')}>Cancelar</button>
            <button className="primary-button" type="submit" form="finance-movement-form">{movementForm.direction === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />} Registrar movimiento</button>
          </>
        )}
      >
        <form id="finance-movement-form" className="ax-modal-form-grid" onSubmit={saveMovement}>
          <label>Cuenta<select value={movementForm.account_id} onChange={(e) => setMovementForm((p) => ({ ...p, account_id: e.target.value }))} required><option value="">Seleccionar</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label>Tipo<select value={movementForm.direction} onChange={(e) => setMovementForm((p) => ({ ...p, direction: e.target.value }))}><option value="income">Ingreso</option><option value="expense">Egreso</option></select></label>
          <label>Monto<input type="number" min="1" value={movementForm.amount} onChange={(e) => setMovementForm((p) => ({ ...p, amount: e.target.value }))} required /></label>
          <label>Descripcion<input value={movementForm.description} onChange={(e) => setMovementForm((p) => ({ ...p, description: e.target.value }))} required /></label>
        </form>
      </AdminModal>

      <AdminModal
        open={modal === 'transfer'}
        title="Transferir entre cuentas"
        onClose={() => setModal('')}
        footer={(
          <>
            <button className="secondary-button" type="button" onClick={() => setModal('')}>Cancelar</button>
            <button className="primary-button" type="submit" form="finance-transfer-form"><Repeat size={16} /> Transferir</button>
          </>
        )}
      >
        <form id="finance-transfer-form" className="ax-modal-form-grid" onSubmit={saveTransfer}>
          <label>Cuenta origen<select value={transferForm.from_account_id} onChange={(e) => setTransferForm((p) => ({ ...p, from_account_id: e.target.value }))} required><option value="">Seleccionar</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label>Cuenta destino<select value={transferForm.to_account_id} onChange={(e) => setTransferForm((p) => ({ ...p, to_account_id: e.target.value }))} required><option value="">Seleccionar</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label>Monto<input type="number" min="1" value={transferForm.amount} onChange={(e) => setTransferForm((p) => ({ ...p, amount: e.target.value }))} required /></label>
          <label>Descripcion opcional<input value={transferForm.description} onChange={(e) => setTransferForm((p) => ({ ...p, description: e.target.value }))} /></label>
          {transferForm.from_account_id && <div className="ax-readonly-field"><span>Saldo origen</span><strong>{formatGs(activeAccounts.find((account) => account.id === transferForm.from_account_id)?.current_balance || 0)}</strong></div>}
        </form>
      </AdminModal>

      <AdminModal
        open={modal === 'account'}
        title="Nueva cuenta financiera"
        onClose={() => setModal('')}
        footer={(
          <>
            <button className="secondary-button" type="button" onClick={() => setModal('')}>Cancelar</button>
            <button className="primary-button" type="submit" form="finance-account-form">Guardar cuenta</button>
          </>
        )}
      >
        <form id="finance-account-form" className="ax-modal-form-grid" onSubmit={saveAccount}>
          <label>Nombre<input value={accountForm.name} onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))} required /></label>
          <label>Tipo<select value={accountForm.account_type} onChange={(e) => setAccountForm((p) => ({ ...p, account_type: e.target.value, is_cash_account: e.target.value === 'cash' }))}><option value="cash">Caja efectivo</option><option value="bank">Banco</option><option value="wallet">Billetera</option><option value="other">Otra</option></select></label>
          <label>Saldo inicial<input type="number" min="0" value={accountForm.initial_balance} onChange={(e) => setAccountForm((p) => ({ ...p, initial_balance: e.target.value }))} /></label>
          <label>Banco<input value={accountForm.bank_name} onChange={(e) => setAccountForm((p) => ({ ...p, bank_name: e.target.value }))} /></label>
        </form>
      </AdminModal>
    </div>
  )
}
