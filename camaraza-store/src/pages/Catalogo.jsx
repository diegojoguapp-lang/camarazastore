import { useEffect, useState } from 'react'
import { getCatalogo } from '../lib/api'
import { CATEGORIES, PUBLIC_STATUS } from '../config/site'
import ProductCard from '../components/ProductCard'
import { Spinner } from '../components/ui'

export default function Catalogo() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    // pequeño debounce para la búsqueda
    const t = setTimeout(() => {
      getCatalogo({ search, category, status })
        .then((data) => active && setProducts(data))
        .catch((e) => active && setError(e.message || 'No se pudo cargar el catálogo.'))
        .finally(() => active && setLoading(false))
    }, search ? 250 : 0)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [search, category, status])

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <header className="mb-8">
        <h1 className="font-display text-4xl text-tinta">Catálogo</h1>
        <p className="mt-2 text-humo">
          Copiá los textos, descargá el material y empezá a publicar.
        </p>
      </header>

      {/* Filtros */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto…"
          className="flex-1 rounded-full border border-linea bg-white px-5 py-2.5 text-sm outline-none focus:border-oliva"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-full border border-linea bg-white px-4 py-2.5 text-sm outline-none focus:border-oliva"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-full border border-linea bg-white px-4 py-2.5 text-sm outline-none focus:border-oliva"
        >
          <option value="">Todos los estados</option>
          {Object.entries(PUBLIC_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-24 text-oliva"><Spinner /></div>
      ) : error ? (
        <p className="py-24 text-center text-humo">{error}</p>
      ) : products.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-linea py-24 text-center text-humo">
          No hay productos que coincidan. Probá quitar algún filtro.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  )
}
