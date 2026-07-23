import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { AdminDataTable, AdminPageHeader, MoneyCell, RowActions } from '../../components/AdminUX'
import { deleteProduct, getProducts, updateProductStatus } from '../../lib/api'
import { calculateProfit, imageFallback, internalStatusLabel } from '../../lib/utils'

export function ProductList() {
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    getProducts({ includeHidden: true })
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const changeStatus = async (id, status) => {
    try {
      setError('')
      setMessage('')
      await updateProductStatus(id, status)
      setMessage('Estado actualizado correctamente.')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const removeProduct = async (product) => {
    if (!window.confirm('Seguro que queres eliminar este producto? Esta accion no se puede deshacer.')) return
    try {
      setError('')
      setMessage('')
      await deleteProduct(product.id)
      setMessage('Producto eliminado correctamente.')
      load()
    } catch (err) {
      setError(err.message || 'Error al eliminar producto')
    }
  }

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader
        title="Productos"
        description="Catalogo, precios y estados comerciales."
        actions={<Link className="primary-button" to="/admin/productos/nuevo"><Plus size={16} /> Agregar producto</Link>}
      />

      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <AdminDataTable
        loading={loading}
        rows={products}
        empty="Todavia no cargaste productos."
        columns={[
          { key: 'product', label: 'Producto', render: (product) => (
            <div className="table-product">
              <img src={product.main_image_url || '/placeholder.svg'} alt={product.name} width="44" height="44" loading="lazy" decoding="async" onError={imageFallback} />
              <div><strong>{product.name}</strong><span>{product.brand} {product.model}</span></div>
            </div>
          ) },
          { key: 'category', label: 'Categoria', render: (product) => product.category || '-' },
          { key: 'wholesale', label: 'Mayorista', align: 'right', render: (product) => <MoneyCell value={product.wholesale_price} /> },
          { key: 'suggested', label: 'Sugerido', align: 'right', render: (product) => <MoneyCell value={product.suggested_price} /> },
          { key: 'profit', label: 'Ganancia', align: 'right', render: (product) => <MoneyCell value={calculateProfit(product)} /> },
          { key: 'featured', label: 'Destacado', render: (product) => product.is_featured ? 'Si' : 'No' },
          { key: 'order', label: 'Orden', render: (product) => Number(product.sort_priority || 0) },
          { key: 'status', label: 'Estado', render: (product) => <span className="admin-status">{product.public_stock_status === 'agotado' ? 'Agotado' : internalStatusLabel(product.internal_status)}</span> },
          { key: 'actions', label: 'Acciones', render: (product) => (
            <RowActions>
              <Link className="icon-link" to={`/producto/${product.slug}`} title="Ver"><Eye size={16} /></Link>
              <Link className="icon-link" to={`/admin/productos/${product.id}/editar`} title="Editar"><Pencil size={16} /></Link>
              <button type="button" onClick={() => changeStatus(product.id, product.internal_status === 'active' ? 'hidden' : 'active')}>{product.internal_status === 'active' ? 'Ocultar' : 'Activar'}</button>
              <button type="button" onClick={() => changeStatus(product.id, 'sold_out')}>Agotado</button>
              <button type="button" className="danger-action" onClick={() => removeProduct(product)}><Trash2 size={14} /></button>
            </RowActions>
          ) }
        ]}
      />
    </div>
  )
}
