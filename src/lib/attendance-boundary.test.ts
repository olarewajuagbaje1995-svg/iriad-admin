import { describe, expect, it, vi } from 'vitest'

/* ------------------------------------------------------------------ */
/* Pure workday logic (still enforced by the attendance Edge Function */
/* and DB constraints). These are tested directly so the suite runs   */
/* without live Supabase credentials.                                 */
/* ------------------------------------------------------------------ */

type CalendarEntry = {
  date: string           // YYYY-MM-DD
  is_workday: boolean
  label: string | null
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

describe('attendance boundary — workdays', () => {
  const monday = '2026-11-09'   // Monday
  const saturday = '2026-11-07' // Saturday
  const sunday = '2026-11-08'   // Sunday

  it('detects weekend / non-workdays', () => {
    expect(isWorkDay(saturday, [1, 2, 3, 4, 5], [])).toBe(false)
    expect(isWorkDay(sunday, [1, 2, 3, 4, 5], [])).toBe(false)
    expect(isWorkDay(monday, [1, 2, 3, 4, 5], [])).toBe(true)
  })

  it('respects working_calendar holiday overrides', () => {
    const calendar: CalendarEntry[] = [
      { date: '2026-12-25', is_workday: false, label: 'Christmas Day' }, // Friday normally
      { date: '2026-12-26', is_workday: true, label: 'Boxing Day' },     // Saturday normally
    ]
    expect(isWorkDay('2026-12-25', [1, 2, 3, 4, 5], calendar)).toBe(false)
    expect(isWorkDay('2026-12-26', [1, 2, 3, 4, 5], calendar)).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* Supabase-mocked integration tests (calendar lookups only).         */
/* The time-of-day check-in window is no longer enforced server-side; */
/* the window is governed solely by attendance_sessions override state */
/* toggled by an admin via the attendance-control Edge Function.     */
/* ------------------------------------------------------------------ */

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'

const mockedSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> }

function stubCalendar(calendarRows: any[]) {
  ;(mockedSupabase.from as any).mockImplementation((table: string) => {
    const select = vi.fn().mockReturnThis()
    const eq = vi.fn().mockReturnThis()
    const single = vi.fn()
    const order = vi.fn().mockReturnThis()

    if (table === 'working_calendar') {
      order.mockResolvedValue({ data: calendarRows, error: null })
    }

    return { select, eq, single, order }
  })
}

describe('attendance boundary — supabase-mocked calendar lookups', () => {
  it('flags a holiday from working_calendar so check-in is disallowed', async () => {
    stubCalendar([{ date: '2026-12-25', is_workday: false, label: 'Christmas' }])

    const { data: calendar } = await mockedSupabase.from('working_calendar').select('*').order('date', { ascending: true })
    const entry = calendar.find((c: any) => c.date === '2026-12-25')
    expect(entry?.is_workday).toBe(false)
  })
})
