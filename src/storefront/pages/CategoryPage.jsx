import { SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams, useParams } from 'react-router-dom'
import { getRetailCategories, getRetailProducts } from '../../lib/storefrontApi'
import { ProductCard } from '../components/ProductCard'
import { StoreFooter, StoreSearch, StoreSkeleton } from '../components/StoreChrome'
import { getPublicCategoryUrl, STORE_ORIGIN } from '../config'
import { useStoreSeo } from '../seo'

const defaultFilters = { minPrice: '', maxPrice: '', availableOnly: false, order: 'relevant' }

export function CategoryPage({ onAdd, allProducts = false }) {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const [query, setQuery] = useState(params.get('buscar') || '')
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  const [filters, setFilters] = useState(defaultFilters)
  const [draft, setDraft] = useState(defaultFilters)
  const [filterOpen, setFilterOpen] = useState(false)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const category = categories.find((item) => item.slug === slug)
  const isAll = allProducts || slug === 'todos'
  const title = isAll ? 'Todos los productos' : category?.name || 'Productos'
  useStoreSeo({ title: isAll ? 'Todos los productos | Camaraza Store' : title, description: `Explora ${title.toLowerCase()} disponibles en Camaraza Store.`, canonical: isAll ? `${STORE_ORIGIN}/productos` : getPublicCategoryUrl(slug) })

  useEffect(() => {
    getRetailCategories().then(setCategories).catch(() => setCategories([]))
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350)
    return () => clearTimeout(timer)
  }, [query])
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    getRetailProducts({ ...filters, categorySlug: filters.categorySlug || (isAll ? null : slug), search: debouncedQuery })
      .then((rows) => active && setProducts(rows)).catch((reason) => active && setError(reason.message)).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [debouncedQuery, filters, isAll, slug])

  const children = useMemo(() => categories.filter((item) => item.parent_id === category?.id && Number(item.product_count) > 0), [categories, category])
  return <>
    <main className="sf-main sf-category-page">
      <StoreSearch value={query} onChange={setQuery} onClear={() => setDebouncedQuery('')} onSubmit={(event) => event.preventDefault()} loading={loading && Boolean(debouncedQuery)} />
      <div className="sf-category-title"><div><h1>{title}</h1><p>{loading ? 'Buscando productos...' : `${products.length} producto${products.length === 1 ? '' : 's'}`}</p></div><button type="button" onClick={() => { setDraft(filters); setFilterOpen(true) }}><SlidersHorizontal size={18} /> Filtros</button></div>
      {!!children.length && <nav className="sf-subcategories">{children.map((item) => <Link key={item.id} to={`/categoria/${item.slug}`}>{item.name}</Link>)}</nav>}
      {error && <div className="sf-notice is-error">{error}</div>}
      {loading ? <StoreSkeleton cards={8} /> : products.length ? <div className="sf-grid">{products.map((product) => <ProductCard key={product.id} product={product} onAdd={onAdd} />)}</div> : <div className="sf-empty"><strong>No hay resultados</strong><p>Proba cambiando los filtros o la busqueda.</p></div>}
    </main>
    <StoreFooter />
    {filterOpen && <div className="sf-filter-layer" role="dialog" aria-modal="true" aria-label="Filtros de productos"><button className="sf-filter-backdrop" type="button" onClick={() => setFilterOpen(false)} aria-label="Cerrar filtros" /><form className="sf-filter-panel" onSubmit={(event) => { event.preventDefault(); setFilters(draft); setFilterOpen(false) }}>
      <header><h2>Filtrar productos</h2><button type="button" onClick={() => setFilterOpen(false)} aria-label="Cerrar"><X size={21} /></button></header>
      <label>Categoria<select value={draft.categorySlug || ''} onChange={(event) => setDraft((value) => ({ ...value, categorySlug: event.target.value }))}><option value="">{isAll ? 'Todas' : title}</option>{categories.filter((item) => item.is_active !== false && item.slug !== slug && Number(item.product_count) > 0).map((item) => <option key={item.id || item.slug} value={item.slug}>{item.parent_name ? item.parent_name + ' / ' : ''}{item.name}</option>)}</select></label>
      <label>Ordenar por<select value={draft.order} onChange={(event) => setDraft((value) => ({ ...value, order: event.target.value }))}><option value="relevant">Relevantes</option><option value="newest">Mas nuevos</option><option value="price_asc">Menor precio</option><option value="price_desc">Mayor precio</option></select></label>
      <fieldset><legend>Rango de precio</legend><div><label>Desde<input type="number" min="0" inputMode="numeric" value={draft.minPrice} onChange={(event) => setDraft((value) => ({ ...value, minPrice: event.target.value }))} /></label><label>Hasta<input type="number" min="0" inputMode="numeric" value={draft.maxPrice} onChange={(event) => setDraft((value) => ({ ...value, maxPrice: event.target.value }))} /></label></div></fieldset>
      <label className="sf-check"><input type="checkbox" checked={draft.availableOnly} onChange={(event) => setDraft((value) => ({ ...value, availableOnly: event.target.checked }))} /> Solo productos disponibles</label>
      <footer><button className="sf-secondary-button" type="button" onClick={() => { setDraft(defaultFilters); setFilters(defaultFilters); setFilterOpen(false) }}>Limpiar</button><button className="sf-primary-button" type="submit">Aplicar</button></footer>
    </form></div>}
  </>
}
