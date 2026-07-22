const pyTimeZone = 'America/Asuncion'
const dayMs = 24 * 60 * 60 * 1000

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
  const daysSinceMonday = day === 0 ? 6 : day - 1
  const start = new Date(todayStart)
  start.setUTCDate(start.getUTCDate() - daysSinceMonday)

  const endExclusive = new Date(start.getTime() + 6 * dayMs)

  return { start, endExclusive }
}

export function getNextCommissionPayment(now = new Date()) {
  const todayStart = paraguayMidnightUtc(now)
  const day = todayStart.getUTCDay()
  let paymentDate

  if (day === 0) {
    paymentDate = new Date(todayStart.getTime() + dayMs)
  } else if (day === 1) {
    paymentDate = todayStart
  } else {
    const { endExclusive } = getCurrentCommissionPeriod(now)
    paymentDate = new Date(endExclusive.getTime() + dayMs)
  }

  return {
    date: paymentDate,
    label: 'Pago: lunes de 10:00 a 17:00',
    holidayNote: 'Si el lunes es feriado, se paga el martes en el mismo horario.'
  }
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
