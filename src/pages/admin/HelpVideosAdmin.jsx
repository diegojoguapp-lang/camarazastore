import { useEffect, useState } from 'react'
import { deleteHelpVideo, getHelpVideos, saveHelpVideo } from '../../lib/api'

const empty = { title: '', url: '', duration: '', thumbnail_url: '', sort_order: 0, is_visible: true }

export function HelpVideosAdmin() {
  const [videos, setVideos] = useState([])
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = () => getHelpVideos({ includeHidden: true }).then(setVideos)

  useEffect(() => { load() }, [])

  const edit = (video) => setForm({ ...empty, ...video })
  const reset = () => setForm(empty)

  const submit = async (event) => {
    event.preventDefault()
    try {
      setError('')
      setMessage('')
      await saveHelpVideo(form)
      setMessage('Video guardado correctamente')
      reset()
      load()
    } catch (err) {
      setError(err.message || 'Error al guardar video')
    }
  }

  const remove = async (video) => {
    if (!window.confirm('¿Seguro que querés eliminar este video?')) return
    try {
      setError('')
      await deleteHelpVideo(video.id)
      setMessage('Video eliminado correctamente')
      load()
    } catch (err) {
      setError(err.message || 'Error al eliminar video')
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-head"><div><p className="eyebrow">Admin</p><h1>Videos de ayuda</h1></div></div>
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <form className="form-section admin-simple-form" onSubmit={submit}>
        <h2>{form.id ? 'Editar video' : 'Nuevo video'}</h2>
        <div className="form-grid">
          <label>Título<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label>URL del video<input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required /></label>
          <label>Duración<input value={form.duration || ''} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="Ej: 4 min" /></label>
          <label>Miniatura<input value={form.thumbnail_url || ''} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="URL de imagen" /></label>
          <label>Orden<input type="number" value={form.sort_order || 0} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></label>
          <label className="checkbox-label"><input type="checkbox" checked={form.is_visible !== false} onChange={(e) => setForm({ ...form, is_visible: e.target.checked })} /> Visible</label>
        </div>
        <div className="form-actions-row">
          <button className="primary-button" type="submit">Guardar video</button>
          {form.id && <button className="secondary-button" type="button" onClick={reset}>Cancelar edición</button>}
        </div>
      </form>

      <div className="table-wrap admin-content-list">
        {videos.map((video) => (
          <div className="admin-list-row" key={video.id || video.url}>
            <span>{video.title} {!video.is_visible && '(oculto)'}</span>
            <div className="table-actions">
              <button type="button" onClick={() => edit(video)}>Editar</button>
              <button type="button" className="danger-action" onClick={() => remove(video)}>Eliminar</button>
            </div>
          </div>
        ))}
        {!videos.length && <div className="empty-state">No hay videos cargados.</div>}
      </div>
    </div>
  )
}
