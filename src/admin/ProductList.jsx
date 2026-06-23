import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllProducts, updateProduct, deleteProduct } from '../lib/api'
import { formatGs, ganancia } from '../lib/utils'
import { INTERNAL_STATUS } from '../config/site'
import { Spinner } from '../components/ui'
import { useToast } from '../components/Toast'

export default function ProductList() {
  const toast = useToast()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    getAllProducts().then(setProducts).finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function setStatus(p, internal_status) {
    try {
      await updateProduct(p.id, { internal_status })
      toast('Estado actualizado')
      load()
    } catch (e) {
      toast('Error al actualizar')
    }
  }

  async function remove(p) {
    if (!confirm(`¿Eliminar "${p.name}" definitivamente? Mejor usá Ocultar si dudás.`)) return
    try {
      await deleteProduct(p.id)
      toast('Producto eliminado')
      load()
    } catch (e) {
      toast('Error al eliminar')
    }
  }

  if (loading)
    return <div className="flex justify-center py-24 text-oliva"><Spinner /></div>

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-tinta">Productos</h1>
        <Link
          to="/admin/productos/nuevo"
          className="rounded-full bg-oliva px-4 py-2 text-sm font-medium text-crema hover:bg-olivaLight"
        >
          Agregar producto
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl2 border border-linea bg-white shadow-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-linea text-left text-humo">
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Mayorista</th>
              <th className="px-4 py-3 font-medium">Sugerido</th>
              <th className="px-4 py-3 font-medium">Ganás</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {products.map((p) => (
              <tr key={p.id} className="align-middle">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-cremaDark">
                      {p.main_image_url && (
                        <img src={p.main_image_url} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <span className="font-medium text-tinta">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-humo">{p.category || '—'}</td>
                <td className="px-4 py-3">{formatGs(p.wholesale_price)}</td>
                <td className="px-4 py-3">{formatGs(p.suggested_price)}</td>
                <td className="px-4 py-3 font-medium text-oliva">
                  {formatGs(ganancia(p.suggested_price, p.wholesale_price))}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={p.internal_status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Link
                      to={`/producto/${p.slug}`}
                      target="_blank"
                      className="rounded-md border border-tinta/15 px-2 py-1 text-xs hover:border-tinta/40"
                    >
                      Ver
                    </Link>
                    <Link
                      to={`/admin/productos/${p.id}/editar`}
                      className="rounded-md border border-tinta/15 px-2 py-1 text-xs hover:border-tinta/40"
                    >
                      Editar
                    </Link>
                    {p.internal_status !== 'active' ? (
                      <button onClick={() => setStatus(p, 'active')} className="rounded-md border border-oliva/30 px-2 py-1 text-xs text-oliva hover:bg-oliva/5">
                        Activar
                      </button>
                    ) : (
                      <button onClick={() => setStatus(p, 'hidden')} className="rounded-md border border-tinta/15 px-2 py-1 text-xs hover:border-tinta/40">
                        Ocultar
                      </button>
                    )}
                    <button onClick={() => setStatus(p, 'sold_out')} className="rounded-md border border-tinta/15 px-2 py-1 text-xs hover:border-tinta/40">
                      Agotado
                    </button>
                    <button onClick={() => remove(p)} className="rounded-md border border-[#b4641f]/30 px-2 py-1 text-xs text-[#b4641f] hover:bg-[#b4641f]/5">
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
          <p className="px-4 py-10 text-center text-humo">No hay productos cargados.</p>
        )}
      </div>
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    active: 'bg-oliva/10 text-oliva',
    hidden: 'bg-tinta/5 text-humo',
    sold_out: 'bg-[#C8742815] text-[#b4641f]',
  }
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${map[status] || map.hidden}`}>
      {INTERNAL_STATUS[status] || status}
    </span>
  )
}
