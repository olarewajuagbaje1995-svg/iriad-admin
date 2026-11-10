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

  /** Check in via direct client-side insert. Respects the open/closed
   *  check-in window retrieved from attendance_sessions. */
  const checkIn = async (type: Attendance['attendance_type'] = 'office') => {
    const today = lagosToday()
    if (todayRecord) {
      setError('Already checked in today')
      return null
    }

    try {
      // Resolve the acting user's profile for organisation_id + staff_id.
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        setError('Unauthorized')
        return null
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, organisation_id')
        .eq('id', user.id)
        .single()
      if (!profile?.organisation_id) {
        setError('Profile not found')
        return null
      }

      // Check-in window must be open (admin-controlled via attendance_sessions).
      const { data: session } = await supabase
        .from('attendance_sessions')
        .select('morning_open_override, morning_opened_at')
        .eq('work_date', today)
        .maybeSingle()
      if (!session || (!session.morning_open_override && !session.morning_opened_at)) {
        setError('Check-in window not yet opened for today')
        return null
      }

      const checkInAt = new Date().toISOString()
      const { data: attendance, error: attError } = await supabase
        .from('attendance')
        .insert([{
          organisation_id: profile.organisation_id,
          staff_id: user.id,
          attendance_date: today,
          check_in_at: checkInAt,
          attendance_type: type,
          status: 'checked_in',
          is_late: false,
          created_at: checkInAt,
          updated_at: checkInAt,
        }])
        .select()
        .single()

      if (attError) throw attError

      setTodayRecord(attendance)
      setRecords([attendance, ...records])
      return attendance
    } catch (err: any) {
      setError(err.message || 'Check-in failed')
      return null
    }
  }

  /** Sign out via direct client-side update. Respects the open/closed
   *  sign-out window retrieved from attendance_sessions. */
  const checkOut = async () => {
    if (!todayRecord) {
      setError('No check-in record for today')
      return null
    }

    try {
      const today = lagosToday()
      const { data: session } = await supabase
        .from('attendance_sessions')
        .select('sign_out_open_override, sign_out_opened_at')
        .eq('work_date', today)
        .maybeSingle()
      if (!session || (!session.sign_out_open_override && !session.sign_out_opened_at)) {
        setError('Sign-out window is not open yet')
        return null
      }

      const checkOutAt = new Date().toISOString()
      const { data: attendance, error: attError } = await supabase
        .from('attendance')
        .update({
          check_out_at: checkOutAt,
          status: 'checked_out',
          updated_at: checkOutAt,
        })
        .eq('id', todayRecord.id)
        .select()
        .single()

      if (attError) throw attError

      setTodayRecord(attendance)
      return attendance
    } catch (err: any) {
      setError(err.message || 'Sign-out failed')
      return null
    }
  }

  /** Fetch today's record + window state via direct client-side queries. */
  const getStatus = async (work_date?: string) => {
    try {
      const today = work_date ?? lagosToday()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const [sessionRes, recordRes] = await Promise.all([
        supabase
          .from('attendance_sessions')
          .select('morning_open_override, morning_opened_at, sign_out_open_override, sign_out_opened_at')
          .eq('work_date', today)
          .maybeSingle(),
        supabase
          .from('attendance')
          .select('*')
          .eq('staff_id', user.id)
          .eq('attendance_date', today)
          .maybeSingle(),
      ])

      const session = sessionRes.data
      const todayRecord = recordRes.data

      return {
        work_date: today,
        check_in_window_open: !!(
          session?.morning_open_override || session?.morning_opened_at
        ),
        sign_out_window_open: !!(
          session?.sign_out_open_override || session?.sign_out_opened_at
        ),
        today_record: todayRecord ?? null,
        session,
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load status')
      return null
    }
  }

  return { records, todayRecord, loading, error, checkIn, checkOut, getStatus, refresh: load }
}
