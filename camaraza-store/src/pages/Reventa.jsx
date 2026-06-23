import { Link } from 'react-router-dom'
import { waLink } from '../lib/utils'

const pasos = [
  'Publicamos productos con fotos, videos, descripción, precio mayorista, precio sugerido y posible ganancia.',
  'Vos descargás el material.',
  'Publicás en tus estados, Facebook, Marketplace, Instagram o grupos.',
  'Conseguís interesados.',
  'Antes de cerrar la venta, consultás stock.',
  'Coordinamos la entrega.',
  'Cobrás tu ganancia por cada venta concretada.',
]

const reglas = [
  'Siempre consultá stock antes de vender.',
  'No prometas entrega sin confirmar.',
  'El precio mayorista no incluye delivery.',
  'El precio sugerido es solo una referencia.',
  'Podés vender más caro o más barato.',
  'No cambies las características del producto.',
  'No uses información falsa para vender.',
  'Los pagos de comisiones se realizan los lunes.',
  'La comisión se confirma cuando la venta fue entregada correctamente y no hay reclamo pendiente.',
  'La garantía depende de cada producto.',
]

export default function Reventa() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <span className="text-xs font-medium uppercase tracking-wide text-dorado">
        Cómo funciona
      </span>
      <h1 className="mt-3 font-display text-4xl leading-tight text-tinta sm:text-5xl">
        Revendé productos de Camaraza Store sin tener stock propio
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-humo">
        Vos te encargás de conseguir clientes. Nosotros del producto, el stock y
        la entrega. Así de simple.
      </p>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-tinta">El sistema, paso a paso</h2>
        <ol className="mt-6 space-y-4">
          {pasos.map((p, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-oliva/10 font-display text-sm font-600 text-oliva">
                {i + 1}
              </span>
              <p className="pt-1 leading-relaxed text-tinta">{p}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 rounded-xl2 border border-linea bg-white p-7 shadow-card">
        <h2 className="font-display text-2xl text-tinta">Reglas de la comunidad</h2>
        <ul className="mt-5 space-y-3">
          {reglas.map((r, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-humo">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-dorado" />
              {r}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          to="/catalogo"
          className="rounded-full bg-oliva px-6 py-3 font-medium text-crema transition-colors hover:bg-olivaLight"
        >
          Ver catálogo
        </Link>
        <a
          href={waLink('Hola, quiero ser revendedor de Camaraza Store.')}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-wa px-6 py-3 font-medium text-white transition-colors hover:bg-waDark"
        >
          Quiero ser revendedor
        </a>
      </div>
    </div>
  )
}
