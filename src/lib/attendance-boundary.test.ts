import { describe, expect, it, vi } from 'vitest'

/* ------------------------------------------------------------------ */
/* Pure check-in boundary logic (the rules enforced by the attendance   */
/* Edge Function / DB constraints). These are tested directly so the    */
/* suite runs without live Supabase credentials.                       */
/* ------------------------------------------------------------------ */

type Policy = {
  morning_open_time: string   // "HH:MM" Lagos time
  morning_close_time: string  // "HH:MM" Lagos time
  on_time_threshold_minutes: number
  grace_period_minutes: number
  working_days: number[]      // getDay() values: 0=Sun ... 6=Sat
}

type CalendarEntry = {
  date: string           // YYYY-MM-DD
  is_workday: boolean
  label: string | null
}

function parseHM(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number)
  return { h, m }
}

function toMinutes(t: string): number {
  const { h, m } = parseHM(t)
  return h * 60 + m
}

/** Is the given Lagos moment inside the allowed check-in window? */
export function isWithinCheckInWindow(
  nowLagos: Date,
  openTime: string,
  closeTime: string,
  graceMinutes: number,
): boolean {
  const nowMins = nowLagos.getHours() * 60 + nowLagos.getMinutes()
  const openMins = toMinutes(openTime)
  const closeMins = toMinutes(closeTime) + graceMinutes
  return nowMins >= openMins && nowMins <= closeMins
}

/** Is the given date a workday? Calendar overrides the weekday default. */
export function isWorkDay(
  dateStr: string,
  workingDays: number[],
  calendar: CalendarEntry[],
): boolean {
  const override = calendar.find((c) => c.date === dateStr)
  if (override) return override.is_workday
  const day = new Date(dateStr).getDay()
  return workingDays.includes(day)
}

/** Compute attendance status from check-in time vs policy threshold. */
export function computeStatus(
  checkInAt: string,
  openTime: string,
  thresholdMinutes: number,
): 'on_time' | 'late' {
  const openMins = toMinutes(openTime)
  const [hh, mm] = checkInAt.slice(11, 16).split(':').map(Number)
  const ciMins = hh * 60 + mm
  return ciMins <= openMins + thresholdMinutes ? 'on_time' : 'late'
}

describe('attendance boundary — check-in window', () => {
  const policy: Policy = {
    morning_open_time: '08:00',
    morning_close_time: '09:00',
    on_time_threshold_minutes: 15,
    grace_period_minutes: 15,
    working_days: [1, 2, 3, 4, 5], // Mon–Fri
  }

  const monday = '2026-11-09'   // Monday
  const saturday = '2026-11-07' // Saturday
  const sunday = '2026-11-08'   // Sunday

  it('allows check-in between 08:00 and 09:00 Lagos time', () => {
    // 08:30 Lagos
    expect(isWithinCheckInWindow(new Date('2026-11-09T07:30:00Z'), '08:00', '09:00', 0)).toBe(true)
    // 09:00 exactly (Lagos = 08:00Z)
    expect(isWithinCheckInWindow(new Date('2026-11-09T08:00:00Z'), '08:00', '09:00', 0)).toBe(true)
  })

  it('blocks check-in before 08:00 Lagos time', () => {
    // 07:59 Lagos
    expect(isWithinCheckInWindow(new Date('2026-11-09T06:59:00Z'), '08:00', '09:00', 0)).toBe(false)
    // 07:00 Lagos
    expect(isWithinCheckInWindow(new Date('2026-11-09T06:00:00Z'), '08:00', '09:00', 0)).toBe(false)
  })

  it('blocks check-in after 09:00 unless within grace period', () => {
    // 09:10 Lagos — inside 15 min grace
    expect(isWithinCheckInWindow(new Date('2026-11-09T08:10:00Z'), '08:00', '09:00', 15)).toBe(true)
    // 09:20 Lagos — outside grace
    expect(isWithinCheckInWindow(new Date('2026-11-09T08:20:00Z'), '08:00', '09:00', 15)).toBe(false)
    // no grace: 09:01 blocked
    expect(isWithinCheckInWindow(new Date('2026-11-09T09:01:00Z'), '08:00', '09:00', 0)).toBe(false)
  })

  it('detects weekend / non-workdays', () => {
    expect(isWorkDay(saturday, policy.working_days, [])).toBe(false)
    expect(isWorkDay(sunday, policy.working_days, [])).toBe(false)
    expect(isWorkDay(monday, policy.working_days, [])).toBe(true)
  })

  it('respects working_calendar holiday overrides', () => {
    const calendar: CalendarEntry[] = [
      { date: '2026-12-25', is_workday: false, label: 'Christmas Day' }, // Friday normally
      { date: '2026-12-26', is_workday: true, label: 'Boxing Day' },     // Saturday normally
    ]
    // Friday 2026-12-25 would be a workday by weekday, but calendar says holiday
    expect(isWorkDay('2026-12-25', policy.working_days, calendar)).toBe(false)
    // Saturday 2026-12-26 would be a weekend, but calendar says workday
    expect(isWorkDay('2026-12-26', policy.working_days, calendar)).toBe(true)
  })

  it('calculates late status using on_time_threshold_minutes', () => {
    // 08:10 check-in, threshold 15 => on time (08:10 <= 08:15)
    expect(computeStatus('2026-11-09T08:10:00Z', '08:00', 15)).toBe('on_time')
    // 08:20 check-in => late
    expect(computeStatus('2026-11-09T08:20:00Z', '08:00', 15)).toBe('late')
    // exactly at threshold boundary
    expect(computeStatus('2026-11-09T08:15:00Z', '08:00', 15)).toBe('on_time')
  })
})

