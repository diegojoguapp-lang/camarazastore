import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatCard } from '../../components/StatCard'
import { getProducts } from '../../lib/api'
import { formatGs } from '../../lib/utils'

export function AdminDashboard() {
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    getProducts({ includeHidden: true }).then(setProducts).catch((err) => setError(err.message))
  }, [])
  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter(p => p.internal_status === 'active').length,
    hidden: products.filter(p => p.internal_status === 'hidden').length,
    soldOut: products.filter(p => p.internal_status === 'sold_out' || p.public_stock_status === 'agotado').length,
    totalWholesale: products.reduce((acc, p) => acc + Number(p.wholesale_price || 0), 0)
  }), [products])
  return (
    <div className="admin-page">
      <div className="admin-head"><div><p className="eyebrow">Admin</p><h1>Dashboard</h1></div><Link className="primary-button" to="/admin/productos/nuevo">Agregar producto</Link></div>
      {error && <div className="error-box">{error}</div>}
      <div className="stats-grid">
        <StatCard label="Total productos" value={stats.total} />
        <StatCard label="Activos" value={stats.active} />
        <StatCard label="Agotados" value={stats.soldOut} />
        <StatCard label="Ocultos" value={stats.hidden} />
        <StatCard label="Mayorista cargado" value={formatGs(stats.totalWholesale)} hint="Suma de precios mayoristas" />
      </div>
      <section className="panel"><div className="section-title"><h2>Últimos productos</h2><Link to="/admin/productos">Ver todos</Link></div>{products.slice(0, 5).map(product => <div className="admin-list-row" key={product.id}><span>{product.name}</span><strong>{formatGs(product.wholesale_price)}</strong></div>)}{!products.length && <p>No hay productos cargados todavía.</p>}</section>
    </div>
  )
}
