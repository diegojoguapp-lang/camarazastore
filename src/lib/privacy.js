export function normalizePhone(value) {
  return String(value || '').replace(/\D+/g, '')
}

export function maskPhone(value) {
  const phone = normalizePhone(value)
  if (!phone) return '-'
  if (phone.length <= 4) return '****'
  return `${phone.slice(0, 2)}** *** *${phone.slice(-2)}`
}
