import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase'
import { Plus, RefreshCw } from 'lucide-react'
import { attendanceCorrectionSchema, type AttendanceCorrectionFormData } from '@/lib/validation'

export default function AttendanceCorrectionsPage() {
  const [corrections, setCorrections] = useState<any[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState<string | null>(null)

  const [userRole, setUserRole] = useState<string>('')
  const [userOrg, setUserOrg] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [attendanceId, setAttendanceId] = useState('')

  const form = useForm<AttendanceCorrectionFormData>({
    resolver: zodResolver(attendanceCorrectionSchema),
    defaultValues: {
      correctionType: 'check_in',
      oldValue: '',
      newValue: '',
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
      setUserId(user.id)

      const profile = (await supabase
        .from('profiles')
        .select('role, organisation_id')
        .eq('id', user.id)
        .single()).data

      if (profile) {
        setUserRole(profile.role)
        setUserOrg(profile.organisation_id)
      }

      const [corrs, atts] = await Promise.all([
        supabase
          .from('attendance_corrections')
          .select('*, attendance(attendance_date, check_in_at, check_out_at), profiles(full_name)')
          .order('created_at', { ascending: false })
          .limit(100),
        userOrg ? supabase
          .from('attendance')
          .select('*')
          .eq('organisation_id', userOrg)
          .order('attendance_date', { ascending: false })
          .limit(200)
          : Promise.resolve({ data: [] }),
      ])

      setCorrections(corrs.data ?? [])
      setAttendanceRecords(atts.data ?? [])
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = userRole === 'admin' || userRole === 'director'

  const findRecordForDate = (date: string) => {
    return attendanceRecords.find((r) => r.attendance_date === date && r.staff_id === userId)
  }

  const submit = async (data: AttendanceCorrectionFormData) => {
    if (!userOrg || !userId) return

    // Determine the attendance record to correct
    let targetAttendanceId = attendanceId
    if (!targetAttendanceId) {
      // If no specific record selected, find today's record for this staff
      const today = new Date().toISOString().slice(0, 10)
      const rec = findRecordForDate(today)
      targetAttendanceId = rec?.id ?? ''
    }

    if (!targetAttendanceId) {
      alert('No attendance record found for this staff/date. Please check in first or select an attendance record.')
      return
    }

    try {
      await supabase.from('attendance_corrections').insert([{
        organisation_id: userOrg,
        attendance_id: targetAttendanceId,
        staff_id: userId,
        requested_by: userId,
        correction_type: data.correctionType,
        new_value: data.newValue,
        reason: data.reason,
        status: 'pending',
      }])
      form.reset()
      setAttendanceId('')
      load()
    } catch (err: any) {
      alert(err.message || 'Request failed')
    }
  }

  const reviewCorrection = async (id: string, decision: 'approved' | 'rejected') => {
    setReviewing(id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const corr = corrections.find((c) => c.id === id)
      await supabase.from('attendance_corrections').update({
        status: decision,
        approved_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', id)

      // If approved, apply the correction to the attendance record
      if (decision === 'approved' && corr) {
        const updates: any = { updated_at: new Date().toISOString() }
        if (corr.correction_type === 'check_in') updates.check_in_at = corr.new_value
        if (corr.correction_type === 'check_out') updates.check_out_at = corr.new_value
        if (corr.correction_type === 'status') updates.status = corr.new_value
        if (corr.attendance_id) {
          await supabase.from('attendance').update(updates).eq('id', corr.attendance_id)
        }
      }

      load()
    } catch (err: any) {
      alert(err.message || 'Review failed')
    } finally {
      setReviewing(null)
    }
  }

  const deleteCorrection = async (id: string) => {
    if (!confirm('Delete this correction request?')) return
    try {
      await supabase.from('attendance_corrections').delete().eq('id', id)
      load()
    } catch (err: any) {
      alert(err.message || 'Delete failed')
    }
  }

  if (loading) return <div className="p-6">Loading corrections…</div>

  const pendingCorrections = isAdmin ? corrections.filter((c) => c.status === 'pending') : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Attendance Corrections</h2>
          <p className="text-sm text-neutral-500">Request check-in/check-out corrections or overrides. Admins review with full audit history.</p>
        </div>
      </div>

      {/* New correction request */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Request correction</h3>
        <form onSubmit={form.handleSubmit(submit)} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Correction type</label>
            <select className="input" {...form.register('correctionType')}>
              <option value="check_in">Check-in time</option>
              <option value="check_out">Check-out time</option>
              <option value="override">Admin override</option>
              <option value="absence">Mark absence</option>
              <option value="status">Change status</option>
            </select>
            {form.formState.errors.correctionType && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.correctionType.message}</p>
            )}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Attendance record</label>
            <select className="input" value={attendanceId} onChange={(e) => setAttendanceId(e.target.value)}>
              <option value="">Select record…</option>
              {attendanceRecords.map((r) => (
                <option key={r.id} value={r.id}>
                  {new Date(r.attendance_date).toLocaleDateString()} — {r.check_in_at ? 'checked in' : 'not checked in'}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">New value</label>
            <input className="input" {...form.register('newValue')} placeholder="e.g. 08:30 or 'present'" />
            {form.formState.errors.newValue && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.newValue.message}</p>
            )}
          </div>
          <div className="col-span-4">
            <label className="label">Reason</label>
            <textarea className="input" {...form.register('reason')} rows={2} placeholder="Why is this correction needed?" />
            {form.formState.errors.reason && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.reason.message}</p>
            )}
          </div>
          <div className="col-span-4">
            <button className="btn-primary" disabled={loading}>
              <Plus className="w-4 h-4 mr-2" /> Request correction
            </button>
          </div>
        </form>
        <p className="text-xs text-neutral-500 mt-2">If no attendance record is selected, today's record for your profile will be used.</p>
      </div>

      {/* Admin approval section */}
      {isAdmin && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider">Pending corrections</h3>
            <button onClick={load} className="btn-ghost text-xs" title="Refresh">
              <RefreshCw className="w-3 h-3 mr-1" />
            </button>
          </div>
          {pendingCorrections.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">No corrections awaiting review.</div>
          ) : (
            <div className="space-y-3">
              {pendingCorrections.map((c) => (
                <div key={c.id} className="p-3 rounded-lg border border-neutral-200 bg-white">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-neutral-900">{c.correction_type.replace('_', ' ')} correction</div>
                      <div className="text-xs text-neutral-500">
                        {(c.profiles as any)?.full_name ?? 'Staff'} • {c.attendance?.attendance_date ? new Date(c.attendance.attendance_date).toLocaleDateString() : '—'} • Reason: {c.reason.slice(0, 60)}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-1">Old: {c.old_value ?? '—'} → New: {c.new_value}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">Pending</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => reviewCorrection(c.id, 'approved')}
                      disabled={reviewing === c.id}
                      className="text-[10px] px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 disabled:opacity-50"
                    >
                      {reviewing === c.id ? '…' : 'Approve'}
                    </button>
                    <button
                      onClick={() => reviewCorrection(c.id, 'rejected')}
                      disabled={reviewing === c.id}
                      className="text-[10px] px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 disabled:opacity-50"
                    >
                      {reviewing === c.id ? '…' : 'Reject'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My corrections history */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">
          {isAdmin ? 'All corrections' : 'My corrections'}
        </h3>
        <div className="space-y-3">
          {corrections.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">No corrections yet.</div>
          ) : (
            corrections.map((c) => {
              const statusColor: Record<string, string> = {
                pending: 'bg-neutral-100 text-neutral-600',
                approved: 'bg-green-100 text-green-700',
                rejected: 'bg-red-100 text-red-700',
              }
              return (
                <div key={c.id} className="p-3 rounded-lg border border-neutral-200 bg-white flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-neutral-900">{c.correction_type.replace('_', ' ')}</div>
                    <div className="text-xs text-neutral-500">
                      {c.attendance?.attendance_date ? new Date(c.attendance.attendance_date).toLocaleDateString() : '—'} • {c.new_value} • {c.reason.slice(0, 50)}
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">Requested {new Date(c.created_at).toLocaleDateString()}{c.reviewed_at ? ` • Reviewed ${new Date(c.reviewed_at).toLocaleDateString()}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${statusColor[c.status] ?? 'bg-neutral-100 text-neutral-600'}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                    {c.status === 'pending' && !isAdmin && (
                      <button onClick={() => deleteCorrection(c.id)} className="text-[10px] text-red-500 hover:text-red-700">Delete</button>
                    )}
                    {c.status !== 'pending' && c.approved_by && (
                      <span className="text-[10px] text-neutral-400">by admin</span>
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
