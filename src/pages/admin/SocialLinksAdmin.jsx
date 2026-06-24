import { useEffect, useState } from 'react'
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
    <div className="admin-page">
      <div className="admin-head"><div><p className="eyebrow">Admin</p><h1>Redes sociales</h1></div></div>
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}
      <form className="form-section admin-simple-form" onSubmit={submit}>
        <div className="form-grid single">
          <label>WhatsApp<input value={links.whatsapp || ''} onChange={(e) => set('whatsapp', e.target.value)} placeholder="https://wa.me/..." /></label>
          <label>Instagram<input value={links.instagram || ''} onChange={(e) => set('instagram', e.target.value)} placeholder="https://instagram.com/..." /></label>
          <label>TikTok<input value={links.tiktok || ''} onChange={(e) => set('tiktok', e.target.value)} placeholder="https://tiktok.com/@..." /></label>
          <label>Facebook<input value={links.facebook || ''} onChange={(e) => set('facebook', e.target.value)} placeholder="https://facebook.com/..." /></label>
        </div>
        <button className="primary-button" type="submit">Guardar redes</button>
      </form>
    </div>
  )
}
