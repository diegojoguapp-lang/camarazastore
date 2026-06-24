import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, Instagram, Facebook, Music2 } from 'lucide-react'
import { getSocialLinks } from '../lib/api'
import { whatsappNumber } from '../lib/utils'

const whatsappMessage = encodeURIComponent('Hola, quiero información para ser revendedor de Camaraza Store.')

export function Redes() {
  const navigate = useNavigate()
  const [links, setLinks] = useState({})

  useEffect(() => {
    getSocialLinks().then(setLinks)
  }, [])

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  const socialItems = [
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, href: links.whatsapp || `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`, primary: true },
    { key: 'instagram', label: 'Instagram', icon: Instagram, href: links.instagram },
    { key: 'tiktok', label: 'TikTok', icon: Music2, href: links.tiktok },
    { key: 'facebook', label: 'Facebook', icon: Facebook, href: links.facebook }
  ].filter((item) => item.href)

  return (
    <div className="page">
      <section className="container narrow">
        <button className="back-link plain-back" type="button" onClick={goBack}>← Volver</button>
        <div className="panel centered-panel">
          <h1>Redes sociales</h1>
          <p>Seguinos o escribinos para recibir novedades de productos para revender.</p>
          <div className="button-stack">
            {socialItems.map(({ key, label, icon: Icon, href, primary }) => (
              <a key={key} className={`${primary ? 'primary-button' : 'secondary-button'} big full`} href={href} target="_blank" rel="noreferrer">
                <Icon size={18} />
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
