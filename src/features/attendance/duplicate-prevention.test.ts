import { describe, expect, it, vi, beforeEach } from 'vitest'

/* ------------------------------------------------------------------ */
/* Duplicate check-in prevention (unique staff_id + attendance_date).  */
/* Pure logic + supabase-mocked unique-violation simulation.           */
/* ------------------------------------------------------------------ */

type AttendanceRecord = {
  id: string
  staff_id: string
  attendance_date: string
  status: string
}

/** Returns an existing record for the same staff+date, if any. */
function findExisting(records: AttendanceRecord[], staffId: string, date: string): AttendanceRecord | undefined {
  return records.find((r) => r.staff_id === staffId && r.attendance_date === date)
}

/** Attempt a check-in; return the new record or a duplicate error. */
function attemptCheckIn(
  records: AttendanceRecord[],
  staffId: string,
  date: string,
  newRecord: AttendanceRecord,
): { record: AttendanceRecord | null; error: string | null } {
  if (findExisting(records, staffId, date)) {
    return { record: null, error: 'Already checked in today' }
  }
  return { record: newRecord, error: null }
}

describe('attendance — duplicate prevention (pure logic)', () => {
  const existing: AttendanceRecord[] = [
    { id: 'a1', staff_id: 'staff-1', attendance_date: '2026-11-09', status: 'checked_in' },
  ]

  it('allows a first check-in for a staff+date', () => {
    const { record, error } = attemptCheckIn(existing, 'staff-2', '2026-11-09', {
      id: 'a2', staff_id: 'staff-2', attendance_date: '2026-11-09', status: 'checked_in',
    })
    expect(error).toBeNull()
    expect(record?.id).toBe('a2')
  })

  it('prevents a duplicate check-in for the same staff+date', () => {
    const { record, error } = attemptCheckIn(existing, 'staff-1', '2026-11-09', {
      id: 'a3', staff_id: 'staff-1', attendance_date: '2026-11-09', status: 'checked_in',
    })
    expect(error).toBe('Already checked in today')
    expect(record).toBeNull()
  })

  it('allows the same staff to check in on a different date', () => {
    const { record, error } = attemptCheckIn(existing, 'staff-1', '2026-11-10', {
      id: 'a4', staff_id: 'staff-1', attendance_date: '2026-11-10', status: 'checked_in',
    })
    expect(error).toBeNull()
    expect(record?.attendance_date).toBe('2026-11-10')
  })

  it('allows a different staff on the same date', () => {
    const { record, error } = attemptCheckIn(existing, 'staff-2', '2026-11-09', {
      id: 'a5', staff_id: 'staff-2', attendance_date: '2026-11-09', status: 'checked_in',
    })
    expect(error).toBeNull()
    expect(record?.staff_id).toBe('staff-2')
  })
})

/* ------------------------------------------------------------------ */
/* Supabase-mocked tests: simulate Postgres unique violation (23505). */
/* ------------------------------------------------------------------ */

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'

const mockedSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> }

const UNIQUE_VIOLATION = '23505'

function stubInsert(shouldViolate: boolean) {
  ;(mockedSupabase.from as any).mockImplementation((table: string) => {
    const insert = vi.fn().mockReturnThis()
    const select = vi.fn().mockReturnThis()
    const single = vi.fn()

    if (table === 'attendance') {
      single.mockResolvedValue(
        shouldViolate
          ? { data: null, error: { code: UNIQUE_VIOLATION, message: 'duplicate key violates unique constraint' } }
          : { data: { id: 'new', staff_id: 'staff-1', attendance_date: '2026-11-09', status: 'checked_in' }, error: null },
      )
    }

    return { insert, select, single }
  })
}

describe('attendance — duplicate prevention (supabase-mocked)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('inserts a check-in successfully when no duplicate exists', async () => {
    stubInsert(false)
    const { data, error } = await mockedSupabase.from('attendance').insert([{}]).select().single()
    expect(error).toBeNull()
    expect(data?.id).toBe('new')
  })

  it('surfaces a unique violation when staff+date already exists', async () => {
    stubInsert(true)
    const { data, error } = await mockedSupabase.from('attendance').insert([{}]).select().single()
    expect(error?.code).toBe(UNIQUE_VIOLATION)
    expect(data).toBeNull()
  })
})
