import { useEffect, useMemo, useState } from 'react'
import { AdminDataTable, AdminMetric, AdminPageHeader, MoneyCell } from '../../components/AdminUX'
import { getAdminReports } from '../../lib/adminReportsApi'

export function ReportsAdmin() {
  const [filters, setFilters] = useState({
    date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    date_to: new Date().toISOString().slice(0, 10)
  })
  const [data, setData] = useState({ sales: [], items: [], payments: [], movements: [], products: [] })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      setData(await getAdminReports(filters))
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los reportes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const summary = useMemo(() => {
    const revenue = data.sales.reduce((sum, sale) => sum + Number(sale.total_collected || 0), 0)
    const profit = data.sales.reduce((sum, sale) => sum + Number(sale.camaraza_net_profit || 0), 0)
    const expenses = data.movements.filter((row) => row.direction === 'expense' && !['transfer_out', 'purchase_payment', 'commission_payment'].includes(row.movement_type)).reduce((sum, row) => sum + Number(row.amount || 0), 0)
    const income = data.movements.filter((row) => row.direction === 'income' && !['transfer_in', 'opening_balance'].includes(row.movement_type)).reduce((sum, row) => sum + Number(row.amount || 0), 0)
    const expenseFlow = data.movements.filter((row) => row.direction === 'expense' && row.movement_type !== 'transfer_out').reduce((sum, row) => sum + Number(row.amount || 0), 0)
    return { revenue, profit, expenses, income, expenseFlow, netProfit: profit - expenses, avgTicket: data.sales.length ? revenue / data.sales.length : 0 }
  }, [data])

  const byType = useMemo(() => ['direct', 'reseller'].map((type) => {
    const rows = data.sales.filter((sale) => sale.sale_type === type)
    return {
      type: type === 'direct' ? 'Cliente final' : 'Revendedores',
      sales: rows.length,
      revenue: rows.reduce((sum, sale) => sum + Number(sale.total_collected || 0), 0),
      profit: rows.reduce((sum, sale) => sum + Number(sale.camaraza_net_profit || 0), 0),
      commissions: rows.reduce((sum, sale) => sum + Number(sale.reseller_commission || 0), 0)
    }
  }), [data])

  const productRanking = useMemo(() => {
    const map = new Map()
    data.items.forEach((item) => {
      const current = map.get(item.product_id) || { product: item.product_name_snapshot, units: 0, revenue: 0, profit: 0, stock: data.products.find((p) => p.id === item.product_id)?.stock_quantity || 0 }
      current.units += Number(item.quantity || 0)
      current.revenue += Number(item.line_subtotal || 0)
      current.profit += Number(item.line_subtotal || 0) - Number(item.line_cost_total || 0) - Number(item.line_commission_total || 0)
      map.set(item.product_id, current)
    })
    return Array.from(map.values()).sort((a, b) => b.units - a.units).slice(0, 20)
  }, [data])

  const resellerRanking = useMemo(() => {
    const map = new Map()
    data.sales.filter((sale) => sale.sale_type === 'reseller').forEach((sale) => {
      const key = sale.reseller?.id || sale.reseller_id
      const current = map.get(key) || { reseller: `${sale.reseller?.reseller_code || ''} ${sale.reseller?.full_name || 'Revendedor'}`, sales: 0, revenue: 0, commission: 0, paid: 0 }
      current.sales += 1
      current.revenue += Number(sale.total_collected || 0)
      current.commission += Number(sale.reseller_commission || 0)
      current.paid = data.payments.filter((payment) => payment.reseller_id === key).reduce((sum, payment) => sum + Number(payment.net_paid || 0), 0)
      map.set(key, current)
    })
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 20)
  }, [data])

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader eyebrow="Reportes" title="Reportes" description="Ventas, productos, revendedores y finanzas por periodo." />
      {error && <div className="error-box">{error}</div>}
      <form className="ax-filter-drawer" onSubmit={(e) => { e.preventDefault(); load() }}>
        <label>Desde<input type="date" value={filters.date_from} onChange={(e) => setFilters((p) => ({ ...p, date_from: e.target.value }))} /></label>
        <label>Hasta<input type="date" value={filters.date_to} onChange={(e) => setFilters((p) => ({ ...p, date_to: e.target.value }))} /></label>
        <button className="primary-button" type="submit">Aplicar</button>
      </form>
      <div className="ax-metric-grid">
        <AdminMetric label="Ventas" value={data.sales.length} />
        <AdminMetric label="Facturacion" value={<MoneyCell value={summary.revenue} />} featured />
        <AdminMetric label="Ticket promedio" value={<MoneyCell value={summary.avgTicket} />} />
        <AdminMetric label="Ganancia operativa" value={<MoneyCell value={summary.profit} />} />
        <AdminMetric label="Gastos operativos" value={<MoneyCell value={summary.expenses} />} />
        <AdminMetric label="Ganancia neta" value={<MoneyCell value={summary.netProfit} />} />
        <AdminMetric label="Ingresos flujo" value={<MoneyCell value={summary.income} />} />
        <AdminMetric label="Egresos flujo" value={<MoneyCell value={summary.expenseFlow} />} />
      </div>
      <section className="ax-panel"><h2>Cliente final vs revendedores</h2><AdminDataTable columns={[
        { key: 'type', label: 'Canal' },
        { key: 'sales', label: 'Ventas', align: 'right' },
        { key: 'revenue', label: 'Facturacion', align: 'right', render: (row) => <MoneyCell value={row.revenue} /> },
        { key: 'profit', label: 'Ganancia', align: 'right', render: (row) => <MoneyCell value={row.profit} /> },
        { key: 'commissions', label: 'Comisiones', align: 'right', render: (row) => <MoneyCell value={row.commissions} /> }
      ]} rows={byType} loading={loading} /></section>
      <section className="ax-panel"><h2>Productos</h2><AdminDataTable columns={[
        { key: 'product', label: 'Producto' },
        { key: 'units', label: 'Unidades', align: 'right' },
        { key: 'revenue', label: 'Facturacion', align: 'right', render: (row) => <MoneyCell value={row.revenue} /> },
        { key: 'profit', label: 'Ganancia', align: 'right', render: (row) => <MoneyCell value={row.profit} /> },
        { key: 'stock', label: 'Stock', align: 'right' }
      ]} rows={productRanking} loading={loading} empty="Sin productos vendidos." /></section>
      <section className="ax-panel"><h2>Revendedores</h2><AdminDataTable columns={[
        { key: 'reseller', label: 'Revendedor' },
        { key: 'sales', label: 'Ventas', align: 'right' },
        { key: 'revenue', label: 'Facturacion', align: 'right', render: (row) => <MoneyCell value={row.revenue} /> },
        { key: 'commission', label: 'Comision generada', align: 'right', render: (row) => <MoneyCell value={row.commission} /> },
        { key: 'paid', label: 'Comision pagada', align: 'right', render: (row) => <MoneyCell value={row.paid} /> }
      ]} rows={resellerRanking} loading={loading} empty="Sin ventas de revendedores." /></section>
    </div>
  )
}
