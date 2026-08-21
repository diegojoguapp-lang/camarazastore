import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Plus, Send } from 'lucide-react'
import { AdminDataTable, AdminMetric, AdminModal, AdminPageHeader, AdminStatusBadge, DateCell, FilterToolbar, MoneyCell, RowActions } from '../../components/AdminUX'
import { createCommissionBatch, getCommissionBatches, getResellerCommissionDetail, getResellerCommissionOverview, getSundayCommissionWarnings } from '../../lib/adminCommissionsApi'
import { getCurrentCommissionPeriod, formatDatePy } from '../../lib/dateUtils'
import { formatGs } from '../../lib/utils'

const emptyFilters = { period: 'this_week', date_from: '', date_to: '' }

function dayName(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('es-PY', { weekday: 'long', timeZone: 'America/Asuncion' }).format(new Date(value))
}

function shortDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('es-PY', { day: '2-digit', month: '2-digit', timeZone: 'America/Asuncion' }).format(new Date(value))
}

function maskAccount(value) {
  const clean = String(value || '').replace(/\s+/g, '')
  if (!clean) return ''
  return `****${clean.slice(-4)}`
}

function whatsappUrl(summary, details) {
  const phone = String(summary.reseller_phone || '').replace(/\D/g, '')
  if (!phone) return ''
  const lines = details.slice(0, 20).map((item) => `${shortDate(item.delivered_at)} - ${item.product_name} - ${formatGs(item.line_commission)}`)
  const message = [
    '*Resumen de comision*',
    '',
    `Hola ${summary.reseller_name || ''}, este es tu resumen:`,
    '',
    `Periodo: ${summary.period_label || 'seleccionado'}`,
    '',
    ...lines,
    '',
    `*Total: ${formatGs(summary.pending_commission)}*`,
    '',
    'Cuenta:',
    summary.bank_name || 'Sin cuenta configurada',
    maskAccount(summary.bank_alias || summary.bank_account_number),
    '',
    'Camaraza Store'
  ].join('\n')
  return `https://wa.me/${phone.startsWith('595') ? phone : `595${phone.replace(/^0/, '')}`}?text=${encodeURIComponent(message)}`
}

