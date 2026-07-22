const pyTimeZone = 'America/Asuncion'

function getParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: pyTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value)
  }
}

function paraguayMidnightUtc(date) {
  const { year, month, day } = getParts(date)
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0))
}

export function getCurrentCommissionPeriod(now = new Date()) {
  const todayStart = paraguayMidnightUtc(now)
  const day = todayStart.getUTCDay()
  const daysSinceSaturday = (day + 1) % 7
  const start = new Date(todayStart)
  start.setUTCDate(start.getUTCDate() - daysSinceSaturday)

  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 7)
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1)

  return { start, end }
}

export function formatDatePy(value, options = { dateStyle: 'short' }) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('es-PY', { timeZone: pyTimeZone, ...options }).format(new Date(value))
}

export function formatDateTimePy(value) {
  return formatDatePy(value, { dateStyle: 'short', timeStyle: 'short' })
}

export function toDateInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}
