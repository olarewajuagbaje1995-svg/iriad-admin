import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { Role } from '@/config/brand'

type WeeklyReport = Database['public']['Tables']['weekly_reports']['Row']
type MonthlyReport = Database['public']['Tables']['monthly_reports']['Row']

interface UseReportsOptions {
  reportType?: 'weekly' | 'monthly'
  userId?: string
  role?: Role
}

export function useReports({ reportType = 'weekly', userId, role }: UseReportsOptions = {}) {
  const [reports, setReports] = useState<(WeeklyReport | MonthlyReport)[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const table = reportType === 'weekly' ? 'weekly_reports' : 'monthly_reports'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from(table)
        .select('*, profiles(full_name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(50)

      // Strict role-based frontend filtering:
      // admin/director see ALL reports from the organization.
      // staff only see reports where they are the author (staff_id).
      if (role === 'staff' && userId) {
        query = query.eq('staff_id', userId)
      }

      const { data } = await query
      setReports((data ?? []) as (WeeklyReport | MonthlyReport)[])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [table, userId, role])

  useEffect(() => { void load() }, [load, table])

  const createReport = async (report: Partial<WeeklyReport | MonthlyReport>) => {
    const { data, error: err } = await supabase
      .from(table)
      .insert([{ ...report, status: 'draft', staff_id: userId ?? undefined }])
      .select()
      .single()
    if (err) { setError(err.message); return null }
    setReports([data, ...reports])
    return data
  }

  const submitReport = async (id: string) => {
    const { data, error: err } = await supabase
      .from(table)
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (err) { setError(err.message); return null }
    setReports(reports.map((r) => (r.id === id ? data : r)))
    return data
  }

  const updateReport = async (id: string, updates: Partial<WeeklyReport | MonthlyReport>) => {
    const { data, error: err } = await supabase
      .from(table)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (err) { setError(err.message); return null }
    setReports(reports.map((r) => (r.id === id ? data : r)))
    return data
  }

  const deleteReport = async (id: string) => {
    const { error: err } = await supabase.from(table).delete().eq('id', id)
    if (err) { setError(err.message); return false }
    setReports(reports.filter((r) => r.id !== id))
    return true
  }

  return { reports, loading, error, createReport, submitReport, updateReport, deleteReport, refresh: load }
}
