import { useEffect, useMemo, useState } from 'react'
import { ArrowUpDown, Search } from 'lucide-react'
import { ProductCard } from '../components/ProductCard'
import { getProducts } from '../lib/api'
import { calculateProfit, isBestSeller, isSoldOut, publicStatusLabel } from '../lib/utils'
import { isSupabaseConfigured } from '../lib/supabase'

const sortOptions = [
  ['recent', 'Más recientes'],
  ['profit_desc', 'Mayor ganancia'],
  ['suggested_asc', 'Menor precio sugerido'],
  ['suggested_desc', 'Mayor precio sugerido'],
  ['best_sellers', 'Más vendidos'],
  ['available_first', 'Disponibles primero']
]

export function Catalogo() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('recent')

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => ['all', ...new Set(products.map((product) => product.category).filter(Boolean))], [products])

  const filtered = useMemo(() => {
    const normalizedSearch = search.toLowerCase()
    const visibleProducts = products.filter((product) => {
      const q = `${product.name} ${product.brand} ${product.model} ${product.category}`.toLowerCase()
      return q.includes(normalizedSearch) &&
        (category === 'all' || product.category === category) &&
        (status === 'all' || product.public_stock_status === status)
    })

    return [...visibleProducts].sort((a, b) => {
      if (sort === 'profit_desc') return calculateProfit(b) - calculateProfit(a)
      if (sort === 'suggested_asc') return Number(a.suggested_price || 0) - Number(b.suggested_price || 0)
      if (sort === 'suggested_desc') return Number(b.suggested_price || 0) - Number(a.suggested_price || 0)
      if (sort === 'best_sellers') return Number(isBestSeller(b)) - Number(isBestSeller(a))
      if (sort === 'available_first') return Number(isSoldOut(a)) - Number(isSoldOut(b))
      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    })
  }, [products, search, category, status, sort])

  return (
    <div className="page catalog-page">
      <section className="container marketplace-toolbar">
        <label className="search-box marketplace-search">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto..." />
        </label>
        <label className="sort-box">
          <ArrowUpDown size={17} />
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </section>

      <section className="container compact-filters">
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">Todas las categorías</option>
          {categories.filter((item) => item !== 'all').map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Todos los estados</option>
          {['disponible', 'consultar_stock', 'ultimas_unidades', 'agotado'].map((item) => (
            <option key={item} value={item}>{publicStatusLabel(item)}</option>
          ))}
        </select>
      </section>

      <section className="container">
        {!isSupabaseConfigured && <div className="notice compact-notice">Modo demo: configurá Supabase para cargar productos reales.</div>}
        {loading && <p>Cargando productos...</p>}
        {error && <div className="error-box">{error}</div>}
        {!loading && !filtered.length && <div className="empty-state">No hay productos con esos filtros.</div>}
        <div className="product-grid marketplace-grid">
          {filtered.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>
    </div>
  )
}
