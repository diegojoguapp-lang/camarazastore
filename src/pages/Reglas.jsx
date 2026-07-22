import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'

const rules = [
  'Siempre consultá stock antes de vender.',
  'No prometas entrega sin confirmar.',
  'El precio mayorista no incluye delivery.',
  'El precio sugerido es una referencia.',
  'Podés vender más caro o más barato.',
  'No cambies las características reales del producto.',
  'No uses información falsa para vender.',
  'Si conseguís una venta, pasanos por WhatsApp: nombre del cliente, número de WhatsApp, producto y precio acordado.',
  'Nosotros contactamos al cliente.',
  'Nosotros coordinamos la entrega.',
  'Nosotros cobramos al cliente.',
  'Periodo de comisiones: lunes a sabado. Domingo no trabajamos.',
  'Pago: lunes de 10:00 a 17:00. Si el lunes es feriado, se paga el martes en el mismo horario.',
  'Si hay devolución o garantía pendiente, la comisión queda en revisión.'
]

export function Reglas() {
  const navigate = useNavigate()
  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  return (
    <div className="page">
      <section className="container narrow">
        <button className="back-link plain-back" type="button" onClick={goBack}>← Volver</button>
        <div className="simple-page-head">
          <p className="eyebrow">Camaraza Store</p>
          <h1>Reglas para revendedores</h1>
        </div>
        <div className="panel">
          <div className="rule-list">
            {rules.map((rule) => (
              <p key={rule}>
                <CheckCircle2 size={18} />
                <span>{rule}</span>
              </p>
            ))}
          </div>
          <Link className="primary-button big full rules-accept" to="/catalogo">
            Entiendo las reglas
          </Link>
        </div>
      </section>
    </div>
  )
}
