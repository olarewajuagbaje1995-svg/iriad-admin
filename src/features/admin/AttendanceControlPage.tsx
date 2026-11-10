import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Clock, ToggleRight, Check, User } from 'lucide-react'
import { formatLagos } from '@/lib/dates'
import { ROLE_LABELS, type Role } from '@/config/brand'
import { isAdminOrDirector } from '@/lib/permissions'
import { useAuth } from '@/hooks/useAuth'

export default function AttendanceControlPage() {
  const { profile } = useAuth()
  const myRole = (profile?.role as Role | null) ?? null
  const canManage = isAdminOrDirector(myRole)

  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [morningOpen, setMorningOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [todayRecords, setTodayRecords] = useState<any[]>([])

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [sessionsRes, recordsRes] = await Promise.all([
        supabase.from('attendance_sessions').select('*').order('work_date', { ascending: false }).limit(30),
        canManage
          ? supabase
              .from('attendance')
              .select(`, profiles(full_name, role)`)
              .eq('attendance_date', today)
              .order('check_in_at', { ascending: true })
          : Promise.resolve({ data: null }),
      ])
      setSessions(sessionsRes.data ?? [])

      const todaySession = (sessionsRes.data ?? []).find((s) => s.work_date === today)
      setMorningOpen(!!(todaySession?.morning_open_override || todaySession?.morning_opened_at))
      setSignOutOpen(!!(todaySession?.sign_out_open_override || todaySession?.sign_out_opened_at))
      setTodayRecords((recordsRes as any)?.data ?? [])
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const toggleWindow = async (kind: 'morning' | 'sign_out') => {
    if (!canManage) return
    try {
      const today = new Date().toISOString().slice(0, 10)
      const open = kind === 'morning' ? !morningOpen : !signOutOpen
      const { error: fnError } = await supabase.functions.invoke('attendance-control', {
        body: {
          action: kind === 'morning' ? 'toggle_morning' : 'toggle_sign_out',
          work_date: today,
          open,
        },
      })
      if (fnError) throw fnError
      if (kind === 'morning') setMorningOpen(open)
      else setSignOutOpen(open)
      load()
    } catch (e: any) {
      console.error(e)
      alert(e.message || 'Failed to update attendance window')
    }
  }

  // Timestamp when the morning window was last opened or closed (Lagos time)
  const morningTimestamp = sessions.find((s) => s.morning_opened_at || s.morning_closed_at)
    ? (sessions.find((s) => s.morning_opened_at || s.morning_closed_at) as any)
    : null
  const signOutTimestamp = sessions.find((s) => s.sign_out_opened_at || s.sign_out_closed_at)
    ? (sessions.find((s) => s.sign_out_opened_at || s.sign_out_closed_at) as any)
    : null

  if (loading) return <div className="p-6">Loading attendance control…</div>

  if (!canManage) {
    return (
      <div className="p-6 text-center text-neutral-500">
        <p>You do not have permission to control attendance windows.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Attendance Control</h2>
        <p className="text-sm text-neutral-500">Open/close check-in and sign-out windows. Check-ins are only permitted while a window is open, enforced server-side (Africa/Lagos).</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Morning check-in</h3>
          <button
            className={`w-full py-3 rounded-lg border transition-colors ${
              morningOpen ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-neutral-200 text-neutral-700 hover:bg-brand-50 hover:border-brand-600'
            }`}
            onClick={() => toggleWindow('morning')}
          >
            <Clock className="w-4 h-4 mr-2" /> {morningOpen ? 'Close check-in window' : 'Open check-in window'}
          </button>
          <p className="mt-3 text-xs text-neutral-500">{morningOpen ? 'Window is OPEN' : 'Window is CLOSED'}</p>
          {morningTimestamp && (
            <div className="mt-2 pt-2 border-t border-neutral-100">
              <p className="text-xs text-neutral-500 uppercase">Last changed</p>
              <p className="text-sm text-neutral-900">
                {morningOpen
                  ? `Opened ${formatLagos(morningTimestamp.morning_opened_at)}`
                  : `Closed ${formatLagos(morningTimestamp.morning_closed_at)}`}
              </p>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Evening sign-out</h3>
          <button
            className={`w-full py-3 rounded-lg border transition-colors ${
              signOutOpen ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-neutral-200 text-neutral-700 hover:bg-brand-50 hover:border-brand-600'
            }`}
            onClick={() => toggleWindow('sign_out')}
          >
            <ToggleRight className="w-4 h-4 mr-2" /> {signOutOpen ? 'Close sign-out' : 'Open sign-out'}
          </button>
          <p className="mt-3 text-xs text-neutral-500">{signOutOpen ? 'Sign-out OPEN' : 'Sign-out CLOSED'}</p>
          {signOutTimestamp && (
            <div className="mt-2 pt-2 border-t border-neutral-100">
              <p className="text-xs text-neutral-500 uppercase">Last changed</p>
              <p className="text-sm text-neutral-900">
                {signOutOpen
                  ? `Opened ${formatLagos(signOutTimestamp.sign_out_opened_at)}`
                  : `Closed ${formatLagos(signOutTimestamp.sign_out_closed_at)}`}
              </p>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Today</h3>
          <p className="text-xs text-neutral-500 mb-2">{formatLagos(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Today's attendance table */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider">Today's attendance</h3>
            <p className="text-xs text-neutral-500">Records for {formatLagos(new Date(), { year: 'numeric', month: 'short', day: 'numeric' })}</p>
          </div>
          <button className="btn-ghost text-xs" onClick={load}>
            <Clock className="w-3 h-3 mr-1" /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-neutral-200 text-neutral-500 text-xs uppercase">
                <th className="pb-3">Full name</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Time in</th>
                <th className="pb-3">Signature</th>
              </tr>
            </thead>
            <tbody>
              {todayRecords.length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center text-neutral-500">No attendance records for today yet.</td></tr>
              ) : (
                todayRecords.map((r) => {
                  const profile = (r as any).profiles
                  const role = (profile?.role ?? 'staff') as Role
                  const checkedIn = !!r.check_in_at
                  return (
                    <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="py-3 text-neutral-900">{profile?.full_name ?? '—'}</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          role === 'admin' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                          role === 'director' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                          'bg-neutral-50 text-neutral-600 border-neutral-200'
                        }`}>
                          <User className="w-3 h-3 mr-1" /> {ROLE_LABELS[role]}
                        </span>
                      </td>
                      <td className="py-3">
                        {r.check_in_at ? formatLagos(r.check_in_at) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        {checkedIn ? (
                          <span className="flex items-center gap-1 text-xs">
                            <Check className="w-3 h-3 text-green-600" /> Signed in
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Recent sessions</h3>
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <p className="text-xs text-neutral-500 text-center py-4">No sessions recorded.</p>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-2 rounded border border-neutral-100 text-xs">
                <div>
                  <div className="text-neutral-900">{new Date(s.work_date).toLocaleDateString()}</div>
                  <div className="text-neutral-500">
                    Morning: {s.morning_opened_at ? 'opened' : 'not opened'} • Sign-out: {s.sign_out_opened_at ? 'opened' : 'not opened'}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  s.sign_out_closed_at ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'
                }`}>
                  {s.sign_out_closed_at ? 'Closed' : 'Open'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
