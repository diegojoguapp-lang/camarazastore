import { MessageCircle, Instagram, Facebook } from 'lucide-react'
import { whatsappNumber } from '../lib/utils'

const whatsappMessage = encodeURIComponent('Hola, quiero información para ser revendedor de Camaraza Store.')

export function Redes() {
  return (
    <div className="page">
      <section className="container narrow">
        <div className="panel centered-panel">
          <h1>Redes sociales</h1>
          <p>Seguinos o escribinos para recibir novedades de productos para revender.</p>
          <div className="button-stack">
            <a className="primary-button big full" href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`} target="_blank" rel="noreferrer">
              <MessageCircle size={18} />
              WhatsApp
            </a>
            <a className="secondary-button big full" href="https://www.instagram.com/" target="_blank" rel="noreferrer">
              <Instagram size={18} />
              Instagram
            </a>
            <a className="secondary-button big full" href="https://www.facebook.com/" target="_blank" rel="noreferrer">
              <Facebook size={18} />
              Facebook
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
