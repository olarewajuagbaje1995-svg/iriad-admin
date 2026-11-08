import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type WeeklyReport = Database['public']['Tables']['weekly_reports']['Row']
type MonthlyReport = Database['public']['Tables']['monthly_reports']['Row']

export function useReports(reportType: 'weekly' | 'monthly' = 'weekly') {
  const [reports, setReports] = useState<(WeeklyReport | MonthlyReport)[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const table = reportType === 'weekly' ? 'weekly_reports' : 'monthly_reports'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from(table)
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(50)
      setReports((data ?? []) as (WeeklyReport | MonthlyReport)[])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [table])

  useEffect(() => { load() }, [load, table])

  const createReport = async (report: Partial<WeeklyReport | MonthlyReport>) => {
    const { data, error: err } = await supabase
      .from(table)
      .insert([{ ...report, status: 'draft' }])
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

  return { reports, loading, error, createReport, submitReport, refresh: load }
}
