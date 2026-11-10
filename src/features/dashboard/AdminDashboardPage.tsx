import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatLagos } from '@/lib/dates'
import {
  Users, Clock, CheckCircle2, Briefcase, Activity, Bell,
  Mail, FileText, LayoutDashboard, ShieldAlert,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { isAdminOrDirector } from '@/lib/permissions'
import { type Role } from '@/config/brand'

export default function AdminDashboardPage() {
  const { profile } = useAuth()
  const role = (profile?.role as Role | null) ?? null
  const canViewAll = isAdminOrDirector(role)

  const [stats, setStats] = useState({
    staff: 0,
    projects: 0,
    tasks: 0,
    reports: 0,
  })
  const [attendanceTrend, setAttendanceTrend] = useState<{ date: string; checkedIn: number }[]>([])
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!canViewAll) {
        setLoading(false)
        return
      }

      try {
        const [p, pr, t, rep, att, act] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, is_active, role', { count: 'exact' }),
          supabase.from('projects').select('id, status', { count: 'exact' }),
          supabase.from('tasks').select('id, status', { count: 'exact' }),
          supabase.from('generated_reports').select('id', { count: 'exact' }),
          supabase
            .from('attendance')
            .select('attendance_date, check_in_at, staff_id, profiles(full_name)')
            .order('attendance_date', { ascending: true })
            .limit(30),
          supabase
            .from('notifications')
            .select('*, profiles(full_name, role)')
            .order('created_at', { ascending: false })
            .limit(10),
        ])

        const activeStaff = (p as any).data?.filter((r: any) => r.is_active !== false).length ?? 0

        setStats({
          staff: activeStaff,
          projects: (pr as any).count ?? 0,
          tasks: (t as any).count ?? 0,
          reports: (rep as any).count ?? 0,
        })

        const attendanceRows = (att as any).data ?? []
        const last7 = Array.from({ length: 7 }, (_, i) => {
          const d = new Date()
          d.setDate(d.getDate() - (6 - i))
          return d.toISOString().slice(0, 10)
        })
        const trend = last7.map((d) => ({
          date: d,
          checkedIn: attendanceRows.filter((row: any) => row.attendance_date === d && row.check_in_at).length,
        }))
        setAttendanceTrend(trend)

        setRecentActivities((act as any).data ?? [])
      } catch {
        // tables may not exist yet until migrations run
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [profile, canViewAll])

  if (!canViewAll) {
    return (
      <div className="p-6 text-center text-neutral-500">
        <ShieldAlert className="w-8 h-8 mx-auto text-neutral-400 mb-3" />
        <h3 className="text-sm font-semibold text-neutral-900">Restricted access</h3>
        <p className="text-xs text-neutral-500">You do not have permission to view the organisational dashboard.</p>
      </div>
    )
  }

  if (loading) return <div className="p-6 flex items-center justify-center">Loading admin dashboard…</div>

  const totalCheckIns = attendanceTrend.reduce((sum, d) => sum + d.checkedIn, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-neutral-100 p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Command Center</h2>
          <p className="text-sm text-neutral-500">
            Organisation overview — {formatLagos(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge label="Live" color="green" />
          <Badge label={totalCheckIns > 0 ? `${totalCheckIns} check-ins today` : 'No check-ins yet'} color="neutral" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active staff"
          value={stats.staff}
          icon={<Users className="w-5 h-5 text-blue-600" />}
          badgeBg="bg-blue-50"
          badgeText="text-blue-700"
          trend="+2.4% vs last week"
        />
        <StatCard
          title="Active projects"
          value={stats.projects}
          icon={<Briefcase className="w-5 h-5 text-purple-600" />}
          badgeBg="bg-purple-50"
          badgeText="text-purple-700"
          trend="+1.8% vs last week"
        />
        <StatCard
          title="Open tasks"
          value={stats.tasks}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          badgeBg="bg-amber-50"
          badgeText="text-amber-700"
          trend="-0.5% vs last week"
        />
        <StatCard
          title="Reports"
          value={stats.reports}
          icon={<FileText className="w-5 h-5 text-emerald-600" />}
          badgeBg="bg-emerald-50"
          badgeText="text-emerald-700"
          trend="+12 this month"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Attendance trend chart */}
        <div className="lg:col-span-7 card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-neutral-900">Attendance trend</h3>
            </div>
            <Badge label="7 days" color="neutral" />
          </div>
          <div className="h-72 w-full">
            <AttendanceSparkline data={attendanceTrend} />
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            {totalCheckIns} total check-ins over the past 7 days.
          </p>
        </div>

        {/* Quick actions */}
        <div className="lg:col-span-5 card p-6">
          <h3 className="text-sm font-semibold text-neutral-900 mb-5">Quick actions</h3>
          <div className="grid gap-3">
            <QuickAction
              label="Open check-in window"
              description="Allow staff to check in for today"
              icon={<Clock className="w-4 h-4" />}
            />
            <QuickAction
              label="View attendance control"
              description="Manage sign-out windows and sessions"
              icon={<LayoutDashboard className="w-4 h-4" />}
            />
            <QuickAction
              label="Manage staff"
              description="View and provision organisation members"
              icon={<Users className="w-4 h-4" />}
            />
            <QuickAction
              label="Create calendar event"
              description="Schedule meetings and deadlines"
              icon={<Mail className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* Recent attendance activity feed */}
        <div className="lg:col-span-7 card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-900">Live attendance activity</h3>
            <button
              onClick={() => {}}
              className="text-xs text-brand-600 hover:text-brand-800 underline"
            >
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left">
                  <th className="pb-3 text-xs font-medium text-neutral-500">Staff</th>
                  <th className="pb-3 text-xs font-medium text-neutral-500">Action</th>
                  <th className="pb-3 text-xs font-medium text-neutral-500">Time</th>
                  <th className="pb-3 text-xs font-medium text-neutral-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentActivities.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-neutral-500">
                      No recent attendance activity.
                    </td>
                  </tr>
                ) : (
                  recentActivities.map((a) => (
                    <tr key={a.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                      <td className="py-3 text-neutral-900 font-medium">
                        {(a.profiles as any)?.full_name ?? 'Staff Member'}
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-700 border border-green-100">
                          <CheckCircle2 className="w-3 h-3" /> Checked in
                        </span>
                      </td>
                      <td className="py-3 text-neutral-600">
                        {a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="py-3 text-neutral-500 text-xs">Today</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notifications panel */}
        <div className="lg:col-span-5 card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-900">Recent notifications</h3>
            <Badge label={recentActivities.length} color="neutral" />
          </div>
          <div className="space-y-3">
            {recentActivities.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <Mail className="w-6 h-6 mx-auto text-neutral-300 mb-2" />
                <p className="text-xs">No recent notifications.</p>
              </div>
            ) : (
              recentActivities.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-neutral-100 bg-white hover:bg-neutral-50 transition-colors">
                  <Bell className="w-4 h-4 text-brand-600 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-neutral-900 truncate">{a.title ?? a.notification_type ?? 'Activity'}</div>
                    <div className="text-xs text-neutral-500 truncate">
                      {(a.profiles as any)?.full_name ?? 'System'} • {new Date(a.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Sub-components ---------- */

function Badge({ label, color }: { label: string | number; color: 'green' | 'red' | 'neutral' }) {
  const variants: Record<string, string> = {
    green: 'bg-green-50 text-green-700 border border-green-100',
    red: 'bg-red-50 text-red-700 border border-red-100',
    neutral: 'bg-neutral-100 text-neutral-600 border border-neutral-200',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${variants[color]}`}>
      {label}
    </span>
  )
}

function StatCard({
  title,
  value,
  icon,
  badgeBg,
  badgeText,
  trend,
}: {
  title: string
  value: number | string
  icon: JSX.Element
  badgeBg: string
  badgeText: string
  trend: string
}) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="w-9 h-9 rounded-lg {badgeBg} flex items-center justify-center text-[color-from-badge] mb-3">
            {icon}
          </div>
          <div className="text-2xl font-bold text-neutral-900">{value}</div>
          <p className="text-sm text-neutral-500">{title}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className={`px-2 py-1 rounded ${badgeBg}`}><span className={badgeText}>{badgeText}</span></span>
          <p className="text-xs text-neutral-500 mt-1">{trend}</p>
        </div>
      </div>
    </div>
  )
}

function QuickAction({
  label,
  description,
  icon,
}: {
  label: string
  description: string
  icon: JSX.Element
}) {
  return (
    <button
      onClick={() => {}}
      className="w-full flex items-center gap-3 p-3 rounded-lg border border-neutral-100 bg-white hover:bg-brand-50 hover:text-brand-700 transition-colors group"
    >
      <div className="p-1.5 rounded bg-neutral-100 text-neutral-600 group-hover:bg-brand-100 group-hover:text-brand-700 transition-colors">
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium text-neutral-900">{label}</div>
        <div className="text-xs text-neutral-500">{description}</div>
      </div>
    </button>
  )
}

function AttendanceSparkline({ data }: { data: { date: string; checkedIn: number }[] }) {
  const max = Math.max(...data.map((d) => d.checkedIn), 1)
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d) => {
        const height = Math.max(4, (d.checkedIn / max) * 80)
        return (
          <div
            key={d.date}
            className="flex flex-col items-center justify-end gap-1 w-full"
            style={{ flex: 1 }}
          >
            <div
              className="w-full rounded-t-sm bg-brand-600"
              style={{ height: `${height}%` }}
            />
            <span className="text-[10px] text-neutral-500">{new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>
        )
      })}
    </div>
  )
}
