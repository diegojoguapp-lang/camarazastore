import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { AdminDataTable, AdminPageHeader, AdminStatusBadge, DateCell } from '../../components/AdminUX'
import { getInventoryHistory, getInventoryProducts, getProductReservations, movementTypeLabel } from '../../lib/adminInventoryApi'

export function InventoryHistory() {
  const { productId } = useParams()
  const [product, setProduct] = useState(null)
  const [movements, setMovements] = useState([])
  const [reservations, setReservations] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const [products, rows, reservationRows] = await Promise.all([
          getInventoryProducts(),
          getInventoryHistory(productId),
          getProductReservations(productId)
        ])
        setProduct(products.find((item) => item.id === productId) || rows[0]?.product || null)
        setMovements(rows)
        setReservations(reservationRows)
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
          <span>Fisico <strong>{Number(product.stock_quantity || 0)}</strong></span>
          <span>Reservado <strong>{Number(product.reserved_stock_quantity || 0)}</strong></span>
          <span>Disponible <strong>{Number(product.available_stock_quantity ?? (Number(product.stock_quantity || 0) - Number(product.reserved_stock_quantity || 0)))}</strong></span>
          <span>SKU <strong>{product.admin_details?.sku || '-'}</strong></span>
          <span>Control <strong>{product.admin_details?.track_inventory === false ? 'Desactivado' : 'Activo'}</strong></span>
          {product.admin_details?.track_inventory === false && <AdminStatusBadge>Sin control de inventario</AdminStatusBadge>}
        </div>
      )}
      {reservations.length > 0 && (
        <section className="ax-panel-card">
          <h2>Reservas activas</h2>
          <div className="ax-reservation-list">
            {reservations.map((reservation) => (
              <div className="ax-reservation-row" key={reservation.id}>
                <strong>{reservation.sale?.product_name_snapshot || reservation.sale_item?.product_name_snapshot || 'Venta'}</strong>
                <span>{reservation.quantity} unidades reservadas</span>
                <span>Estado venta: {reservation.sale?.status || '-'}</span>
                <DateCell value={reservation.reserved_at} />
              </div>
            ))}
          </div>
        </section>
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
