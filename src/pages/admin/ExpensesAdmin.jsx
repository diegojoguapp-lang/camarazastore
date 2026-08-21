import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { AdminDataTable, AdminMetric, AdminPageHeader, DateCell, FilterToolbar, MoneyCell, RowActions } from '../../components/AdminUX'
import { getFinancialAccounts } from '../../lib/adminFinanceApi'
import { createExpense, getExpenseCategories, getExpenses } from '../../lib/adminExpensesApi'

const emptyForm = { category_id: '', account_id: '', description: '', amount: '', expense_date: new Date().toISOString().slice(0, 10), notes: '' }

export function ExpensesAdmin() {
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '', category_id: '' })
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      const [expenseRows, categoryRows, accountRows] = await Promise.all([
        getExpenses(filters),
        getExpenseCategories(),
        getFinancialAccounts()
      ])
      setExpenses(expenseRows)
      setCategories(categoryRows)
      setAccounts(accountRows.filter((account) => account.is_active))
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los gastos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const summary = useMemo(() => ({
    total: expenses.filter((item) => item.status === 'confirmed').reduce((sum, item) => sum + Number(item.amount || 0), 0),
    count: expenses.filter((item) => item.status === 'confirmed').length,
    cancelled: expenses.filter((item) => item.status === 'cancelled').length
  }), [expenses])

  const submit = async (event) => {
    event.preventDefault()
    try {
      setError('')
      await createExpense(form)
      setForm(emptyForm)
      setMessage('Gasto registrado correctamente.')
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo registrar el gasto.')
    }
  }

  const columns = [
    { key: 'date', label: 'Fecha', render: (row) => <DateCell value={row.expense_date} /> },
    { key: 'category', label: 'Categoria', render: (row) => row.category?.name || '-' },
    { key: 'description', label: 'Descripcion' },
    { key: 'account', label: 'Cuenta', render: (row) => row.account?.name || '-' },
    { key: 'amount', label: 'Monto', align: 'right', render: (row) => <MoneyCell value={row.amount} /> },
    { key: 'status', label: 'Estado', render: (row) => row.status },
    { key: 'actions', label: 'Acciones', render: () => <RowActions><span>No borrar</span></RowActions> }
  ]

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader eyebrow="Finanzas" title="Gastos" description="Gastos confirmados con movimiento financiero transaccional." />
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <div className="ax-metric-grid">
        <AdminMetric label="Gastos confirmados" value={summary.count} />
        <AdminMetric label="Total gastos" value={<MoneyCell value={summary.total} />} featured />
        <AdminMetric label="Anulados" value={summary.cancelled} />
      </div>

      <section className="ax-panel">
        <h2>Nuevo gasto</h2>
        <form className="expense-form-pro" onSubmit={submit}>
          <label>Categoria<select value={form.category_id} onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))} required><option value="">Seleccionar</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Cuenta<select value={form.account_id} onChange={(e) => setForm((p) => ({ ...p, account_id: e.target.value }))} required><option value="">Seleccionar</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Monto<input type="number" min="1" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required /></label>
          <label>Descripcion<input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} required /></label>
          <label>Fecha<input type="date" value={form.expense_date} onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))} /></label>
          <label className="expense-note-field">Nota<textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows="3" /></label>
          <div className="expense-actions"><button className="primary-button" type="submit">Guardar gasto</button></div>
        </form>
      </section>

      <FilterToolbar>
        <label className="ax-search-field"><Search size={15} /><input placeholder="Buscar gastos" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} /></label>
        <label>Categoria<select value={filters.category_id} onChange={(e) => setFilters((p) => ({ ...p, category_id: e.target.value }))}><option value="">Todas</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Estado<select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}><option value="">Todos</option><option value="confirmed">Confirmados</option><option value="cancelled">Anulados</option></select></label>
        <button className="secondary-button" type="button" onClick={load}>Filtrar</button>
      </FilterToolbar>

      <AdminDataTable columns={columns} rows={expenses} loading={loading} empty="Todavia no hay gastos." />
    </div>
  )
}
