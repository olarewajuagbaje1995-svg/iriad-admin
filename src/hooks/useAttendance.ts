import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { lagosToday } from '@/lib/dates'
import type { Database } from '@/types/database'

type Attendance = Database['public']['Tables']['attendance']['Row']

export function useAttendance() {
  const [records, setRecords] = useState<Attendance[]>([])
  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .order('attendance_date', { ascending: false })
        .limit(50)
      setRecords(data ?? [])
      const today = lagosToday()
      setTodayRecord((data ?? []).find((r) => r.attendance_date === today) ?? null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /** Check in via the attendance-control Edge Function (server-enforced window, service-role insert). */
  const checkIn = async (type: Attendance['attendance_type'] = 'office') => {
    const today = lagosToday()
    if (todayRecord) {
      setError('Already checked in today')
      return null
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke('attendance-control', {
        body: { action: 'check_in', attendance_type: type, work_date: today },
      })
      if (fnError) throw fnError
      if (data?.error) {
        setError(data.error)
        return null
      }
      setTodayRecord(data.attendance)
      setRecords([data.attendance, ...records])
      return data.attendance
    } catch (fnErr: any) {
      setError(fnErr.message || 'Check-in failed')
      return null
    }
  }

  /** Sign out via the attendance-control Edge Function (server-enforced window, service-role update). */
  const checkOut = async () => {
    if (!todayRecord) {
      setError('No check-in record for today')
      return null
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke('attendance-control', {
        body: { action: 'sign_out', work_date: todayRecord.attendance_date },
      })
      if (fnError) throw fnError
      if (data?.error) {
        setError(data.error)
        return null
      }
      setTodayRecord(data.attendance)
      return data.attendance
    } catch (fnErr: any) {
      setError(fnErr.message || 'Sign-out failed')
      return null
    }
  }

  /** Fetch today's record + window state from the Edge Function. */
  const getStatus = async (work_date?: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('attendance-control', {
        body: { action: 'get_status', work_date },
      })
      if (fnError) throw fnError
      if (data?.error) {
        setError(data.error)
        return null
      }
      return data
    } catch (fnErr: any) {
      setError(fnErr.message || 'Failed to load status')
      return null
    }
  }

  return { records, todayRecord, loading, error, checkIn, checkOut, getStatus, refresh: load }
}
