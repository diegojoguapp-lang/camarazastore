import { Link } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { formatDatePy } from '../lib/dateUtils'
import { formatGs } from '../lib/utils'

export function AdminPageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="ax-page-header">
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="ax-actions">{actions}</div>}
    </header>
  )
}

export function AdminMetric({ label, value, hint, featured = false }) {
  return (
    <article className={`ax-metric ${featured ? 'featured' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <p>{hint}</p>}
    </article>
  )
}

export function AdminStatusBadge({ children, tone = 'neutral' }) {
  return <span className={`ax-status tone-${tone}`}>{children}</span>
}

export function FilterToolbar({ children, actions }) {
  return (
    <div className="ax-toolbar">
      <div>{children}</div>
      {actions && <div className="ax-toolbar-actions">{actions}</div>}
    </div>
  )
}

export function AdminDataTable({ columns, rows, loading, empty, getKey }) {
  return (
    <div className="ax-table-wrap">
      {loading && <div className="ax-table-loading">Cargando...</div>}
      {!loading && !!rows.length && (
        <table className="ax-table">
          <thead>
            <tr>{columns.map((column) => <th className={column.align === 'right' ? 'right' : ''} key={column.key}>{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={getKey ? getKey(row) : row.id || index}>
                {columns.map((column) => <td className={column.align === 'right' ? 'right' : ''} key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && !rows.length && <div className="ax-empty">{empty || 'Sin resultados.'}</div>}
    </div>
  )
}

export function RowActions({ children }) {
  return <div className="ax-row-actions">{children}<MoreHorizontal size={15} aria-hidden="true" /></div>
}

export function MoneyCell({ value }) {
  return <span className="ax-money">{formatGs(value)}</span>
}

export function DateCell({ value }) {
  return <span>{formatDatePy(value)}</span>
}

export function Drawer({ open, title, children, onClose }) {
  if (!open) return null
  return (
    <div className="ax-drawer-backdrop" role="presentation">
      <aside className="ax-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar">Cerrar</button>
        </header>
        {children}
      </aside>
    </div>
  )
}

export function StickySummary({ title, items, children }) {
  return (
    <aside className="ax-sticky-summary">
      <h2>{title}</h2>
      <div className="ax-summary-list">
        {items.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      {children}
    </aside>
  )
}

export function InlineLink({ to, children }) {
  return <Link className="ax-inline-link" to={to}>{children}</Link>
}
