import { Link } from 'react-router-dom'
import { CheckCircle2, MessageCircle } from 'lucide-react'
import { whatsappNumber } from '../lib/utils'

const steps = [
  'Elegí un producto del catálogo.',
  'Descargá fotos, videos y descripción.',
  'Publicá en WhatsApp, Facebook Marketplace, Instagram o grupos.',
  'Conseguí un cliente interesado.',
  'Consultá stock antes de cerrar la venta.',
  'Se coordina la entrega.',
  'Cobrás tu ganancia por venta concretada.'
]
const rules = [
  'Siempre consultar stock antes de vender.',
  'No prometer entrega sin confirmar.',
  'El precio mayorista no incluye delivery.',
  'El precio sugerido es solo una referencia.',
  'Podés vender más caro o más barato.',
  'No cambiar características del producto.',
  'No usar información falsa para vender.',
  'Periodo de comisiones: lunes a sabado. Domingo no trabajamos.',
  'Pago: lunes de 10:00 a 17:00. Si el lunes es feriado, se paga el martes en el mismo horario.',
  'La comisión se confirma cuando la venta fue entregada correctamente y no hay reclamo pendiente.',
  'La garantía depende de cada producto.'
]
export function Reventa() {
  const message = encodeURIComponent('Hola, quiero entrar al sistema de reventa de Camaraza Store.')
  return (
    <div className="page">
      <section className="container narrow intro-block">
        <p className="eyebrow">Cómo funciona</p>
        <h1>Revendé productos de Camaraza Store sin tener stock propio.</h1>
        <p className="lead">Este catálogo está hecho para que tengas todo ordenado: producto, precio mayorista, precio sugerido, posible ganancia, material descargable y botón para consultar stock.</p>
        <div className="hero-actions"><Link className="primary-button big" to="/catalogo">Ver catálogo</Link><a className="secondary-button big" href={`https://wa.me/${whatsappNumber}?text=${message}`} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Quiero ser revendedor</a></div>
      </section>
      <section className="container two-columns">
        <div className="panel"><h2>Proceso de trabajo</h2><div className="numbered-list">{steps.map((step, index) => <div key={step}><strong>{index + 1}</strong><span>{step}</span></div>)}</div></div>
        <div className="panel"><h2>Reglas importantes</h2><div className="check-list">{rules.map(rule => <p key={rule}><CheckCircle2 size={18} /> {rule}</p>)}</div></div>
      </section>
    </div>
  )
}