export function CommissionsAdmin() {
  const [rows, setRows] = useState([])
  const [batches, setBatches] = useState([])
  const [warnings, setWarnings] = useState([])
  const [filters, setFilters] = useState(emptyFilters)
  const [selected, setSelected] = useState(null)
  const [detailRows, setDetailRows] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = async (nextFilters = filters) => {
    try {
      setLoading(true)
      setError('')
      const [overview, batchRows, sundayRows] = await Promise.all([
        getResellerCommissionOverview(nextFilters),
        getCommissionBatches(),
        getSundayCommissionWarnings()
      ])
      setRows(overview)
      setBatches(batchRows)
      setWarnings(sundayRows)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las comisiones.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(emptyFilters) }, [])

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.today += Number(row.today_commission || 0)
    acc.pending += Number(row.pending_commission || 0)
    acc.paidMonth += Number(row.paid_month_commission || 0)
    acc.adjustments += Number(row.pending_adjustments || 0)
    return acc
  }, { today: 0, pending: 0, paidMonth: 0, adjustments: 0 }), [rows])

  const createCurrentBatch = async () => {
    try {
      setCreating(true)
      setError('')
      setMessage('')
      await createCommissionBatch(getCurrentCommissionPeriod(), 'Cierre semanal de comisiones')
      setMessage('Lote creado correctamente.')
      load(filters)
    } catch (err) {
      setError(err.message || 'No se pudo crear el lote. Puede que ya exista para este periodo.')
    } finally {
      setCreating(false)
    }
  }

  const openDetail = async (row) => {
    try {
      setSelected(row)
      setDetailRows([])
      setDetailLoading(true)
      const details = await getResellerCommissionDetail(row.reseller_id, filters)
      setDetailRows(details)
    } catch (err) {
      setError(err.message || 'No se pudo cargar el detalle del revendedor.')
    } finally {
      setDetailLoading(false)
    }
  }

  const applyFilters = (event) => {
    event?.preventDefault()
    load(filters)
  }

  const detailTotal = detailRows.reduce((sum, row) => sum + Number(row.line_commission || 0), 0)
  const selectedWhatsapp = selected ? whatsappUrl(selected, detailRows) : ''

  const columns = [
    { key: 'reseller', label: 'Revendedor', render: (row) => <div className="ax-title-cell"><strong>{row.reseller_name}</strong><span>{row.reseller_code || '-'} - {row.reseller_phone || 'Sin WhatsApp'}</span></div> },
    { key: 'sales', label: 'Ventas del periodo', align: 'right', render: (row) => `${row.period_sales_count || 0} ventas` },
    { key: 'today', label: 'Comision de hoy', align: 'right', render: (row) => <MoneyCell value={row.today_commission} /> },
    { key: 'pending', label: 'Comision pendiente', align: 'right', render: (row) => <MoneyCell value={row.pending_commission} /> },
    { key: 'bank', label: 'Cuenta', render: (row) => row.has_bank_account ? `${row.bank_name || 'Banco'} ${maskAccount(row.bank_alias || row.bank_account_number)}` : <AdminStatusBadge tone="warning">Sin cuenta</AdminStatusBadge> },
    { key: 'actions', label: 'Acciones', render: (row) => <RowActions><button type="button" onClick={() => openDetail(row)}><Eye size={14} /> Ver</button></RowActions> }
  ]

  const detailColumns = [
    { key: 'date', label: 'Fecha', render: (row) => <DateCell value={row.delivered_at} /> },
    { key: 'day', label: 'Dia', render: (row) => dayName(row.delivered_at) },
    { key: 'product', label: 'Producto', render: (row) => `${row.product_name}${Number(row.quantity || 0) > 1 ? ` x${row.quantity}` : ''}` },
    { key: 'commission', label: 'Comision', align: 'right', render: (row) => <MoneyCell value={row.line_commission} /> },
    { key: 'status', label: 'Estado', render: (row) => row.paid ? <AdminStatusBadge tone="success">Pagado</AdminStatusBadge> : <AdminStatusBadge>Pendiente</AdminStatusBadge> }
  ]

  return (
    <div className="admin-page ax-page ax-commissions-page">
      <AdminPageHeader
        eyebrow="Finanzas"
        title="Comisiones"
        description="Control por revendedor, detalle por producto y pagos con los lotes existentes."
        actions={<button className="primary-button" type="button" onClick={createCurrentBatch} disabled={creating}><Plus size={16} /> {creating ? 'Creando...' : 'Crear lote actual'}</button>}
      />
      {error && <div className="error-box">{error}</div>}
      {message && <div className="toast">{message}</div>}
      {warnings.length > 0 && <div className="warning-box">Hay {warnings.length} venta(s) entregadas en domingo. Domingo no pertenece a ningun periodo de comisiones.</div>}

      <div className="ax-metric-grid">
        <AdminMetric label="Comision generada hoy" value={<MoneyCell value={totals.today} />} />
        <AdminMetric label="Comision pendiente esta semana" value={<MoneyCell value={totals.pending} />} featured />
        <AdminMetric label="Comisiones pagadas este mes" value={<MoneyCell value={totals.paidMonth} />} />
        <AdminMetric label="Ajustes pendientes" value={<MoneyCell value={totals.adjustments} />} />
      </div>

      <FilterToolbar>
        <div className="ax-quick-filters">
          {[['today', 'Hoy'], ['this_week', 'Esta semana'], ['last_week', 'Semana anterior'], ['custom', 'Rango personalizado']].map(([key, label]) => (
            <button key={key} type="button" className={filters.period === key ? 'active' : ''} onClick={() => {
              const next = { ...filters, period: key }
              setFilters(next)
              if (key !== 'custom') load(next)
            }}>{label}</button>
          ))}
        </div>
        {filters.period === 'custom' && (
          <>
            <label>Desde<input type="date" value={filters.date_from} onChange={(event) => setFilters((prev) => ({ ...prev, date_from: event.target.value }))} /></label>
            <label>Hasta<input type="date" value={filters.date_to} onChange={(event) => setFilters((prev) => ({ ...prev, date_to: event.target.value }))} /></label>
            <button className="secondary-button" type="button" onClick={applyFilters}>Aplicar</button>
          </>
        )}
      </FilterToolbar>

      <section className="ax-panel">
        <div className="ax-panel-header">
          <div>
            <h2>Comisiones de vendedores</h2>
            <p>Periodo oficial lunes a sabado. Domingo queda excluido.</p>
          </div>
          <span>{batches.length} lotes registrados</span>
        </div>
        <AdminDataTable columns={columns} rows={rows} loading={loading} empty="No hay comisiones para este periodo." />
      </section>

      <AdminModal
        open={Boolean(selected)}
        title={selected ? `Comisiones - ${selected.reseller_name}` : 'Comisiones'}
        size="xl"
        onClose={() => setSelected(null)}
        footer={(
          <>
            {selectedWhatsapp && <a className="secondary-button" href={selectedWhatsapp} target="_blank" rel="noreferrer"><Send size={16} /> Enviar resumen por WhatsApp</a>}
            <Link className={`primary-button ${!selected?.can_pay ? 'disabled-link' : ''}`} to="/admin/comisiones/pagos">Pagar comision</Link>
          </>
        )}
      >
        {selected && (
          <div className="ax-commission-detail">
            <div className="ax-metric-grid">
              <AdminMetric label="Ventas totales" value={selected.period_sales_count || 0} />
              <AdminMetric label="Comision del periodo" value={<MoneyCell value={detailTotal || selected.pending_commission} />} featured />
              <AdminMetric label="Ajustes" value={<MoneyCell value={selected.pending_adjustments} />} />
              <AdminMetric label="Total pendiente" value={<MoneyCell value={selected.pending_commission} />} />
            </div>
            <div className="ax-commission-info-grid">
              <section>
                <h3>Cuenta para transferir</h3>
                {selected.has_bank_account ? (
                  <>
                    <p><strong>Banco:</strong> {selected.bank_name || '-'}</p>
                    <p><strong>Numero:</strong> {selected.bank_alias || selected.bank_account_number || '-'}</p>
                    <p><strong>Titular:</strong> {selected.bank_holder || '-'}</p>
                  </>
                ) : <p>Sin cuenta bancaria configurada</p>}
              </section>
              <section>
                <h3>Contacto</h3>
                <p><strong>WhatsApp:</strong> {selected.reseller_phone || '-'}</p>
                <p><strong>Estado de pago:</strong> {selected.can_pay ? 'Listo para pagar' : selected.reason || 'No disponible'}</p>
              </section>
            </div>
            <AdminDataTable columns={detailColumns} rows={detailRows} loading={detailLoading} empty="No hay ventas entregadas para este revendedor." />
            <div className="ax-table-total"><span>TOTAL</span><strong>{formatGs(detailTotal)}</strong></div>
          </div>
        )}
      </AdminModal>
    </div>
  )
}
