import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatLagos } from '@/lib/dates'
import {
  LineChart, Line, ResponsiveContainer, Tooltip, Legend, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import {
  Users, Clock, CheckCircle2, Briefcase, Activity, Bell,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { isAdminOrDirector } from '@/lib/permissions'
import { type Role } from '@/config/brand'

export default function AdminDashboardPage() {
  const { profile } = useAuth()
  const role = (profile?.role as Role | null) ?? null
  const canViewAll = isAdminOrDirector(role)

  if (!canViewAll) {
    return (
      <div className="p-6 text-center text-neutral-500">
        <p>You do not have permission to view the organisational dashboard.</p>
      </div>
    )
  }

  const [stats, setStats] = useState({ staff: 0, projects: 0, tasks: 0, reports: 0 })
  const [attendanceTrend, setAttendanceTrend] = useState<{ date: string; checkedIn: number }[]>([])
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [p, pr, t, rep, att, act] = await Promise.all([
          supabase.from('profiles').select('id, is_active', { count: 'exact' }),
          supabase.from('projects').select('id, status', { count: 'exact' }),
          supabase.from('tasks').select('id, status', { count: 'exact' }),
          supabase.from('generated_reports').select('id', { count: 'exact' }),
          supabase.from('attendance').select('attendance_date, check_in_at').order('attendance_date', { ascending: true }).limit(30),
          supabase.from('notifications').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(10),
        ])

        setStats({
          staff: p.count ?? 0,
          projects: pr.count ?? 0,
          tasks: t.count ?? 0,
          reports: rep.count ?? 0,
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
  }, [profile])

  if (loading) return <div className="p-6">Loading admin dashboard…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Admin Dashboard</h2>
          <p className="text-sm text-neutral-500">Organisation overview for {formatLagos(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active staff" value={stats.staff} icon={<Users className="w-5 h-5" />} />
        <StatCard title="Active projects" value={stats.projects} icon={<Briefcase className="w-5 h-5" />} />
        <StatCard title="Open tasks" value={stats.tasks} icon={<Clock className="w-5 h-5" />} />
        <StatCard title="Reports" value={stats.reports} icon={<CheckCircle2 className="w-5 h-5 text-amber-500" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between text-sm text-neutral-500 mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" /> Attendance trend (7 days)
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="checkedIn" stroke="#0274be" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-neutral-500">Staff check-ins per day. Live data loads once migrations are applied.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Recent activities</h3>
          <div className="space-y-3">
            {recentActivities.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">No recent activity.</div>
            ) : (
              recentActivities.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-2 rounded-lg bg-neutral-50">
                  <Bell className="w-4 h-4 text-brand-600 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-neutral-900">{a.title ?? a.notification_type ?? 'Activity'}</div>
                    <div className="text-xs text-neutral-500">
                      {(a.profiles as any)?.full_name ?? 'System'} • {new Date(a.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Reports &amp; announcements</h3>
          <p className="text-xs text-neutral-500">Generate weekly/monthly reports and post org-wide announcements from the sidebar.</p>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon }: { title: string; value: number | string; icon: JSX.Element }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="w-8 h-8 rounded-md bg-brand-50 flex items-center justify-center text-brand-600 mb-3">{icon}</div>
      <div className="text-2xl font-bold text-neutral-900">{value}</div>
      <p className="text-sm text-neutral-500">{title}</p>
    </div>
  )
}
