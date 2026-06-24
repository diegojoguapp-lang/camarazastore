import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'

export function Materiales() {
  return (
    <div className="page">
      <section className="container narrow">
        <div className="panel centered-panel">
          <Download size={34} />
          <h1>Descargar materiales</h1>
          <p>Entrá al catálogo, elegí un producto y tocá “Descargar material” para abrir sus fotos, videos y descripciones.</p>
          <Link className="primary-button big full" to="/catalogo">Ver catálogo</Link>
        </div>
      </section>
    </div>
  )
}
