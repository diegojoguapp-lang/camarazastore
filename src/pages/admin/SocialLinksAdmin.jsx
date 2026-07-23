import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { AdminPageHeader, AdminStatusBadge } from '../../components/AdminUX'
import { getSocialLinks, saveSocialLinks } from '../../lib/api'

export function SocialLinksAdmin() {
  const [links, setLinks] = useState({ instagram: '', whatsapp: '', tiktok: '', facebook: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    getSocialLinks().then(setLinks)
  }, [])

  const set = (key, value) => setLinks((prev) => ({ ...prev, [key]: value }))

  const submit = async (event) => {
    event.preventDefault()
    try {
      setError('')
      setMessage('')
      await saveSocialLinks(links)
      setMessage('Redes guardadas correctamente')
    } catch (err) {
      setError(err.message || 'Error al guardar redes')
    }
  }

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader
        eyebrow="Contenido"
        title="Redes sociales"
        description="Links visibles para contacto y redes desde la portada."
      />
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <form className="ax-panel ax-settings-panel" onSubmit={submit}>
        {[
          ['whatsapp', 'WhatsApp', 'https://wa.me/...'],
          ['instagram', 'Instagram', 'https://instagram.com/...'],
          ['tiktok', 'TikTok', 'https://tiktok.com/@...'],
          ['facebook', 'Facebook', 'https://facebook.com/...']
        ].map(([key, label, placeholder]) => (
          <label className="ax-setting-row" key={key}>
            <span>
              <strong>{label}</strong>
              <AdminStatusBadge tone={links[key] ? 'success' : 'neutral'}>{links[key] ? 'Cargado' : 'Vacio'}</AdminStatusBadge>
            </span>
            <input value={links[key] || ''} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} />
          </label>
        ))}
        <div className="form-actions-row">
          <button className="primary-button" type="submit"><Save size={16} /> Guardar redes</button>
        </div>
      </form>
    </div>
  )
}
