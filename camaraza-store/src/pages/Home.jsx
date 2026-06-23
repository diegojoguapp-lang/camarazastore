import { Link } from 'react-router-dom'
import { STORE } from '../config/site'
import { waLink } from '../lib/utils'

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-dorado/30 bg-dorado/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#8a6d2e]">
              Comunidad de revendedores
            </span>
            <h1 className="mt-5 font-display text-4xl leading-[1.05] text-tinta sm:text-6xl">
              Vendé electrónica
              <br />
              <span className="italic text-oliva">sin tener stock.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-humo">
              Te damos las fotos, los videos, los precios y la ganancia ya
              calculada. Vos publicás desde tu celular y cobrás por cada venta.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={waLink('Hola, quiero ser revendedor de Camaraza Store.')}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-oliva px-6 py-3 font-medium text-crema shadow-card transition-colors hover:bg-olivaLight"
              >
                Quiero ser revendedor
              </a>
              <Link
                to="/catalogo"
                className="rounded-full border border-tinta/15 px-6 py-3 font-medium text-tinta transition-colors hover:border-tinta/40"
              >
                Ver catálogo
              </Link>
            </div>
          </div>

          {/* Tarjeta-muestra de ganancia */}
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-doradoSoft/40 to-oliva/10 blur-2xl" />
            <div className="rounded-xl2 border border-linea bg-white p-7 shadow-cardHover">
              <p className="text-sm font-medium uppercase tracking-wide text-dorado">
                Ejemplo real
              </p>
              <h3 className="mt-1 font-display text-2xl text-tinta">
                Máquina para cortar pelo
              </h3>
              <div className="mt-6 space-y-3 text-base">
                <Row label="Precio mayorista" value="85.000 Gs" />
                <Row label="Precio sugerido" value="145.000 Gs" />
                <div className="flex items-center justify-between rounded-xl bg-oliva/8 px-4 py-3">
                  <span className="font-medium text-oliva">Tu ganancia</span>
                  <span className="font-display text-2xl font-600 text-oliva">
                    60.000 Gs
                  </span>
                </div>
              </div>
              <p className="mt-4 text-xs text-humo">
                Podés vender más caro o más barato. El sugerido es solo una
                referencia.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Cómo funciona resumido */}
      <section className="border-t border-linea bg-cremaDark/30">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-display text-3xl text-tinta">Así de simple</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              ['Elegí un producto', 'Entrá al catálogo y descargá fotos, videos y textos listos para publicar.'],
              ['Publicá donde quieras', 'Estados de WhatsApp, Marketplace, Instagram o grupos de compra/venta.'],
              ['Cobrá tu ganancia', 'Conseguís el cliente, consultás stock y cobrás por cada venta concretada.'],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-xl2 border border-linea bg-white p-6 shadow-card">
                <span className="font-display text-3xl text-doradoSoft">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-2 font-display text-xl text-tinta">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-humo">{d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <Link
              to="/reventa"
              className="text-sm font-medium text-oliva underline-offset-4 hover:underline"
            >
              Ver cómo funciona en detalle →
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-linea pb-2">
      <span className="text-humo">{label}</span>
      <span className="font-medium text-tinta">{value}</span>
    </div>
  )
}
