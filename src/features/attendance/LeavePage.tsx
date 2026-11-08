import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase'
import { Plus, RefreshCw } from 'lucide-react'
import { leaveRequestSchema, type LeaveRequestFormData } from '@/lib/validation'

export default function LeavePage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState<string | null>(null)

  // Role
  const [userRole, setUserRole] = useState<string>('')
  const [userOrg, setUserOrg] = useState<string | null>(null)

  const form = useForm<LeaveRequestFormData>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      leaveType: 'annual',
      startDate: '',
      endDate: '',
      reason: '',
    },
  })

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const profile = (await supabase
        .from('profiles')
        .select('role, organisation_id')
        .eq('id', user.id)
        .single()).data

      if (profile) {
        setUserRole(profile.role)
        setUserOrg(profile.organisation_id)
      }

      const { data } = await supabase
        .from('leave_requests')
        .select('*, profiles(full_name, role)')
        .order('created_at', { ascending: false })
        .limit(100)
      setRequests(data ?? [])
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = userRole === 'admin' || userRole === 'director'

  const submit = async (data: LeaveRequestFormData) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !userOrg) return
    await supabase.from('leave_requests').insert([{
      organisation_id: userOrg,
      staff_id: user.id,
      leave_type: data.leaveType,
      start_date: data.startDate,
      end_date: data.endDate,
      reason: data.reason,
      status: 'pending',
    }])
    form.reset()
    load()
  }

  const reviewLeave = async (id: string, decision: 'approved' | 'rejected') => {
    setApproving(id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('leave_requests').update({ status: decision, approved_by: user?.id, reviewed_at: new Date().toISOString() }).eq('id', id)
      load()
    } catch (err: any) {
      alert(err.message || 'Review failed')
    } finally {
      setApproving(null)
    }
  }

  const deleteRequest = async (id: string) => {
    if (!confirm('Delete this leave request?')) return
    try {
      await supabase.from('leave_requests').delete().eq('id', id)
      load()
    } catch (err: any) {
      alert(err.message || 'Delete failed')
    }
  }

  if (loading) return <div className="p-6">Loading leave requests…</div>

  const pendingRequests = isAdmin ? requests.filter((r) => r.status === 'pending') : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Leave &amp; Assignments</h2>
          <p className="text-sm text-neutral-500">Request annual, sick, emergency, field-work, or remote-work leave.</p>
        </div>
      </div>

      {/* New request form */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">New request</h3>
        <form onSubmit={form.handleSubmit(submit)} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Leave type</label>
            <select className="input" {...form.register('leaveType')}>
              <option value="annual">Annual leave</option>
              <option value="sick">Sick leave</option>
              <option value="emergency">Emergency leave</option>
              <option value="field_work">Field work</option>
              <option value="remote_work">Remote work</option>
              <option value="other">Other</option>
            </select>
            {form.formState.errors.leaveType && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.leaveType.message}</p>
            )}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Start date</label>
            <input className="input" type="date" {...form.register('startDate')} />
            {form.formState.errors.startDate && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.startDate.message}</p>
            )}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">End date</label>
            <input className="input" type="date" {...form.register('endDate')} />
            {form.formState.errors.endDate && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.endDate.message}</p>
            )}
          </div>
          <div className="col-span-4">
            <label className="label">Reason</label>
            <textarea className="input" {...form.register('reason')} rows={2} />
            {form.formState.errors.reason && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.reason.message}</p>
            )}
          </div>
          <div className="col-span-4">
            <button className="btn-primary" disabled={loading}>
              <Plus className="w-4 h-4 mr-2" /> Submit request
            </button>
          </div>
        </form>
      </div>

      {/* Admin approval section */}
      {isAdmin && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider">Pending approvals</h3>
            <button onClick={load} className="btn-ghost text-xs" title="Refresh">
              <RefreshCw className="w-3 h-3 mr-1" />
            </button>
          </div>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">No leave requests awaiting approval.</div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((r) => (
                <div key={r.id} className="p-3 rounded-lg border border-neutral-200 bg-white flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-neutral-900">{r.leave_type.replace('_', ' ')}</div>
                    <div className="text-xs text-neutral-500">
                      {(r.profiles as any)?.full_name ?? 'Staff'} • {r.start_date} → {r.end_date} • {r.reason.slice(0, 60)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => reviewLeave(r.id, 'approved')}
                      disabled={approving === r.id}
                      className="text-[10px] px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 disabled:opacity-50"
                    >
                      {approving === r.id ? '…' : 'Approve'}
                    </button>
                    <button
                      onClick={() => reviewLeave(r.id, 'rejected')}
                      disabled={approving === r.id}
                      className="text-[10px] px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 disabled:opacity-50"
                    >
                      {approving === r.id ? '…' : 'Reject'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My requests */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">
          {isAdmin ? 'All requests' : 'My requests'}
        </h3>
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">No leave requests yet.</div>
          ) : (
            requests.map((r) => {
              const isPending = r.status === 'pending'
              const showActions = !isAdmin || isPending
              return (
                <div key={r.id} className="p-3 rounded-lg border border-neutral-200 bg-white flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-neutral-900">{r.leave_type.replace('_', ' ')}</div>
                    <div className="text-xs text-neutral-500">
                      {r.start_date} → {r.end_date} {(isAdmin && (r.profiles as any)?.full_name) ? `• ${(r.profiles as any).full_name}` : ''}
                    </div>
                    {r.reason && <div className="text-[10px] text-neutral-500 mt-0.5">{r.reason.slice(0, 80)}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      r.status === 'approved' ? 'bg-green-100 text-green-700' :
                      r.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      r.status === 'revision_requested' ? 'bg-amber-100 text-amber-700' :
                      'bg-neutral-100 text-neutral-600'
                    }`}>
                      {r.status.replace('_', ' ')}
                    </span>
                    {showActions && (
                      <>
                        {isPending && (
                          <button onClick={() => deleteRequest(r.id)} className="text-[10px] text-red-500 hover:text-red-700">Delete</button>
                        )}
                        {isAdmin && !isPending && (
                          <span className="text-[10px] text-neutral-400">by {(r.approved_by ? 'admin' : '—')}</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
