import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Clock, ToggleRight } from 'lucide-react'
import { formatLagos } from '@/lib/dates'

export default function AttendanceControlPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [morningOpen, setMorningOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const { data } = await supabase.from('attendance_sessions').select('*').order('work_date', { ascending: false }).limit(30)
      setSessions(data ?? [])
      const today = new Date().toISOString().slice(0, 10)
      const todaySession = (data ?? []).find((s) => s.work_date === today)
      setMorningOpen(!!(todaySession?.morning_open_override || todaySession?.morning_opened_at))
      setSignOutOpen(!!(todaySession?.sign_out_open_override || todaySession?.sign_out_opened_at))
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const toggleWindow = async (kind: 'morning' | 'sign_out') => {
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

  if (loading) return <div className="p-6">Loading attendance control…</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Attendance Control</h2>
        <p className="text-sm text-neutral-500">Open/close check-in and sign-out windows. Times are enforced server-side (Africa/Lagos).</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Morning check-in</h3>
          <p className="text-xs text-neutral-500 mb-4">Window: 8:00 AM – 9:00 AM</p>
          <button
            className={`w-full py-3 rounded-lg border transition-colors ${
              morningOpen ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-neutral-200 text-neutral-700 hover:bg-brand-50 hover:border-brand-600'
            }`}
            onClick={() => toggleWindow('morning')}
          >
            <Clock className="w-4 h-4 mr-2" /> {morningOpen ? 'Close check-in window' : 'Open check-in window'}
          </button>
          <p className="mt-3 text-xs text-neutral-500">{morningOpen ? 'Window is OPEN' : 'Window is CLOSED'}</p>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Evening sign-out</h3>
          <p className="text-xs text-neutral-500 mb-4">Admin-controlled. Staff are notified when it opens.</p>
          <button
            className={`w-full py-3 rounded-lg border transition-colors ${
              signOutOpen ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-neutral-200 text-neutral-700 hover:bg-brand-50 hover:border-brand-600'
            }`}
            onClick={() => toggleWindow('sign_out')}
          >
            <ToggleRight className="w-4 h-4 mr-2" /> {signOutOpen ? 'Close sign-out' : 'Open sign-out'}
          </button>
          <p className="mt-3 text-xs text-neutral-500">{signOutOpen ? 'Sign-out OPEN' : 'Sign-out CLOSED'}</p>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Today</h3>
          <p className="text-xs text-neutral-500 mb-2">{formatLagos(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
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
                  <div className="text-neutral-500">Morning: {s.morning_opened_at ? 'opened' : 'not opened'}</div>
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
