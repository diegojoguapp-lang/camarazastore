import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { ProductCard } from '../components/ProductCard'
import { getProducts } from '../lib/api'
import { publicStatusLabel } from '../lib/utils'
import { isSupabaseConfigured } from '../lib/supabase'

export function Catalogo() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => ['all', ...new Set(products.map(p => p.category).filter(Boolean))], [products])
  const filtered = useMemo(() => products.filter((product) => {
    const q = `${product.name} ${product.brand} ${product.model} ${product.category}`.toLowerCase()
    return q.includes(search.toLowerCase()) && (category === 'all' || product.category === category) && (status === 'all' || product.public_stock_status === status)
  }), [products, search, category, status])

  return (
    <div className="page">
      <section className="container page-head">
        <p className="eyebrow">Catálogo oficial</p>
        <h1>Productos disponibles para reventa</h1>
        <p>Descargá material, copiá textos y consultá stock antes de concretar una venta.</p>
        {!isSupabaseConfigured && <div className="notice">Modo demo: configurá Supabase para cargar productos reales desde el admin.</div>}
      </section>
      <section className="container filters">
        <label className="search-box"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto..." /></label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">Todas las categorías</option>{categories.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Todos los estados</option>{['disponible','consultar_stock','ultimas_unidades','agotado'].map(s => <option key={s} value={s}>{publicStatusLabel(s)}</option>)}</select>
      </section>
      <section className="container">
        {loading && <p>Cargando productos...</p>}
        {error && <div className="error-box">{error}</div>}
        {!loading && !filtered.length && <div className="empty-state">No hay productos con esos filtros.</div>}
        <div className="product-grid">{filtered.map(product => <ProductCard key={product.id} product={product} />)}</div>
      </section>
    </div>
  )
}
