import { describe, expect, it } from 'vitest'
import {
  formatLagos,
  isLagosWorkday,
  isSameLagosDay,
  lagosToday,
  parseLagosDate,
  relativeTimeAgo,
  toLagos,
} from '@/lib/dates'

describe('dates — Lagos timezone helpers', () => {
  it('lagosToday returns a YYYY-MM-DD string', () => {
    expect(lagosToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('toLagos converts a date to Lagos wall-clock time', () => {
    // 2026-11-07T10:00:00Z is 11:00 WAT (UTC+1)
    const d = toLagos('2026-11-07T10:00:00Z')
    expect(d.getUTCHours()).toBe(10)
    expect(d.getHours()).toBe(11)
  })

  it('formatLagos produces a readable string', () => {
    const out = formatLagos('2026-11-07T10:00:00Z', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    expect(out).toContain('2026')
    expect(out).toContain('November')
    expect(out).toContain('Saturday')
  })

  it('isLagosWorkday treats Monday-Friday as workdays', () => {
    // 2026-11-07 is a Saturday
    expect(isLagosWorkday('2026-11-07')).toBe(false)
    // 2026-11-09 is a Monday
    expect(isLagosWorkday('2026-11-09')).toBe(true)
    // 2026-11-13 is a Friday
    expect(isLagosWorkday('2026-11-13')).toBe(true)
    // 2026-11-08 is a Sunday
    expect(isLagosWorkday('2026-11-08')).toBe(false)
  })

  it('isSameLagosDay compares two dates by Lagos calendar day', () => {
    // Same instant, different representations — same Lagos day
    expect(isSameLagosDay('2026-11-07T10:00:00Z', '2026-11-07T11:00:00Z')).toBe(true)
    // Midnight boundary across UTC but same Lagos day
    expect(isSameLagosDay('2026-11-06T23:00:00Z', '2026-11-07T00:30:00Z')).toBe(true)
    // Different Lagos days
    expect(isSameLagosDay('2026-11-07', '2026-11-08')).toBe(false)
  })

  it('parseLagosDate parses a YYYY-MM-DD string', () => {
    const d = parseLagosDate('2026-11-07')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(10) // November is month index 10
    expect(d.getDate()).toBe(7)
  })

  it('relativeTimeAgo returns human-readable relative strings', () => {
    const now = new Date()
    expect(relativeTimeAgo(now.toISOString())).toBe('just now')
    expect(relativeTimeAgo(new Date(now.getTime() - 90 * 1000).toISOString())).toBe('1 minute ago')
    expect(relativeTimeAgo(new Date(now.getTime() - 90 * 60 * 1000).toISOString())).toBe('1 hour ago')
    expect(relativeTimeAgo(new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString())).toBe('1 day ago')
  })
})
