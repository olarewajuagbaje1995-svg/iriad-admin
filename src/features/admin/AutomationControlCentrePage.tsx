import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { isAdminOrDirector } from '@/lib/permissions'
import { useAuth } from '@/hooks/useAuth'
import type { Role } from '@/config/brand'

export default function AutomationControlCentrePage() {
  const { profile } = useAuth()
  const myRole = (profile?.role as Role | null) ?? null

  const [engines, setEngines] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [executions, setExecutions] = useState<any[]>([])
  const [recoveries, setRecoveries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const [e, j, ex, r] = await Promise.all([
        supabase
          .from('automation_engines')
          .select('*')
          .order('name', { ascending: true }),
        supabase
          .from('automation_jobs')
          .select('*')
          .order('scheduled_at', { ascending: false })
          .limit(50),
        supabase
          .from('automation_executions')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(50),
        supabase
          .from('automation_recoveries')
          .select('*, automation_jobs(job_id, business_operation)')
          .order('recovered_at', { ascending: false })
          .limit(50),
      ])
      setEngines(e.data ?? [])
      setJobs(j.data ?? [])
      setExecutions(ex.data ?? [])
      setRecoveries(r.data ?? [])
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to load automation data')
    } finally {
      setLoading(false)
    }
  }

  const stats = {
    pending: jobs.filter((j) => j.status === 'Pending').length,
    running: jobs.filter((j) => j.status === 'Running').length,
    completed: jobs.filter((j) => j.status === 'Completed').length,
    failed: jobs.filter((j) => j.status === 'Failed').length,
    uncertain: jobs.filter((j) => j.status === 'Uncertain').length,
  }

  if (loading) return <div className="p-6">Loading automation control centre…</div>

  if (!isAdminOrDirector(myRole)) {
    return (
      <div className="p-6 text-center text-neutral-500">
        <p>You do not have permission to view the automation control centre.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Automation Control Centre</h2>
          <p className="text-sm text-neutral-500">
            Hybrid automation: n8n is the permanent primary engine; IRIAD native is the independent backup failover engine.
          </p>
        </div>
        <button
          onClick={() => { setRefreshing(true); load().finally(() => setRefreshing(false)) }}
          disabled={refreshing}
          className="btn-primary flex items-center gap-2 text-xs"
        >
          ⟳ Refresh
        </button>
      </div>

      {/* Engine health */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Automation Engines</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-neutral-200 text-neutral-500 text-xs uppercase">
                <th className="pb-3">Engine</th>
                <th className="pb-3">Kind</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Failures / Threshold</th>
                <th className="pb-3 text-right">Last Health Check</th>
              </tr>
            </thead>
            <tbody>
              {engines.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-neutral-500">No engine records.</td></tr>
              ) : (
                engines.map((eng) => {
                  const healthy = eng.status === 'healthy'
                  return (
                    <tr key={eng.name} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="py-3 text-neutral-900 font-medium">{eng.name}</td>
                      <td className="py-3 text-neutral-600 text-sm">{eng.kind}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          healthy ? 'bg-green-100 text-green-700' : eng.status === 'unhealthy'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {eng.status}
                        </span>
                      </td>
                      <td className="py-3 text-right text-neutral-600 text-sm">
                        {eng.consecutive_failures} / {eng.failure_threshold}
                      </td>
                      <td className="py-3 text-right text-neutral-600 text-xs">
                        {eng.last_health_check_at ? new Date(eng.last_health_check_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Pending', value: stats.pending, color: 'text-blue-700 bg-blue-50 border-blue-200' },
          { label: 'Running', value: stats.running, color: 'text-amber-700 bg-amber-50 border-amber-200' },
          { label: 'Completed', value: stats.completed, color: 'text-green-700 bg-green-50 border-green-200' },
          { label: 'Failed', value: stats.failed, color: 'text-red-700 bg-red-50 border-red-200' },
          { label: 'Uncertain', value: stats.uncertain, color: 'text-purple-700 bg-purple-50 border-purple-200' },
        ].map((s) => (
          <div key={s.label} className={`card p-4 border ${s.color}`}>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">{s.label}</div>
            <div className="text-2xl font-semibold text-neutral-900">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Recent jobs */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Recent Jobs</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-neutral-200 text-neutral-500 text-xs uppercase">
                <th className="pb-3">Job ID</th>
                <th className="pb-3">Operation</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Engine</th>
                <th className="pb-3 text-right">Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-neutral-500">No jobs.</td></tr>
              ) : (
                jobs.map((j) => {
                  const statusColor: Record<string, string> = {
                    Completed: 'bg-green-100 text-green-700',
                    Failed: 'bg-red-100 text-red-700',
                    Pending: 'bg-blue-100 text-blue-700',
                    Running: 'bg-amber-100 text-amber-700',
                    Uncertain: 'bg-purple-100 text-purple-700',
                    Retrying: 'bg-orange-100 text-orange-700',
                  }
                  return (
                    <tr key={j.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="py-3 text-neutral-600 text-xs font-mono">{j.job_id}</td>
                      <td className="py-3 text-neutral-900 text-sm">{j.business_operation}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${statusColor[j.status] ?? 'bg-neutral-100 text-neutral-700'}`}>
                          {j.status}
                        </span>
                      </td>
                      <td className="py-3 text-neutral-600 text-sm">{j.current_engine ?? '—'}</td>
                      <td className="py-3 text-right text-neutral-600 text-xs">
                        {j.scheduled_at ? new Date(j.scheduled_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent recoveries */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Failover Recoveries</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-neutral-200 text-neutral-500 text-xs uppercase">
                <th className="pb-3">Job</th>
                <th className="pb-3">Reason</th>
                <th className="pb-3">Recovered By</th>
                <th className="pb-3 text-right">Recovered At</th>
              </tr>
            </thead>
            <tbody>
              {recoveries.length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center text-neutral-500">No recoveries recorded.</td></tr>
              ) : (
                recoveries.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-3 text-neutral-600 text-xs font-mono">
                      {r.automation_jobs?.job_id ?? '—'}
                    </td>
                    <td className="py-3 text-neutral-900 text-sm">{r.reason}</td>
                    <td className="py-3 text-neutral-600 text-sm">{r.recovered_by_engine}</td>
                    <td className="py-3 text-right text-neutral-600 text-xs">
                      {r.recovered_at ? new Date(r.recovered_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent executions */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Recent Executions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-neutral-200 text-neutral-500 text-xs uppercase">
                <th className="pb-3">Job</th>
                <th className="pb-3">Engine</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Started</th>
              </tr>
            </thead>
            <tbody>
              {executions.length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center text-neutral-500">No executions.</td></tr>
              ) : (
                executions.map((ex) => (
                  <tr key={ex.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-3 text-neutral-600 text-xs font-mono">{ex.job_id}</td>
                    <td className="py-3 text-neutral-600 text-sm">{ex.engine}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        ex.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {ex.status}
                      </span>
                    </td>
                    <td className="py-3 text-right text-neutral-600 text-xs">
                      {ex.started_at ? new Date(ex.started_at).toLocaleString() : '—'}
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
