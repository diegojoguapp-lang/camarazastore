const timezone = 'America/Asuncion'
export { saleCode as orderCode } from './businessOperations.js'

export function businessDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  return ['year', 'month', 'day'].map((key) => parts.find((part) => part.type === key).value).join('-')
}

export function shiftDate(date, days) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function operationRange(period, today = businessDate()) {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7
  const monday = shiftDate(today, 1 - weekday)
  if (period === 'today') return { from: today, to: today }
  if (period === 'this_week') return { from: monday, to: shiftDate(monday, 6) }
  if (period === 'last_week') return { from: shiftDate(monday, -7), to: shiftDate(monday, -1) }
  if (period === 'month') {
    const end = new Date(`${today.slice(0, 7)}-01T12:00:00Z`)
    end.setUTCMonth(end.getUTCMonth() + 1)
    end.setUTCDate(0)
    return { from: `${today.slice(0, 7)}-01`, to: end.toISOString().slice(0, 10) }
  }
  return { from: '', to: '' }
}

export function changeDue(total, tendered) {
  if (tendered === '' || tendered === null || tendered === undefined) return null
  const amount = Number(tendered)
  if (!Number.isFinite(amount) || amount < Number(total)) throw new Error('El efectivo recibido debe cubrir el total a cobrar.')
  return amount - Number(total)
}

export function customerWhatsApp(phone) {
  let digits = String(phone || '').replace(/\D/g, '').replace(/^00/, '')
  if (digits.startsWith('0')) digits = `595${digits.slice(1)}`
  else if (digits.startsWith('9') && digits.length === 9) digits = `595${digits}`
  return /^595\d{9}$/.test(digits) ? `https://wa.me/${digits}` : null
}
