import { Link } from 'react-router-dom'
import { formatGs, ganancia, waLink, mensajeConsultaStock } from '../lib/utils'
import { StatusBadge } from './ui'

export default function ProductCard({ p }) {
  const profit = ganancia(p.suggested_price, p.wholesale_price)
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl2 border border-linea bg-white shadow-card transition-shadow hover:shadow-cardHover">
      <Link to={`/producto/${p.slug}`} className="relative block aspect-square overflow-hidden bg-cremaDark">
        {p.main_image_url ? (
          <img
            src={p.main_image_url}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-humo/40">
            Sin imagen
          </div>
        )}
        <div className="absolute left-3 top-3">
          <StatusBadge status={p.public_stock_status} />
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {p.brand && (
          <span className="text-xs font-medium uppercase tracking-wide text-dorado">
            {p.brand}
          </span>
        )}
        <Link to={`/producto/${p.slug}`}>
          <h3 className="mt-0.5 line-clamp-2 font-display text-lg leading-snug text-tinta hover:text-oliva">
            {p.name}
          </h3>
        </Link>

        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-humo">Mayorista</dt>
            <dd className="font-medium text-tinta">{formatGs(p.wholesale_price)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-humo">Sugerido</dt>
            <dd className="font-medium text-tinta">{formatGs(p.suggested_price)}</dd>
          </div>
          <div className="flex justify-between border-t border-linea pt-1">
            <dt className="text-oliva">Ganás</dt>
            <dd className="font-600 text-oliva">{formatGs(profit)}</dd>
          </div>
        </dl>

        <div className="mt-4 flex gap-2">
          <Link
            to={`/producto/${p.slug}`}
            className="flex-1 rounded-full border border-tinta/15 px-3 py-2 text-center text-sm font-medium text-tinta transition-colors hover:border-tinta/40"
          >
            Ver
          </Link>
          <a
            href={waLink(mensajeConsultaStock(p))}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-full bg-wa px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-waDark"
          >
            Consultar
          </a>
        </div>
      </div>
    </article>
  )
}
