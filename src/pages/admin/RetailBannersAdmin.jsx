import { Edit3, ImagePlus, Plus, Power, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AdminPageHeader, AdminStatusBadge } from '../../components/AdminUX'
import { deleteRetailBanner, getRetailBanners, removeRetailAsset, saveRetailBanner, setRetailBannerActive, uploadRetailAsset } from '../../lib/adminRetailApi'
import { imageFallback } from '../../lib/utils'

const empty = { title: '', subtitle: '', button_text: '', target_url: '/productos', mobile_image_url: '', desktop_image_url: '', is_active: true, sort_order: 0 }

function BannerImageField({ label, value, onChange, required, recommendation }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const upload = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    setBusy(true); setError('')
    try { onChange(await uploadRetailAsset(file, 'banners', value)) } catch (reason) { setError(reason.message) } finally { setBusy(false) }
  }
  const remove = () => { setError(''); onChange('') }
  return <div className="retail-upload-field banner-upload"><span>{label}{required ? ' *' : ''}</span>{value ? <img src={value} alt="Vista previa del banner" onError={imageFallback} /> : <div className="retail-upload-placeholder"><ImagePlus size={28} /><span>Sin imagen</span></div>}<input ref={ref} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={upload} /><div><button className="secondary-button" disabled={busy} type="button" onClick={() => ref.current?.click()}>{busy ? 'Subiendo...' : value ? 'Reemplazar' : 'Subir imagen'}</button>{value && <button className="secondary-button danger-action" disabled={busy} type="button" onClick={remove}>Quitar</button>}</div><small>JPG, PNG o WEBP. Maximo 5 MB. {recommendation}</small>{error && <small className="field-error">{error}</small>}</div>
}

export function RetailBannersAdmin() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(empty)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const load = async () => { setLoading(true); try { setRows(await getRetailBanners()) } catch (reason) { setError(reason.message) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const edit = (banner = null) => { setError(''); setForm(banner ? { ...empty, ...banner, subtitle: banner.subtitle || '', button_text: banner.button_text || '', target_url: banner.target_url || '', desktop_image_url: banner.desktop_image_url || '' } : { ...empty }); setOpen(true) }
  const submit = async (event) => { event.preventDefault(); setSaving(true); setError(''); try { const previous = form.id ? rows.find((item) => item.id === form.id) : null; const saved = await saveRetailBanner(form); await Promise.all([previous?.mobile_image_url && previous.mobile_image_url !== saved.mobile_image_url ? removeRetailAsset(previous.mobile_image_url, 'banners') : null, previous?.desktop_image_url && previous.desktop_image_url !== saved.desktop_image_url ? removeRetailAsset(previous.desktop_image_url, 'banners') : null]); setOpen(false); await load(); setSuccess(form.id ? 'Banner actualizado correctamente.' : 'Banner creado correctamente.') } catch (reason) { setError(reason.message) } finally { setSaving(false) } }
  const toggle = async (banner) => { try { await setRetailBannerActive(banner.id, !banner.is_active); await load(); setSuccess(banner.is_active ? 'Banner desactivado.' : 'Banner activado.') } catch (reason) { setError(reason.message) } }
  const remove = async (banner) => { if (!window.confirm(`Eliminar el banner "${banner.title}"?`)) return; try { await deleteRetailBanner(banner.id); await Promise.all([removeRetailAsset(banner.mobile_image_url, 'banners'), removeRetailAsset(banner.desktop_image_url, 'banners')]); await load(); setSuccess('Banner eliminado.') } catch (reason) { setError(reason.message) } }
  return <div className="admin-page ax-page retail-banners-admin"><AdminPageHeader title="Banners tienda" description="El primer banner activo segun su orden se muestra en la Home." actions={<button className="primary-button" type="button" onClick={() => edit()}><Plus size={17} /> Nuevo banner</button>} />
    {success && <div className="toast">{success}</div>}{error && <div className="error-box">{error}</div>}
    {loading ? <div className="ds-skeleton-card"><span /><strong /><p /></div> : !rows.length ? <section className="retail-category-empty"><strong>Todavia no hay banners.</strong><p>Mientras tanto, la tienda mantiene el hero habitual.</p><button className="primary-button" type="button" onClick={() => edit()}><Plus size={17} /> Crear primer banner</button></section> : <div className="retail-banner-list">{rows.map((banner) => <article key={banner.id}><picture>{banner.desktop_image_url && <source media="(min-width: 768px)" srcSet={banner.desktop_image_url} />}<img src={banner.mobile_image_url} alt="" onError={imageFallback} /></picture><div><strong>{banner.title}</strong><span>{banner.subtitle || 'Sin subtitulo'}</span><small>{banner.target_url || 'Sin destino'} · Orden {banner.sort_order}</small></div><AdminStatusBadge tone={banner.is_active ? 'success' : 'neutral'}>{banner.is_active ? 'Activo' : 'Inactivo'}</AdminStatusBadge><div className="retail-category-actions"><button className="secondary-button" type="button" onClick={() => edit(banner)}><Edit3 size={15} /> Editar</button><button className="secondary-button" type="button" onClick={() => toggle(banner)}><Power size={15} /> {banner.is_active ? 'Desactivar' : 'Activar'}</button><button className="secondary-button danger-action" type="button" onClick={() => remove(banner)}><Trash2 size={15} /> Eliminar</button></div></article>)}</div>}
    {open && <div className="ax-modal-backdrop"><form className="ax-status-modal retail-banner-modal" role="dialog" aria-modal="true" onSubmit={submit}><header><h2>{form.id ? 'Editar banner' : 'Nuevo banner'}</h2><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20} /></button></header><div className="form-grid"><label>Titulo *<input required maxLength="120" value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} /></label><label>Subtitulo<input maxLength="220" value={form.subtitle} onChange={(event) => setForm((value) => ({ ...value, subtitle: event.target.value }))} /></label><label>Texto del boton<input maxLength="60" value={form.button_text} onChange={(event) => setForm((value) => ({ ...value, button_text: event.target.value }))} placeholder="Ver productos" /></label><label>Destino<input value={form.target_url} onChange={(event) => setForm((value) => ({ ...value, target_url: event.target.value }))} placeholder="/productos" /><small>Ruta interna /productos o URL https:// segura.</small></label><label>Orden<input type="number" step="1" value={form.sort_order} onChange={(event) => setForm((value) => ({ ...value, sort_order: event.target.value }))} /></label><label className="checkbox-label"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((value) => ({ ...value, is_active: event.target.checked }))} /> Activo</label><BannerImageField required label="Imagen mobile" value={form.mobile_image_url} onChange={(mobile_image_url) => setForm((value) => ({ ...value, mobile_image_url }))} recommendation="Recomendado: 1200 x 800 px." /><BannerImageField label="Imagen desktop" value={form.desktop_image_url} onChange={(desktop_image_url) => setForm((value) => ({ ...value, desktop_image_url }))} recommendation="Opcional. Recomendado: 1600 x 600 px." /></div><div className="ax-modal-actions"><button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" disabled={saving} type="submit">{saving ? 'Guardando...' : 'Guardar banner'}</button></div></form></div>}
  </div>
}
