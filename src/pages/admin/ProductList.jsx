import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Pencil, Plus } from 'lucide-react'
import { getProducts, updateProductStatus } from '../../lib/api'
import { calculateProfit, formatGs, internalStatusLabel } from '../../lib/utils'

export function ProductList() {
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    getProducts({ includeHidden: true }).then(setProducts).catch((err) => setError(err.message)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const changeStatus = async (id, status) => {
    try {
      await updateProductStatus(id, status)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-head"><div><p className="eyebrow">Admin</p><h1>Productos</h1></div><Link className="primary-button" to="/admin/productos/nuevo"><Plus size={16} /> Agregar producto</Link></div>
      {error && <div className="error-box">{error}</div>}
      {loading && <p>Cargando productos...</p>}
      {!loading && <div className="table-wrap"><table className="admin-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Mayorista</th><th>Sugerido</th><th>Ganancia</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{products.map(product => <tr key={product.id}><td><div className="table-product"><img src={product.main_image_url || '/placeholder.svg'} alt={product.name} /><div><strong>{product.name}</strong><span>{product.brand} {product.model}</span></div></div></td><td>{product.category}</td><td>{formatGs(product.wholesale_price)}</td><td>{formatGs(product.suggested_price)}</td><td>{formatGs(calculateProfit(product))}</td><td><span className="admin-status">{internalStatusLabel(product.internal_status)}</span></td><td><div className="table-actions"><Link className="icon-link" to={`/producto/${product.slug}`}><Eye size={16} /></Link><Link className="icon-link" to={`/admin/productos/${product.id}/editar`}><Pencil size={16} /></Link><button onClick={() => changeStatus(product.id, product.internal_status === 'active' ? 'hidden' : 'active')}>{product.internal_status === 'active' ? 'Ocultar' : 'Activar'}</button><button onClick={() => changeStatus(product.id, 'sold_out')}>Agotado</button></div></td></tr>)}</tbody></table>{!products.length && <div className="empty-state">Todavía no cargaste productos.</div>}</div>}
    </div>
  )
}