/* ------------------------------------------------------------------ */
/* Supabase-mocked integration tests (policy + calendar lookups).      */
/* These do NOT hit a live DB; @/lib/supabase is mocked below.         */
/* ------------------------------------------------------------------ */

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'

const mockedSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> }

function stubPolicyAndCalendar(policyRow: any, calendarRows: any[]) {
  ;(mockedSupabase.from as any).mockImplementation((table: string) => {
    const select = vi.fn().mockReturnThis()
    const eq = vi.fn().mockReturnThis()
    const single = vi.fn()
    const order = vi.fn().mockReturnThis()

    if (table === 'attendance_policy') {
      single.mockResolvedValue({ data: policyRow, error: null })
    } else if (table === 'working_calendar') {
      order.mockResolvedValue({ data: calendarRows, error: null })
    }

    return { select, eq, single, order }
  })
}

describe('attendance boundary — supabase-mocked lookups', () => {
  it('fetches policy and enforces the window', async () => {
    stubPolicyAndCalendar(
      { morning_open_time: '08:00', morning_close_time: '09:00', grace_period_minutes: 15, working_days: [1,2,3,4,5] },
      [],
    )

    const { data: policy } = await mockedSupabase.from('attendance_policy').select('*').single()
    const { data: calendar } = await mockedSupabase.from('working_calendar').select('*').order('date', { ascending: true })

    expect(policy.morning_open_time).toBe('08:00')
    expect(calendar).toEqual([])
    // 07:30Z = 08:30 Lagos (UTC+1), inside the 08:00–09:00 window
    expect(isWithinCheckInWindow(new Date('2026-11-09T07:30:00Z'), policy.morning_open_time, '09:00', policy.grace_period_minutes)).toBe(true)
  })

  it('flags a holiday from working_calendar so check-in is disallowed', async () => {
    stubPolicyAndCalendar(
      { morning_open_time: '08:00', morning_close_time: '09:00', grace_period_minutes: 0, working_days: [1,2,3,4,5] },
      [{ date: '2026-12-25', is_workday: false, label: 'Christmas' }],
    )

    const { data: calendar } = await mockedSupabase.from('working_calendar').select('*').order('date', { ascending: true })
    const entry = calendar.find((c: any) => c.date === '2026-12-25')
    expect(entry?.is_workday).toBe(false)
    expect(isWorkDay('2026-12-25', [1,2,3,4,5], calendar)).toBe(false)
  })
})
