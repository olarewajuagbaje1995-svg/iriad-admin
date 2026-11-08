import { useState } from 'react'
import { useAttendance } from '@/hooks/useAttendance'
import { Clock, CheckCircle2, Activity, History } from 'lucide-react'
import { formatLagos, isLagosWorkday } from '@/lib/dates'

export default function AttendancePage() {
  const { records, todayRecord, loading, error, checkIn, checkOut, refresh } = useAttendance()
  const [errorDismissed, setErrorDismissed] = useState(false)
  const isWorkday = isLagosWorkday(new Date())

  if (loading) return <div className="p-6">Loading attendance…</div>

  const checkedIn = !!todayRecord?.check_in_at
  const checkedOut = !!todayRecord?.check_out_at

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Attendance</h2>
        <p className="text-sm text-neutral-500">
          Morning check-in window: 8:00 AM – 9:00 AM Africa/Lagos (Mon–Fri). Evening sign-out is admin-controlled.
        </p>
      </div>

      {/* Today's status card */}
      <div className="card p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">Today — {formatLagos(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
            <p className="text-xl font-bold text-neutral-900 mt-1">
              {!isWorkday ? 'Weekend / non-workday' : checkedIn ? (checkedOut ? 'Checked out' : 'Checked in') : 'Not checked in'}
            </p>
          </div>

          <div className="flex gap-3 w-full lg:w-auto">
            {!isWorkday && (
              <button className="btn-ghost w-full lg:w-auto" disabled>Not a workday</button>
            )}
            {!checkedIn && isWorkday && (
              <button
                className="btn-primary w-full lg:w-auto"
                onClick={() => checkIn('office')}
                disabled={loading}
              >
                <Clock className="w-4 h-4 mr-2" /> Check in
              </button>
            )}
            {checkedIn && !checkedOut && (
              <button
                className="btn-primary w-full lg:w-auto"
                onClick={() => checkOut()}
                disabled={loading}
              >
                <Activity className="w-4 h-4 mr-2" /> Sign out
              </button>
            )}
            {checkedIn && checkedOut && (
              <button className="btn-ghost w-full lg:w-auto" disabled>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Complete
              </button>
            )}
          </div>
        </div>

        {todayRecord && (
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-neutral-200 pt-4 text-sm">
            <div>
              <p className="text-neutral-500 text-xs uppercase">Check-in</p>
              <p className="text-neutral-900">{todayRecord.check_in_at ? formatLagos(todayRecord.check_in_at) : '—'}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs uppercase">Check-out</p>
              <p className="text-neutral-900">{todayRecord.check_out_at ? formatLagos(todayRecord.check_out_at) : '—'}</p>
            </div>
          </div>
        )}
      </div>

      {error && !errorDismissed && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button
            onClick={() => setErrorDismissed(true)}
            className="ml-2 text-xs underline text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Attendance history */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider">Recent attendance</h3>
          <button className="btn-ghost text-xs" onClick={refresh}>
            <History className="w-3 h-3 mr-1" /> Refresh
          </button>
        </div>

        {records.length === 0 ? (
          <div className="text-center py-10 text-neutral-500">
            <p>No attendance records yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-neutral-200 text-neutral-500 text-xs uppercase">
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Check-in</th>
                  <th className="pb-3">Check-out</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-3 text-neutral-900">{formatLagos(r.attendance_date, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td className="py-3 text-neutral-600 capitalize">{r.attendance_type.replace('_', ' ')}</td>
                    <td className="py-3">{r.check_in_at ? formatLagos(r.check_in_at) : '—'}</td>
                    <td className="py-3">{r.check_out_at ? formatLagos(r.check_out_at) : '—'}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        r.status === 'checked_out' ? 'bg-green-50 text-green-700' :
                        r.status === 'late' ? 'bg-amber-50 text-amber-700' :
                        r.status === 'missing_checkout' ? 'bg-red-50 text-red-700' :
                        'bg-neutral-100 text-neutral-600'
                      }`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
