import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatLagos } from '@/lib/dates'
import { useAuth } from '@/hooks/useAuth'
import { ROLE_LABELS, type Role } from '@/config/brand'
import { Clock, CheckCircle2, Calendar, Briefcase } from 'lucide-react'

export default function DashboardPage() {
  const { profile } = useAuth()
  const roleLabel = ROLE_LABELS[(profile?.role as Role) ?? 'staff']
  const userId = profile?.id ?? null
  const [stats, setStats] = useState({
    myAttendance: 0,
    myPendingLeave: 0,
    myTasks: 0,
    myProjects: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!userId) {
        setLoading(false)
        return
      }
      try {
        const today = new Date().toISOString().slice(0, 10)
        const [attendance, leave, tasks, projects] = await Promise.all([
          supabase
            .from('attendance')
            .select('status, attendance_date')
            .eq('staff_id', userId)
            .eq('attendance_date', today),
          supabase.from('leave_requests').select('status').eq('staff_id', userId).eq('status', 'pending'),
          supabase.from('tasks').select('status').eq('assignee_id', userId).eq('status', 'open'),
          supabase.from('projects').select('status').eq('owner_id', userId).eq('status', 'active'),
        ])

        const attData = attendance.data ?? []
        setStats({
          myAttendance: attData.filter((a) => a.status === 'checked_in' || a.status === 'checked_out').length,
          myPendingLeave: leave.data?.length ?? 0,
          myTasks: tasks.data?.length ?? 0,
          myProjects: projects.data?.length ?? 0,
        })
      } catch {
        // tables may not exist yet until migrations run
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId])

  if (loading) return <div className="p-6">Loading dashboard…</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">{roleLabel} Dashboard</h2>
        <p className="text-sm text-neutral-500">Your personal overview for {formatLagos(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Checked in today" value={stats.myAttendance} icon={<Clock className="w-5 h-5 text-green-600" />} />
        <StatCard title="Pending leave" value={stats.myPendingLeave} icon={<Calendar className="w-5 h-5 text-brand-600" />} />
        <StatCard title="Open tasks" value={stats.myTasks} icon={<CheckCircle2 className="w-5 h-5 text-amber-500" />} />
        <StatCard title="Active projects" value={stats.myProjects} icon={<Briefcase className="w-5 h-5 text-blue-600" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Quick actions</h3>
          <div className="space-y-2">
            <button className="w-full flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700">
              <Clock className="w-4 h-4" /> Check in / Check out
            </button>
            <button className="w-full flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700">
              <Calendar className="w-4 h-4" /> Request leave
            </button>
            <button className="w-full flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700">
              <CheckCircle2 className="w-4 h-4" /> Review my tasks
            </button>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Your activity</h3>
          <p className="text-xs text-neutral-500">Recent activity appears here when migrations are applied.</p>
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
