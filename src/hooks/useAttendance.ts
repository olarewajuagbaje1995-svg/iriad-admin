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

  const checkIn = async (type: Attendance['attendance_type'] = 'office') => {
    const today = lagosToday()
    if (todayRecord) {
      setError('Already checked in today')
      return null
    }

    // Try server-side Edge Function first (enforces check-in window, holidays, etc.)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('attendance-checkin', {
        body: { attendance_type: type, work_date: today },
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
      // Edge Function not available (e.g. local dev without Supabase) — fall back to direct insert
      // The DB RLS and constraints still enforce rules server-side.
      const { data, error: err } = await supabase
        .from('attendance')
        .insert([{ attendance_date: today, attendance_type: type, status: 'checked_in', check_in_at: new Date().toISOString() }])
        .select()
        .single()
      if (err) {
        setError(err.message)
        return null
      }
      setTodayRecord(data)
      setRecords([data, ...records])
      return data
    }
  }

  const checkOut = async () => {
    if (!todayRecord) {
      setError('No check-in record for today')
      return null
    }
    const { data, error: err } = await supabase
      .from('attendance')
      .update({ check_out_at: new Date().toISOString(), status: 'checked_out' })
      .eq('id', todayRecord.id!)
      .select()
      .single()
    if (err) {
      setError(err.message)
      return null
    }
    setTodayRecord(data)
    return data
  }

  return { records, todayRecord, loading, error, checkIn, checkOut, refresh: load }
}
