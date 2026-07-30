import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { AdminDataTable, AdminPageHeader, AdminStatusBadge, DateCell } from '../../components/AdminUX'
import { getInventoryHistory, getInventoryProducts, movementTypeLabel } from '../../lib/adminInventoryApi'

export function InventoryHistory() {
  const { productId } = useParams()
  const [product, setProduct] = useState(null)
  const [movements, setMovements] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const [products, rows] = await Promise.all([
          getInventoryProducts(),
          getInventoryHistory(productId)
        ])
        setProduct(products.find((item) => item.id === productId) || rows[0]?.product || null)
        setMovements(rows)
      } catch (err) {
        setError(err.message || 'No se pudo cargar el historial.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [productId])

  const columns = [
    { key: 'created_at', label: 'Fecha y hora', render: (row) => <DateCell value={row.created_at} /> },
    { key: 'movement_type', label: 'Tipo', render: (row) => movementTypeLabel(row.movement_type) },
    { key: 'quantity_delta', label: 'Cantidad', align: 'right', render: (row) => <span className={Number(row.quantity_delta) < 0 ? 'ax-negative' : 'ax-positive'}>{Number(row.quantity_delta) > 0 ? `+${row.quantity_delta}` : row.quantity_delta}</span> },
    { key: 'stock_before', label: 'Anterior', align: 'right' },
    { key: 'stock_after', label: 'Posterior', align: 'right' },
    { key: 'reason', label: 'Motivo' },
    { key: 'notes', label: 'Observacion', render: (row) => row.notes || '-' },
    { key: 'actor', label: 'Responsable', render: (row) => row.actor_name || (row.created_by ? String(row.created_by).slice(0, 8) : '-') }
  ]

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader
        eyebrow="Inventario"
        title={product?.name || 'Historial'}
        description="Movimientos ordenados del mas reciente al mas antiguo."
        actions={<Link className="secondary-button" to="/admin/inventario"><ArrowLeft size={16} /> Volver</Link>}
      />
      {error && <div className="error-box">{error}</div>}
      {product && (
        <div className="ax-compact-summary">
          <span>Stock actual <strong>{Number(product.stock_quantity || 0)}</strong></span>
          <span>SKU <strong>{product.admin_details?.sku || '-'}</strong></span>
          <span>Control <strong>{product.admin_details?.track_inventory === false ? 'Desactivado' : 'Activo'}</strong></span>
          {product.admin_details?.track_inventory === false && <AdminStatusBadge>Sin control de inventario</AdminStatusBadge>}
        </div>
      )}
      <AdminDataTable
        columns={columns}
        rows={movements}
        loading={loading}
        empty="Todavia no existen movimientos para este producto."
      />
    </div>
  )
}
