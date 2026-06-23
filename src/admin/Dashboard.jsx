import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllProducts } from '../lib/api'
import { Spinner } from '../components/ui'
import { formatGs } from '../lib/utils'

export default function Dashboard() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllProducts()
      .then(setProducts)
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return <div className="flex justify-center py-24 text-oliva"><Spinner /></div>

  const total = products.length
  const activos = products.filter((p) => p.internal_status === 'active').length
  const agotados = products.filter((p) => p.internal_status === 'sold_out').length
  const ocultos = products.filter((p) => p.internal_status === 'hidden').length
  const ultimos = products.slice(0, 5)

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-tinta">Dashboard</h1>
        <div className="flex gap-2">
          <Link
            to="/admin/productos/nuevo"
            className="rounded-full bg-oliva px-4 py-2 text-sm font-medium text-crema hover:bg-olivaLight"
          >
            Agregar producto
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total" value={total} />
        <Stat label="Activos" value={activos} tone="oliva" />
        <Stat label="Agotados" value={agotados} tone="warn" />
        <Stat label="Ocultos" value={ocultos} tone="muted" />
      </div>

      <div className="mt-8 rounded-xl2 border border-linea bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-tinta">Últimos agregados</h2>
          <Link to="/admin/productos" className="text-sm text-oliva hover:underline">
            Ver todos
          </Link>
        </div>
        {ultimos.length === 0 ? (
          <p className="mt-4 text-sm text-humo">Todavía no cargaste productos.</p>
        ) : (
          <ul className="mt-4 divide-y divide-linea">
            {ultimos.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-cremaDark">
                  {p.main_image_url && (
                    <img src={p.main_image_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-tinta">{p.name}</p>
                  <p className="text-sm text-humo">{p.category || 'Sin categoría'}</p>
                </div>
                <span className="text-sm font-medium text-oliva">
                  {formatGs(p.suggested_price)}
                </span>
                <Link
                  to={`/admin/productos/${p.id}/editar`}
                  className="rounded-full border border-tinta/15 px-3 py-1.5 text-sm hover:border-tinta/40"
                >
                  Editar
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, tone }) {
  const tones = {
    oliva: 'text-oliva',
    warn: 'text-[#b4641f]',
    muted: 'text-humo',
  }
  return (
    <div className="rounded-xl2 border border-linea bg-white p-5 shadow-card">
      <div className="text-sm text-humo">{label}</div>
      <div className={`mt-1 font-display text-3xl font-600 ${tones[tone] || 'text-tinta'}`}>
        {value}
      </div>
    </div>
  )
}
