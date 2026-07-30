import { useEffect, useMemo, useState } from 'react'
import { Edit2, Plus, Search } from 'lucide-react'
import { AdminDataTable, AdminPageHeader, AdminStatusBadge, Drawer, FilterToolbar, RowActions } from '../../components/AdminUX'
import { getSupplierProductCounts, getSuppliers, saveSupplier, setSupplierActive } from '../../lib/adminInventoryApi'

const emptySupplier = {
  name: '',
  contact_name: '',
  phone: '',
  email: '',
  city: '',
  address: '',
  notes: '',
  is_active: true
}

export function SuppliersAdmin() {
  const [suppliers, setSuppliers] = useState([])
  const [counts, setCounts] = useState({})
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptySupplier)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const [rows, productCounts] = await Promise.all([
        getSuppliers({ includeInactive: true }),
        getSupplierProductCounts()
      ])
      setSuppliers(rows)
      setCounts(productCounts)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los proveedores.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return suppliers
    return suppliers.filter((supplier) => [
      supplier.name,
      supplier.contact_name,
      supplier.phone,
      supplier.email,
      supplier.city
    ].join(' ').toLowerCase().includes(term))
  }, [suppliers, search])

  const openCreate = () => {
    setForm(emptySupplier)
    setDrawerOpen(true)
    setError('')
    setMessage('')
  }

  const openEdit = (supplier) => {
    setForm({ ...emptySupplier, ...supplier })
    setDrawerOpen(true)
    setError('')
    setMessage('')
  }

  const closeDrawer = () => {
    if (saving) return
    setDrawerOpen(false)
    setForm(emptySupplier)
  }

  const submit = async (event) => {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      setMessage('')
      await saveSupplier(form)
      setMessage('Proveedor guardado correctamente.')
      closeDrawer()
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el proveedor.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (supplier) => {
    try {
      setError('')
      setMessage('')
      await setSupplierActive(supplier.id, !supplier.is_active)
      setMessage(supplier.is_active ? 'Proveedor desactivado.' : 'Proveedor activado.')
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el proveedor.')
    }
  }

  const columns = [
    { key: 'name', label: 'Proveedor', render: (supplier) => <strong>{supplier.name}</strong> },
    { key: 'contact_name', label: 'Contacto', render: (supplier) => supplier.contact_name || '-' },
    { key: 'phone', label: 'Telefono', render: (supplier) => supplier.phone || '-' },
    { key: 'email', label: 'Correo', render: (supplier) => supplier.email || '-' },
    { key: 'city', label: 'Ciudad', render: (supplier) => supplier.city || '-' },
    { key: 'products', label: 'Productos', align: 'right', render: (supplier) => counts[supplier.id] || 0 },
    { key: 'status', label: 'Estado', render: (supplier) => supplier.is_active ? <AdminStatusBadge tone="success">Activo</AdminStatusBadge> : <AdminStatusBadge>Inactivo</AdminStatusBadge> },
    { key: 'actions', label: 'Acciones', render: (supplier) => (
      <RowActions>
        <button type="button" onClick={() => openEdit(supplier)}><Edit2 size={14} /> Editar</button>
        <button type="button" onClick={() => toggleActive(supplier)}>{supplier.is_active ? 'Desactivar' : 'Activar'}</button>
      </RowActions>
    ) }
  ]

  return (
    <div className="admin-page ax-page ax-inventory-page">
      <AdminPageHeader
        eyebrow="Catalogo"
        title="Proveedores"
        description="Administracion de proveedores asociados a productos."
        actions={<button className="primary-button" type="button" onClick={openCreate}><Plus size={16} /> Nuevo proveedor</button>}
      />
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}

      <FilterToolbar>
        <label className="ax-search-field"><Search size={15} /><input placeholder="Buscar proveedor" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </FilterToolbar>

      <AdminDataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        empty="Todavia no hay proveedores cargados."
      />

      <Drawer open={drawerOpen} title={form.id ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={closeDrawer}>
        <form className="ax-drawer-form" onSubmit={submit}>
          <label>Nombre *<input value={form.name || ''} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required /></label>
          <label>Persona de contacto<input value={form.contact_name || ''} onChange={(event) => setForm((prev) => ({ ...prev, contact_name: event.target.value }))} /></label>
          <label>Telefono<input value={form.phone || ''} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} /></label>
          <label>Correo<input type="email" value={form.email || ''} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} /></label>
          <label>Ciudad<input value={form.city || ''} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} /></label>
          <label>Direccion<input value={form.address || ''} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} /></label>
          <label>Notas<textarea value={form.notes || ''} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} /></label>
          <label className="checkbox-label"><input type="checkbox" checked={form.is_active !== false} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))} /> Activo</label>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar proveedor'}</button>
        </form>
      </Drawer>
    </div>
  )
}
