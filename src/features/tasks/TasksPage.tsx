import { useState } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { Clock, Plus } from 'lucide-react'

export default function TasksPage() {
  const { tasks, loading, error, createTask, updateStatus, refresh } = useTasks()
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')

  if (loading) return <div className="p-6">Loading tasks…</div>

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    await createTask({ title: newTitle, description: newDesc, status: 'not_started' })
    setNewTitle('')
    setNewDesc('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">My Tasks</h2>
        <p className="text-sm text-neutral-500">View and update your assigned tasks and progress.</p>
      </div>

      {/* Create task form */}
      <div className="card p-5">
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="col-span-2 sm:col-span-2">
            <label className="label">Task title</label>
            <input
              className="input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Draft weekly report"
            />
          </div>
          <div className="col-span-2 sm:col-span-2">
            <label className="label">Description</label>
            <input
              className="input"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Add details..."
            />
          </div>
          <button className="btn-primary col-span-2 sm:col-auto" disabled={loading}>
            <Plus className="w-4 h-4 mr-2" /> Create task
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider">Your tasks</h3>
          <button className="btn-ghost text-xs" onClick={refresh}>
            <Clock className="w-3 h-3 mr-1" /> Refresh
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center py-10 text-neutral-500">No tasks assigned yet.</div>
        ) : (
          <div className="space-y-3">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-neutral-200 bg-white">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-neutral-900 truncate">{t.title}</div>
                  {t.description && <p className="text-xs text-neutral-500 truncate">{t.description}</p>}
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded border text-[10px] font-medium border-neutral-200 text-neutral-600 capitalize">
                      {t.priority}
                    </span>
                    <span className="text-neutral-400">Due {t.due_date ?? '—'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded text-[10px] font-semibold capitalize ${
                    t.status === 'completed' ? 'bg-green-100 text-green-700' :
                    t.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    t.status === 'submitted' ? 'bg-amber-100 text-amber-700' :
                    t.status === 'overdue' ? 'bg-red-100 text-red-700' :
                    'bg-neutral-100 text-neutral-600'
                  }`}>
                    {t.status.replace('_', ' ')}
                  </span>
                  <select
                    className="input input-sm text-[11px] px-2 py-1.5 w-32"
                    value={t.status}
                    onChange={(e) => updateStatus(t.id, e.target.value as any, 'Status updated')}
                  >
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="submitted">Submitted</option>
                    <option value="completed">Completed</option>
                    <option value="revision_requested">Revision requested</option>
                    <option value="overdue">Overdue</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
