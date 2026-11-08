import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function ApprovalCentrePage() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const [w, m] = await Promise.all([
        supabase.from('weekly_reports').select('*, profiles(full_name)').in('status', ['submitted', 'revision_requested']).order('updated_at', { ascending: false }),
        supabase.from('monthly_reports').select('*, profiles(full_name)').in('status', ['submitted', 'revision_requested']).order('updated_at', { ascending: false }),
      ])
      setReports([...(w.data ?? []), ...(m.data ?? [])])
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const review = async (id: string, decision: string, isWeekly: boolean) => {
    const table = isWeekly ? 'weekly_reports' : 'monthly_reports'
    await supabase.from(table).update({ status: decision }).eq('id', id)
    await supabase.from('report_reviews').insert([{ weekly_report_id: isWeekly ? id : null, monthly_report_id: isWeekly ? null : id, reviewer_id: (await supabase.auth.getUser()).data.user?.id, decision }])
    load()
  }

  if (loading) return <div className="p-6">Loading approvals…</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Approval Centre</h2>
        <p className="text-sm text-neutral-500">Review and approve submitted weekly and monthly reports.</p>
      </div>

      <div className="card p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-neutral-200 text-neutral-500 text-xs uppercase">
                <th className="pb-3">Staff</th>
                <th className="pb-3">Report</th>
                <th className="pb-3">Period</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-neutral-500">No reports awaiting review.</td></tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-3 text-neutral-900">{ (r.profiles as any)?.full_name ?? '—' }</td>
                    <td className="py-3 text-neutral-600 text-sm">{r.status === 'submitted' ? 'Weekly report' : 'Monthly report'}</td>
                    <td className="py-3 text-neutral-600 text-sm">{r.reporting_week_start ?? r.reporting_month ?? '—'}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        r.status === 'submitted' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3">
                      <button onClick={() => review(r.id, 'approved', r.weekly_report_id ? true : false)} className="text-[10px] px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 mr-1">Approve</button>
                      <button onClick={() => review(r.id, 'revision_requested', r.weekly_report_id ? true : false)} className="text-[10px] px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">Request revision</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
