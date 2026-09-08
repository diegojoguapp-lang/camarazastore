import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Landmark, Plus, Repeat, Search } from 'lucide-react'
import { AdminDataTable, AdminMetric, AdminModal, AdminPageHeader, DateCell, FilterToolbar, MoneyCell } from '../../components/AdminUX'
import { createAccountTransfer, createManualMovement, getFinancialAccounts, getFinancialDashboard, getFinancialMovements, saveFinancialAccount } from '../../lib/adminFinanceApi'
import { formatGs } from '../../lib/utils'
import { getCollectionSettings, operationRpc } from '../../lib/operationApi'

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
  const [defaults, setDefaults] = useState({})
  const [busy, setBusy] = useState(false)
  const [accountAction, setAccountAction] = useState(null)
  const [accountScope, setAccountScope] = useState('active')

  const load = async () => {
    try {
      setLoading(true)
      const [dashboardData, accountRows, movementRows, settings] = await Promise.all([
        getFinancialDashboard().catch(() => ({})),
        getFinancialAccounts(),
        getFinancialMovements(filters), getCollectionSettings()
      ])
      setDashboard(dashboardData || {})
      setAccounts(accountRows)
      setMovements(movementRows)
      setDefaults(settings)
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
      setBusy(true)
      if (accountForm.id) await operationRpc('admin_manage_account_v2', { p_id: accountForm.id, p_action: 'edit', p_name: accountForm.name, p_bank_name: accountForm.bank_name || null })
      else await saveFinancialAccount(accountForm)
      setAccountForm(emptyAccount)
      setModal('')
      setMessage('Cuenta guardada correctamente.')
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo guardar la cuenta.')
    } finally { setBusy(false) }
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
        <AdminMetric label="Dinero actual" value={formatGs(totals.money)} featured />
        <AdminMetric label="Ingresos del mes" value={<MoneyCell value={dashboard.month_income || 0} />} />
        <AdminMetric label="Egresos del mes" value={<MoneyCell value={dashboard.month_expense || 0} />} />
        <AdminMetric label="Ganancia neta mes" value={<MoneyCell value={dashboard.month_net_profit || 0} />} />
      </div>

      <section className="ax-panel">
        <h2>Cuentas</h2>
        <label>Mostrar<select value={accountScope} onChange={(e) => setAccountScope(e.target.value)}><option value="active">Activas</option><option value="archived">Archivadas</option><option value="all">Todas</option></select></label>
        <div className="ax-account-grid">
          {accounts.filter((a) => accountScope === 'all' || (accountScope === 'active' ? a.is_active : !a.is_active)).map((account) => (
            <div className="ax-account-card" key={account.id}>
              <strong>{account.name}</strong>
              <span>{account.account_type}</span>
              <b>{formatGs(account.current_balance)}</b>
              <span>{account.is_active ? 'Activa' : 'Archivada'}</span>
              <div className="ax-actions">
                <button className="secondary-button" onClick={() => { setAccountForm({ ...emptyAccount, ...account }); setModal('account') }}>Editar</button>
                <button className="secondary-button" onClick={() => setAccountAction({ account, action: account.is_active ? 'archive' : 'restore' })}>{account.is_active ? 'Archivar' : 'Restaurar'}</button>
                {Number(account.movement_count) === 0 && <button className="secondary-button" onClick={() => setAccountAction({ account, action: 'delete' })}>Eliminar</button>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="ax-panel">
        <h2>Cuentas predeterminadas de cobro</h2>
        <form className="form-grid" onSubmit={async (event) => {
          event.preventDefault(); setBusy(true); setError('')
          try { await operationRpc('admin_set_collection_defaults', { p_cash_id: defaults.default_cash_account_id || null, p_transfer_id: defaults.default_transfer_account_id || null }); setMessage('Cuentas predeterminadas guardadas.') }
          catch (err) { setError(err.message) } finally { setBusy(false) }
        }}>
          {[['default_cash_account_id', 'Efectivo', 'cash'], ['default_transfer_account_id', 'Transferencia', 'bank']].map(([field, label, type]) => <label key={field}>{label}<select value={defaults[field] || ''} onChange={(e) => setDefaults((prev) => ({ ...prev, [field]: e.target.value }))}><option value="">Sin predeterminada</option>{activeAccounts.filter((a) => a.account_type === type).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>)}
          <button className="primary-button" disabled={busy}>Guardar predeterminadas</button>
        </form>
      </section>
      <AdminModal open={Boolean(accountAction)} title={accountAction ? `${({ archive: 'Archivar', restore: 'Restaurar', delete: 'Eliminar' })[accountAction.action]} cuenta` : ''} onClose={() => !busy && setAccountAction(null)} footer={<button className="primary-button" disabled={busy} onClick={async () => {
        setBusy(true); setError('')
        try { await operationRpc('admin_manage_account_v2', { p_id: accountAction.account.id, p_action: accountAction.action }); setAccountAction(null); setMessage('Cuenta actualizada.'); await load() }
        catch (err) { setError(err.message) } finally { setBusy(false) }
      }}>{busy ? 'Guardando...' : 'Confirmar'}</button>}>
        <p>{accountAction?.account.name}</p>
        {accountAction?.action === 'archive' && <p>El historial se conserva. Saldo actual: {formatGs(accountAction.account.current_balance)}. No se podra usar para nuevos cobros.</p>}
        {accountAction?.action === 'delete' && <p>Solo se elimina si no tiene operaciones ni relaciones registradas.</p>}
        {error && <div className="error-box" role="alert">{error}</div>}
      </AdminModal>
      <section className="ax-panel">
        <div className="ax-panel-header">
          <div>
            <h2>Operaciones</h2>
            <p>Registra movimientos solo cuando los necesites.</p>
          </div>
          <div className="ax-actions">
            <button className="primary-button" type="button" onClick={() => setModal('movement')}><Plus size={14} /> Movimiento</button>
            <button className="secondary-button" type="button" onClick={() => setModal('transfer')}><Repeat size={14} /> Transferir</button>
            <button className="secondary-button" type="button" onClick={() => { setAccountForm(emptyAccount); setModal('account') }}><Landmark size={14} /> Nueva cuenta</button>
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
        title={accountForm.id ? 'Editar cuenta' : 'Nueva cuenta financiera'}
        onClose={() => setModal('')}
        footer={(
          <>
            <button className="secondary-button" type="button" onClick={() => setModal('')}>Cancelar</button>
            <button className="primary-button" disabled={busy} type="submit" form="finance-account-form">Guardar cuenta</button>
          </>
        )}
      >
        <form id="finance-account-form" className="ax-modal-form-grid" onSubmit={saveAccount}>
          <label>Nombre<input value={accountForm.name} onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))} required /></label>
          <label>Tipo<select disabled={Boolean(accountForm.id)} value={accountForm.account_type} onChange={(e) => setAccountForm((p) => ({ ...p, account_type: e.target.value, is_cash_account: e.target.value === 'cash' }))}><option value="cash">Caja efectivo</option><option value="bank">Banco</option><option value="wallet">Billetera</option><option value="other">Otra</option></select></label>
          <label>Saldo inicial<input disabled={Boolean(accountForm.id)} type="number" min="0" value={accountForm.initial_balance} onChange={(e) => setAccountForm((p) => ({ ...p, initial_balance: e.target.value }))} /></label>
          <label>Banco<input value={accountForm.bank_name} onChange={(e) => setAccountForm((p) => ({ ...p, bank_name: e.target.value }))} /></label>
        </form>
      </AdminModal>
    </div>
  )
}
