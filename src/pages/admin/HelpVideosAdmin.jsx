import { useEffect, useState } from 'react'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import { AdminDataTable, AdminPageHeader, AdminStatusBadge, Drawer, RowActions } from '../../components/AdminUX'
import { deleteHelpVideo, getHelpVideos, saveHelpVideo } from '../../lib/api'

const empty = { title: '', video_url: '', duration: '', thumbnail_url: '', sort_order: 0, is_visible: true }

export function HelpVideosAdmin() {
  const [videos, setVideos] = useState([])
  const [form, setForm] = useState(empty)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      const rows = await getHelpVideos({ includeHidden: true })
      setVideos(rows)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los videos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const edit = (video) => {
    setForm({ ...empty, ...video })
    setDrawerOpen(true)
  }
  const reset = () => {
    setForm(empty)
    setDrawerOpen(false)
  }

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
    if (!video.id) return
    if (!window.confirm('Seguro que queres eliminar este video?')) return
    try {
      setError('')
      setMessage('')
      await deleteHelpVideo(video.id)
      setMessage('Video eliminado correctamente')
      load()
    } catch (err) {
      setError(err.message || 'Error al eliminar video')
    }
  }

  const columns = [
    { key: 'thumbnail', label: 'Miniatura', render: (video) => <div className="ax-video-thumb">{video.thumbnail_url ? <img src={video.thumbnail_url} alt="" loading="lazy" decoding="async" /> : <span>Sin imagen</span>}</div> },
    { key: 'title', label: 'Video', render: (video) => <div className="ax-title-cell"><strong>{video.title}</strong><span>{video.video_url}</span></div> },
    { key: 'duration', label: 'Duracion', render: (video) => video.duration || '-' },
    { key: 'sort_order', label: 'Orden', align: 'right', render: (video) => video.sort_order || 0 },
    { key: 'visible', label: 'Estado', render: (video) => video.is_visible === false ? <AdminStatusBadge tone="neutral">Oculto</AdminStatusBadge> : <AdminStatusBadge tone="success">Visible</AdminStatusBadge> },
    { key: 'actions', label: 'Acciones', render: (video) => (
      <RowActions>
        <button type="button" onClick={() => edit(video)}><Edit2 size={14} /> Editar</button>
        <button type="button" className="danger-action" onClick={() => remove(video)}><Trash2 size={14} /> Eliminar</button>
      </RowActions>
    ) }
  ]

  return (
    <div className="admin-page ax-page">
      <AdminPageHeader
        eyebrow="Contenido"
        title="Videos de ayuda"
        description="Contenido simple para que el revendedor aprenda a vender paso a paso."
        actions={<button className="primary-button" type="button" onClick={() => { setForm(empty); setDrawerOpen(true) }}><Plus size={16} /> Nuevo video</button>}
      />
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <AdminDataTable
        columns={columns}
        rows={videos}
        loading={loading}
        empty="Todavia no hay videos cargados."
      />

      <Drawer open={drawerOpen} title={form.id ? 'Editar video' : 'Nuevo video'} onClose={reset}>
        <form className="ax-drawer-form" onSubmit={submit}>
          <label>Titulo<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label>URL del video<input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} required /></label>
          <label>Duracion<input value={form.duration || ''} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="Ej: 4 min" /></label>
          <label>Miniatura<input value={form.thumbnail_url || ''} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="URL de imagen" /></label>
          <label>Orden<input type="number" value={form.sort_order || 0} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></label>
          <label className="checkbox-label"><input type="checkbox" checked={form.is_visible !== false} onChange={(e) => setForm({ ...form, is_visible: e.target.checked })} /> Visible</label>
          <button className="primary-button" type="submit">Guardar video</button>
          {form.id && <button className="secondary-button" type="button" onClick={reset}>Cancelar edicion</button>}
        </form>
      </Drawer>
    </div>
  )
}
