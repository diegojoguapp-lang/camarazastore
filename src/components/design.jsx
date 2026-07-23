import { Search } from 'lucide-react'
import { formatDatePy } from '../lib/dateUtils'
import { formatGs } from '../lib/utils'
import { saleStatusLabel } from '../lib/salesConstants'
import { paymentStatusLabel } from '../lib/commissionConstants'

export function PageHeader({ eyebrow, title, description, actions, meta }) {
  return (
    <header className="ds-page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {meta && <div className="ds-header-meta">{meta}</div>}
      </div>
      {actions && <div className="ds-header-actions">{actions}</div>}
    </header>
  )
}

export function SectionHeader({ title, description, action }) {
  return (
    <div className="ds-section-header">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function MetricCard({ label, value, hint, icon: Icon, featured = false, tone = 'neutral' }) {
  return (
    <article className={`ds-metric-card ${featured ? 'is-featured' : ''} tone-${tone}`}>
      {Icon && <span className="ds-icon"><Icon size={20} /></span>}
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <p>{hint}</p>}
    </article>
  )
}

export function StatusBadge({ type = 'sale', status }) {
  const label = type === 'payment' ? paymentStatusLabel(status) : saleStatusLabel(status)
  return <span className={`ds-status-badge status-${status}`}>{label}</span>
}

export function EmptyState({ title = 'Sin resultados', description, action }) {
  return (
    <div className="ds-empty-state">
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}

export function SkeletonCard() {
  return <div className="ds-skeleton-card"><span /><strong /><p /></div>
}

export function SkeletonTable({ rows = 5 }) {
  return <div className="ds-skeleton-table">{Array.from({ length: rows }).map((_, index) => <span key={index} />)}</div>
}

export function SearchInput({ value, onChange, placeholder = 'Buscar', minLabel = '' }) {
  return (
    <label className="ds-search-input" aria-label={placeholder}>
      <Search size={18} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      {minLabel && <small>{minLabel}</small>}
    </label>
  )
}

export function ProgressBar({ value, max = 100 }) {
  const pct = max > 0 ? Math.min(Math.max((Number(value || 0) / Number(max)) * 100, 0), 100) : 0
  return <div className="ds-progress"><span style={{ width: `${pct}%` }} /></div>
}

export function MoneyDisplay({ value }) {
  return <>{formatGs(value)}</>
}

export function DateDisplay({ value, options }) {
  return <>{formatDatePy(value, options)}</>
}

export function Timeline({ items = [] }) {
  return (
    <div className="ds-timeline">
      {items.map((item) => (
        <article key={item.id || `${item.title}-${item.date}`}>
          <span className="ds-timeline-dot" />
          <div>
            <strong>{item.title}</strong>
            {item.detail && <p>{item.detail}</p>}
            <small>{formatDatePy(item.date, { dateStyle: 'short', timeStyle: 'short' })}</small>
          </div>
          {item.amount !== undefined && <b>{formatGs(item.amount)}</b>}
        </article>
      ))}
    </div>
  )
}

export function DataTable({ columns, rows, getKey }) {
  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={getKey ? getKey(row) : row.id || index}>
              {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
