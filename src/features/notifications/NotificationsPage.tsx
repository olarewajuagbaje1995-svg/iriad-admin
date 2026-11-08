import { useNotifications } from '@/hooks/useNotifications'
import { Bell, Clock } from 'lucide-react'

export default function NotificationsPage() {
  const { notifications, loading, markRead, refresh } = useNotifications()

  if (loading) return <div className="p-6">Loading notifications…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Notifications</h2>
          <p className="text-sm text-neutral-500">In-app notifications for attendance, tasks, reports, and announcements.</p>
        </div>
        <button className="btn-ghost text-xs" onClick={refresh}>
          <Clock className="w-3 h-3 mr-1" /> Refresh
        </button>
      </div>

      <div className="card p-5">
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-10 text-neutral-500">
              <Bell className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
              <p>No new notifications.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => markRead(n.id!)}
                className={`p-4 rounded-lg border border-neutral-200 bg-white cursor-pointer hover:bg-neutral-50 transition-colors ${
                  !n.is_read ? 'border-brand-200 bg-brand-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-neutral-900">{n.title}</div>
                    <p className="text-sm text-neutral-600 mt-1">{n.body ?? ''}</p>
                    {n.link && (
                      <div className="mt-2 text-[10px] text-brand-600 underline">{n.link}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded ${
                      !n.is_read ? 'bg-brand-100 text-brand-700' : 'bg-neutral-100 text-neutral-500'
                    }`}>
                      {!n.is_read ? 'New' : 'Read'}
                    </span>
                    <span className="text-neutral-400">{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
