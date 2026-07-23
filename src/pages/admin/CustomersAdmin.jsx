import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Search } from 'lucide-react'
import { AdminDataTable, AdminMetric, AdminPageHeader, AdminStatusBadge, FilterToolbar, MoneyCell, RowActions } from '../../components/AdminUX'
import { getCustomers } from '../../lib/customerApi'
import { getAdminSales } from '../../lib/adminSalesApi'
import { formatDatePy } from '../../lib/dateUtils'

export function CustomersAdmin() {
  const [customers, setCustomers] = useState([])
  const [sales, setSales] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const metrics = useMemo(() => {
    const map = new Map()
    sales.forEach((sale) => {
      const current = map.get(sale.customer_id) || { total: 0, amount: 0, last: '', failed: 0 }
      current.total += sale.status === 'delivered_paid' ? 1 : 0
      current.amount += sale.status === 'delivered_paid' ? Number(sale.total_collected || 0) : 0
      current.failed += sale.status === 'failed_delivery' ? 1 : 0
      current.last = !current.last || new Date(sale.created_at) > new Date(current.last) ? sale.created_at : current.last
      map.set(sale.customer_id, current)
    })
    return map
  }, [sales])

  const summary = useMemo(() => customers.reduce((acc, customer) => {
    const item = metrics.get(customer.id) || {}
    acc.delivered += item.total || 0
    acc.amount += item.amount || 0
    acc.advance += customer.requires_advance_payment ? 1 : 0
    return acc
  }, { delivered: 0, amount: 0, advance: 0 }), [customers, metrics])

  const load = async (term = search) => {
    try {
      setLoading(true)
      setError('')
      const [customerRows, saleRows] = await Promise.all([getCustomers(term), getAdminSales()])
      setCustomers(customerRows)
      setSales(saleRows)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los clientes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load('') }, [])

  const submit = (event) => {
    event.preventDefault()
    load(search)
  }

  const columns = [
    { key: 'full_name', label: 'Cliente', render: (customer) => <Link className="ax-inline-link" to={`/admin/clientes/${customer.id}`}>{customer.full_name}</Link> },
    { key: 'phone', label: 'Telefono' },
    { key: 'city', label: 'Ciudad', render: (customer) => customer.city || '-' },
    { key: 'total', label: 'Compras', align: 'right', render: (customer) => metrics.get(customer.id)?.total || 0 },
    { key: 'amount', label: 'Total comprado', align: 'right', render: (customer) => <MoneyCell value={metrics.get(customer.id)?.amount || 0} /> },
    { key: 'last', label: 'Ultima compra', render: (customer) => formatDatePy(metrics.get(customer.id)?.last) },
    { key: 'failed', label: 'Fallidas', align: 'right', render: (customer) => metrics.get(customer.id)?.failed || 0 },
    { key: 'advance', label: 'Pago adelantado', render: (customer) => customer.requires_advance_payment ? <AdminStatusBadge tone="warning">Si</AdminStatusBadge> : <AdminStatusBadge>No</AdminStatusBadge> },
    { key: 'actions', label: 'Acciones', render: (customer) => <RowActions><Link to={`/admin/clientes/${customer.id}`}><Eye size={14} /> Ver</Link></RowActions> }
  ]

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader
        eyebrow="Admin"
        title="Clientes"
        description="Historial de compradores y datos utiles para seguimiento."
      />
      {error && <div className="error-box">{error}</div>}

      <div className="ax-metric-grid">
        <AdminMetric label="Clientes" value={customers.length} />
        <AdminMetric label="Compras entregadas" value={summary.delivered} />
        <AdminMetric label="Total comprado" value={<MoneyCell value={summary.amount} />} featured />
        <AdminMetric label="Pago adelantado" value={summary.advance} />
      </div>

      <form onSubmit={submit}>
        <FilterToolbar actions={<button className="primary-button" type="submit"><Search size={16} /> Buscar</button>}>
          <label className="ax-search-field">
            <Search size={16} aria-hidden="true" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o telefono" />
          </label>
        </FilterToolbar>
      </form>

      <AdminDataTable
        columns={columns}
        rows={customers}
        loading={loading}
        empty="Todavia no hay clientes cargados."
      />
    </div>
  )
}
