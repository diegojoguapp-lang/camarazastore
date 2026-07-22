import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Search } from 'lucide-react'
import { getCustomers } from '../../lib/customerApi'
import { getAdminSales } from '../../lib/adminSalesApi'
import { formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'

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

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Clientes</h1>
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
      <form className="form-section admin-filter-form" onSubmit={submit}>
        <label>Buscar por nombre o telefono<input value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <button className="primary-button" type="submit"><Search size={16} /> Buscar</button>
      </form>

      <div className="table-wrap">
        {loading && <p className="table-loading">Cargando clientes...</p>}
        {!loading && (
          <table className="admin-table customers-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Telefono</th>
                <th>Ciudad</th>
                <th>Compras</th>
                <th>Total comprado</th>
                <th>Ultima compra</th>
                <th>Fallidas</th>
                <th>Pago adelantado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const item = metrics.get(customer.id) || {}
                return (
                  <tr key={customer.id}>
                    <td>{customer.full_name}</td>
                    <td>{customer.phone}</td>
                    <td>{customer.city || '-'}</td>
                    <td>{item.total || 0}</td>
                    <td>{formatGs(item.amount || 0)}</td>
                    <td>{formatDatePy(item.last)}</td>
                    <td>{item.failed || 0}</td>
                    <td>{customer.requires_advance_payment ? 'Si' : 'No'}</td>
                    <td><Link className="icon-link" to={`/admin/clientes/${customer.id}`}><Eye size={14} /></Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {!loading && !customers.length && <div className="empty-state">Todavia no hay clientes cargados.</div>}
      </div>
    </div>
  )
}
