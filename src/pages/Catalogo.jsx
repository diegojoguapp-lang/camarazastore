import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Filter, Search, X } from 'lucide-react'
import { ProductCard } from '../components/ProductCard'
import { getProducts } from '../lib/api'
import { calculateProfit, isSoldOut } from '../lib/utils'
import { isSupabaseConfigured } from '../lib/supabase'

const sortOptions = [
  ['priority', 'Orden recomendado'],
  ['recent', 'Más recientes'],
  ['profit_desc', 'Mayor ganancia'],
  ['suggested_asc', 'Menor precio'],
  ['suggested_desc', 'Mayor precio']
]

export function Catalogo() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('priority')
  const [draftCategory, setDraftCategory] = useState('all')
  const [draftStatus, setDraftStatus] = useState('all')
  const [draftSort, setDraftSort] = useState('priority')
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => ['all', ...new Set(products.map((product) => product.category).filter(Boolean))], [products])

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  const openFilters = () => {
    setDraftCategory(category)
    setDraftStatus(status)
    setDraftSort(sort)
    setFiltersOpen(true)
  }

  const applyFilters = () => {
    setCategory(draftCategory)
    setStatus(draftStatus)
    setSort(draftSort)
    setFiltersOpen(false)
  }

  const clearFilters = () => {
    setDraftCategory('all')
    setDraftStatus('all')
    setDraftSort('priority')
    setCategory('all')
    setStatus('all')
    setSort('priority')
    setFiltersOpen(false)
  }

  const filtered = useMemo(() => {
    const normalizedSearch = search.toLowerCase()
    const visibleProducts = products.filter((product) => {
      const q = `${product.name} ${product.brand} ${product.model} ${product.category}`.toLowerCase()
      const stockMatch =
        status === 'all' ||
        (status === 'available' && !isSoldOut(product)) ||
        (status === 'sold_out' && isSoldOut(product))

      return q.includes(normalizedSearch) &&
        (category === 'all' || product.category === category) &&
        stockMatch
    })

    return [...visibleProducts].sort((a, b) => {
      if (sort === 'profit_desc') return calculateProfit(b) - calculateProfit(a)
      if (sort === 'suggested_asc') return Number(a.suggested_price || 0) - Number(b.suggested_price || 0)
      if (sort === 'suggested_desc') return Number(b.suggested_price || 0) - Number(a.suggested_price || 0)
      if (sort === 'priority') {
        const priorityDifference = Number(b.sort_priority || 0) - Number(a.sort_priority || 0)
        if (priorityDifference) return priorityDifference
      }
      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    })
  }, [products, search, category, status, sort])

  return (
    <div className="page catalog-page">
      <section className="container">
        <button className="back-link plain-back" type="button" onClick={goBack}>← Volver</button>
      </section>

      <section className="container catalog-topbar">
        <label className="search-box catalog-search">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." />
        </label>
        <button className="filter-trigger" type="button" onClick={openFilters} aria-label="Abrir filtros">
          <Filter size={18} />
        </button>
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

      {filtersOpen && (
        <div className="filter-overlay" role="dialog" aria-modal="true" aria-label="Filtros del catálogo">
          <button className="filter-backdrop" type="button" onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros" />
          <div className="filter-drawer">
            <div className="filter-drawer-head">
              <h2>Filtros</h2>
              <button className="icon-button" type="button" onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros">
                <X size={19} />
              </button>
            </div>

            <label>Ordenar por
              <select value={draftSort} onChange={(event) => setDraftSort(event.target.value)}>
                {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <label>Estado
              <select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)}>
                <option value="all">Todos</option>
                <option value="available">Hay stock</option>
                <option value="sold_out">Sin stock</option>
              </select>
            </label>

            {categories.length > 1 && (
              <label>Categoría
                <select value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)}>
                  <option value="all">Todas</option>
                  {categories.filter((item) => item !== 'all').map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            )}

            <div className="filter-actions">
              <button className="secondary-button big" type="button" onClick={clearFilters}>Limpiar</button>
              <button className="primary-button big" type="button" onClick={applyFilters}>Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
