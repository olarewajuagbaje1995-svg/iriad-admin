const LAGOS_TZ = 'Africa/Lagos'

export function toLagos(date: Date | string): Date {
  return new Date(new Date(date).toLocaleString('en-US', { timeZone: LAGOS_TZ }))
}

export function formatLagos(date: Date | string, fmt: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }): string {
  return new Intl.DateTimeFormat('en-NG', { timeZone: LAGOS_TZ, ...fmt }).format(new Date(date))
}

export function lagosToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: LAGOS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function isLagosWorkday(date: Date | string): boolean {
  const d = toLagos(date)
  const day = d.getDay()
  return day >= 1 && day <= 5
}

export function relativeTimeAgo(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const secs = Math.floor((now.getTime() - then.getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

export function parseLagosDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function isSameLagosDay(a: Date | string, b: Date | string): boolean {
  return new Intl.DateTimeFormat('en-CA', { timeZone: LAGOS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(a)) ===
    new Intl.DateTimeFormat('en-CA', { timeZone: LAGOS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(b))
}

export { LAGOS_TZ }
