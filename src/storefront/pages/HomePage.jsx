import { ArrowRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getRetailHome } from '../../lib/storefrontApi'
import { getDisplayImageUrl, imageFallback } from '../../lib/utils'
import { CategoryRail, StoreFooter, StoreSearch, StoreSkeleton } from '../components/StoreChrome'
import { ProductCard, ProductRail } from '../components/ProductCard'
import { STORE_ORIGIN } from '../config'
import { useStoreSeo } from '../seo'

export function HomePage({ onAdd }) {
  const navigate = useNavigate()
  const [home, setHome] = useState(null)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useStoreSeo({ title: 'Camaraza Store | Electronica, tecnologia y mas', description: 'Compra electronica, tecnologia y productos para tu hogar en Camaraza Store. Consulta y coordina tu pedido por WhatsApp.', canonical: STORE_ORIGIN })

  useEffect(() => {
    let active = true
    getRetailHome().then((data) => active && setHome(data)).catch((reason) => active && setError(reason.message)).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim().toLowerCase()), 280)
    return () => clearTimeout(timer)
  }, [query])

  const allProducts = useMemo(() => {
    if (!home) return []
    const map = new Map()
    ;[...(home.featured || []), ...(home.new_products || []), ...(home.sections || []).flatMap((section) => section.products || [])].forEach((product) => map.set(product.id, product))
    return [...map.values()]
  }, [home])
  const results = debounced ? allProducts.filter((product) => [product.name, product.brand, product.model, product.category_name, product.parent_category_name].join(' ').toLowerCase().includes(debounced)).slice(0, 12) : []
  const heroProduct = home?.featured?.[0] || home?.new_products?.[0]

  return <>
    <main className="sf-main">
      <StoreSearch value={query} onChange={setQuery} onSubmit={(event) => { event.preventDefault(); if (query.trim()) navigate(`/categoria/todos?buscar=${encodeURIComponent(query.trim())}`) }} />
      {debounced ? <section className="sf-search-results">
        <div className="sf-section-heading"><h1>Resultados</h1><Link to={`/categoria/todos?buscar=${encodeURIComponent(query.trim())}`}>Ver todos <span>›</span></Link></div>
        {loading && <StoreSkeleton />}
        {!loading && !results.length && <div className="sf-empty"><strong>No encontramos productos</strong><p>Proba con otro nombre, marca o categoria.</p></div>}
        <div className="sf-grid">{results.map((product) => <ProductCard key={product.id} product={product} onAdd={onAdd} />)}</div>
      </section> : <>
        <section className="sf-hero">
          <div><span>Tu tienda de confianza</span><h1>Electronica, tecnologia y mas</h1><p>Encontra productos para disfrutar, regalar y resolver tu dia.</p><Link to="/categoria/todos">Ver productos <ArrowRight size={18} /></Link></div>
          {heroProduct && <img src={getDisplayImageUrl(heroProduct.main_image_url, { width: 480, height: 400, resize: 'contain' })} alt={heroProduct.name} width="360" height="300" decoding="async" onError={imageFallback} />}
        </section>
        {loading && <StoreSkeleton cards={6} />}
        {error && <div className="sf-notice is-error">{error}</div>}
        {home && <>
          <CategoryRail categories={home.categories} />
          <ProductRail title="Destacados" products={home.featured} onAdd={onAdd} />
          {home.sections.map((section) => <ProductRail key={section.id || section.slug} title={section.name} slug={section.slug} products={section.products} onAdd={onAdd} />)}
          <ProductRail title="Nuevos" slug="todos" products={home.new_products} onAdd={onAdd} />
        </>}
      </>}
    </main>
    <StoreFooter />
  </>
}
