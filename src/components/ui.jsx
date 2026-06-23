import { PUBLIC_STATUS } from '../config/site'

const toneClasses = {
  ok:    'bg-oliva/10 text-oliva ring-1 ring-oliva/20',
  info:  'bg-dorado/15 text-[#8a6d2e] ring-1 ring-dorado/30',
  warn:  'bg-[#C8742810] text-[#b4641f] ring-1 ring-[#C8742830]',
  muted: 'bg-tinta/5 text-humo ring-1 ring-tinta/10',
}

export function StatusBadge({ status }) {
  const s = PUBLIC_STATUS[status] || PUBLIC_STATUS.consultar_stock
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[s.tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {s.label}
    </span>
  )
}

export function Spinner({ className = '' }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      role="status"
      aria-label="Cargando"
    />
  )
}
