import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { formatDatePy } from '../lib/dateUtils'
import { formatGs } from '../lib/utils'
import { deliveryLine, humanActivity, orderStatusMeta, shortOrderId } from '../lib/resellerDisplay'

export function CompactPageHeader({ profile, title = 'Inicio', subtitle, action }) {
  const initials = (profile?.full_name || profile?.email || 'R').slice(0, 2).toUpperCase()
  return (
    <header className="rx-header">
      <div className="rx-avatar">{initials}</div>
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {profile?.reseller_code && <span>{profile.reseller_code}</span>}
      </div>
      {profile && <b className={`rx-account-dot ${profile.is_active ? 'active' : ''}`}>{profile.is_active ? 'Activo' : 'Inactivo'}</b>}
      {action}
    </header>
  )
}

export function CompactMetricCard({ label, value, hint, featured = false }) {
  return (
    <article className={`rx-metric ${featured ? 'featured' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <p>{hint}</p>}
    </article>
  )
}

export function StatusDot({ status }) {
  const meta = orderStatusMeta(status)
  return <span className={`rx-status-dot tone-${meta.tone}`} aria-label={meta.label} />
}

export function StatusBadge({ status }) {
  const meta = orderStatusMeta(status)
  return <span className={`rx-status-badge tone-${meta.tone}`}><StatusDot status={status} />{meta.label}</span>
}

export function OrderListItem({ sale, to }) {
  const target = to || `/panel/ventas/${sale.id}`
  return (
    <Link className="rx-order-row" to={target}>
      <div className="rx-order-top">
        <span><StatusDot status={sale.status} /> Orden {shortOrderId(sale.id)}</span>
        <strong>{formatGs(sale.total_collected || sale.product_sale_price)}</strong>
      </div>
      <h2>{sale.product_name_snapshot}</h2>
      <p>{sale.customer_name || 'Cliente'} {sale.customer_phone_masked ? `- ${sale.customer_phone_masked}` : ''}</p>
      <div className="rx-order-meta">
        <StatusBadge status={sale.status} />
        <small>{deliveryLine(sale)}</small>
      </div>
    </Link>
  )
}

export function SettingsRow({ icon: Icon, label, detail, to, onClick, danger = false }) {
  const content = (
    <>
      {Icon && <Icon size={18} />}
      <span><strong>{label}</strong>{detail && <small>{detail}</small>}</span>
      <ArrowRight size={16} />
    </>
  )
  if (to) return <Link className={`rx-settings-row ${danger ? 'danger' : ''}`} to={to}>{content}</Link>
  if (onClick) return <button className={`rx-settings-row ${danger ? 'danger' : ''}`} type="button" onClick={onClick}>{content}</button>
  return <div className={`rx-settings-row ${danger ? 'danger' : ''}`}>{content}</div>
}

export function SegmentedTabs({ value, onChange, tabs }) {
  return (
    <div className="rx-tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.value} type="button" className={value === tab.value ? 'active' : ''} onClick={() => onChange(tab.value)}>
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function ActivityListItem({ item }) {
  const display = humanActivity(item)
  return (
    <article className="rx-activity-row">
      <span className="rx-activity-mark" />
      <div>
        <strong>{display.title}</strong>
        {display.detail && <p>{display.detail}</p>}
        <small>{formatDatePy(item.created_at || item.date, { dateStyle: 'short', timeStyle: 'short' })}</small>
      </div>
      {display.amount && <b>{typeof display.amount === 'number' ? formatGs(display.amount) : display.amount}</b>}
    </article>
  )
}

export function OrderTimeline({ sale }) {
  const statusOrder = ['pending_contact', 'confirmed', 'preparing', 'out_for_delivery', 'delivered_paid']
  const currentIndex = statusOrder.indexOf(sale?.status)
  const dates = {
    pending_contact: sale?.created_at,
    delivered_paid: sale?.delivered_at
  }

  return (
    <div className="rx-timeline">
      {statusOrder.map((status, index) => {
        const meta = orderStatusMeta(status)
        const complete = currentIndex >= index
        return (
          <div className={complete ? 'complete' : ''} key={status}>
            <span className={`rx-status-dot tone-${meta.tone}`} />
            <strong>{meta.label}</strong>
            {dates[status] && <small>{formatDatePy(dates[status], { dateStyle: 'short', timeStyle: 'short' })}</small>}
          </div>
        )
      })}
    </div>
  )
}
