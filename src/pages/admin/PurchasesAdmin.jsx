import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Plus, Search } from 'lucide-react'
import { AdminDataTable, AdminMetric, AdminPageHeader, DateCell, FilterToolbar, MoneyCell, RowActions } from '../../components/AdminUX'
import { getPurchases } from '../../lib/adminPurchasesApi'
import { getSuppliers } from '../../lib/adminInventoryApi'

export function PurchasesAdmin() {
  const [purchases, setPurchases] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '', supplier_id: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      const [purchaseRows, supplierRows] = await Promise.all([getPurchases(filters), getSuppliers({ includeInactive: true })])
      setPurchases(purchaseRows)
      setSuppliers(supplierRows)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las compras.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const summary = useMemo(() => ({
    month: purchases.filter((row) => row.status === 'confirmed').reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
    confirmed: purchases.filter((row) => row.status === 'confirmed').length,
    units: purchases.filter((row) => row.status === 'confirmed').reduce((sum, row) => sum + (row.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0)
  }), [purchases])

  const columns = [
    { key: 'date', label: 'Fecha', render: (row) => <DateCell value={row.purchase_date} /> },
    { key: 'supplier', label: 'Proveedor', render: (row) => row.supplier?.name || 'Sin proveedor' },
    { key: 'items', label: 'Items', align: 'right', render: (row) => row.items?.length || 0 },
    { key: 'total', label: 'Total', align: 'right', render: (row) => <MoneyCell value={row.total_amount} /> },
    { key: 'status', label: 'Estado', render: (row) => row.status },
    { key: 'payment', label: 'Pago', render: (row) => row.status === 'confirmed' ? (row.payment_registered ? row.account?.name || 'Registrado' : 'Pago no registrado en finanzas') : '-' },
    { key: 'actions', label: 'Acciones', render: (row) => <RowActions><Link to={`/admin/compras/${row.id}`}><Eye size={14} /> Ver</Link></RowActions> }
  ]

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader eyebrow="Catalogo" title="Compras" description="Ingreso de mercaderia sin costo promedio automatico." actions={<Link className="primary-button" to="/admin/compras/nueva"><Plus size={16} /> Nueva compra</Link>} />
      {error && <div className="error-box">{error}</div>}
      <div className="ax-metric-grid">
        <AdminMetric label="Comprado" value={<MoneyCell value={summary.month} />} featured />
        <AdminMetric label="Confirmadas" value={summary.confirmed} />
        <AdminMetric label="Unidades ingresadas" value={summary.units} />
      </div>
      <FilterToolbar>
        <label className="ax-search-field"><Search size={15} /><input placeholder="Buscar compras" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} /></label>
        <label>Estado<select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}><option value="">Todos</option><option value="draft">Borrador</option><option value="confirmed">Confirmada</option><option value="cancelled">Cancelada</option></select></label>
        <label>Proveedor<select value={filters.supplier_id} onChange={(e) => setFilters((p) => ({ ...p, supplier_id: e.target.value }))}><option value="">Todos</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
        <button className="secondary-button" type="button" onClick={load}>Filtrar</button>
      </FilterToolbar>
      <AdminDataTable columns={columns} rows={purchases} loading={loading} empty="Todavia no hay compras." />
    </div>
  )
}
