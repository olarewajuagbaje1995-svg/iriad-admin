import { useState, useEffect } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Clock, Plus, User, Trash2, Pencil, Save, X } from 'lucide-react'
import type { Role } from '@/config/brand'

export default function TasksPage() {
  const { profile } = useAuth()
  const role: Role = (profile?.role as Role) ?? 'staff'
  const userId = profile?.id ?? undefined
  const { tasks, loading, error, createTask, editTask, deleteTask, updateStatus, refresh } = useTasks({ userId, role })

  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newAssignee, setNewAssignee] = useState<string | null>(null)
  const [newDueDate, setNewDueDate] = useState('')
  const [staff, setStaff] = useState<{ id: string; full_name: string }[]>([])

  // Fetch staff members for the assignee dropdown.
  useEffect(() => {
    void loadStaff()
  }, [])

  const loadStaff = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('is_active', true)
        .order('full_name', { ascending: true })
      const staffList = (data ?? []).filter((p: any) => p.role === 'staff' || p.role === 'admin' || p.role === 'director')
      setStaff(staffList.map((p: any) => ({ id: p.id, full_name: p.full_name ?? 'Unnamed' })))
    } catch (e: any) {
      console.error(e)
    }
  }

  // Edit task state.
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editAssignee, setEditAssignee] = useState<string | null>(null)
  const [editDueDate, setEditDueDate] = useState('')
  const [editStatus, setEditStatus] = useState('')

  // Check if the current user can edit/delete this task (creator or admin/director).
  const canManageTask = (task: any) => {
    return task.created_by === userId || role === 'admin' || role === 'director'
  }

  const startEdit = (task: any) => {
    if (!canManageTask(task)) return
    setEditingTaskId(task.id)
    setEditTitle(task.title)
    setEditDesc(task.description ?? '')
    setEditAssignee(task.task_assignees?.[0]?.profile_id ?? null)
    setEditDueDate(task.due_date ?? '')
    setEditStatus(task.status)
  }

  const cancelEdit = () => {
    setEditingTaskId(null)
    setEditTitle('')
    setEditDesc('')
    setEditAssignee(null)
    setEditDueDate('')
    setEditStatus('')
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTaskId) return
    await editTask(editingTaskId, {
      title: editTitle,
      description: editDesc || null,
      status: editStatus,
      due_date: editDueDate || null,
      assigneeId: editAssignee,
    })
    cancelEdit()
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this task?')) return
    await deleteTask(id)
    if (editingTaskId === id) cancelEdit()
  }

  if (loading) return <div className="p-6">Loading tasks…</div>

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    await createTask({
      title: newTitle,
      description: newDesc || null,
      status: 'not_started',
      due_date: newDueDate || null,
      assigneeId: newAssignee || undefined,
    })
    setNewTitle('')
    setNewDesc('')
    setNewAssignee(null)
    setNewDueDate('')
  }

  const assigneeName = (task: any) => {
    const assignee = task.task_assignees?.[0]
    if (!assignee) return 'Unassigned'
    const staffMember = staff.find((s) => s.id === assignee.profile_id)
    return staffMember ? staffMember.full_name : assignee.profile_id
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">My Tasks</h2>
        <p className="text-sm text-neutral-500">View and update your assigned tasks and progress.</p>
      </div>

      {/* Create task form */}
      <div className="card p-5">
        <form onSubmit={(e) => void handleCreate(e)} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div className="col-span-1 sm:col-span-2">
            <label className="label">Task title</label>
            <input
              className="input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Draft weekly report"
            />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <label className="label">Notes / description</label>
            <input
              className="input"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Add details..."
            />
          </div>
          <div className="col-span-1 sm:col-span-1">
            <label className="label">Assign to</label>
            <select
              className="input"
              value={newAssignee ?? ''}
              onChange={(e) => setNewAssignee(e.target.value || null)}
            >
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-1 sm:col-span-1">
            <label className="label">Due date</label>
            <input
              type="date"
              className="input"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
            />
          </div>
          <button className="btn-primary col-span-1 sm:col-auto" disabled={loading}>
            <Plus className="w-4 h-4 mr-2" /> Create task
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider">
            {role === 'staff' ? 'Your tasks' : 'All tasks'}
          </h3>
          <button className="btn-ghost text-xs" onClick={() => void refresh()}>
            <Clock className="w-3 h-3 mr-1" /> Refresh
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center py-10 text-neutral-500">
            <User className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
            <p>No tasks assigned yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((t) =>
              editingTaskId === t.id ? (
                <div className="card p-4" key={t.id}>
                  <form onSubmit={handleEditSave} className="space-y-3 sm:grid sm:grid-cols-2 sm:gap-3">
                    <div className="col-span-1 sm:col-span-2">
                      <label className="label">Title</label>
                      <input
                        className="input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <label className="label">Notes / description</label>
                      <input
                        className="input"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-1">
                      <label className="label">Assign to</label>
                      <select
                        className="input"
                        value={editAssignee ?? ''}
                        onChange={(e) => setEditAssignee(e.target.value || null)}
                      >
                        <option value="">Unassigned</option>
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1 sm:col-span-1">
                      <label className="label">Due date</label>
                      <input
                        type="date"
                        className="input"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-1">
                      <label className="label">Status</label>
                      <select
                        className="input"
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
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
                    <div className="col-span-1 sm:col-auto flex items-end gap-2">
                      <button type="button" className="btn-ghost" onClick={cancelEdit}>
                        <X className="w-4 h-4" /> Cancel
                      </button>
                      <button type="submit" className="btn-primary">
                        <Save className="w-4 h-4 mr-1" /> Save
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-neutral-200 bg-white" key={t.id}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-neutral-900 truncate">{t.title}</div>
                    {t.description && <p className="text-xs text-neutral-500 truncate">{t.description}</p>}
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded border text-[10px] font-medium border-neutral-200 text-neutral-600 capitalize">
                        {t.priority}
                      </span>
                      <span className="text-neutral-400">Due {t.due_date ?? '—'}</span>
                      <span className="text-neutral-400">• {assigneeName(t)}</span>
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
                      onChange={(e) => void updateStatus(t.id, e.target.value as any, 'Status updated')}
                    >
                      <option value="not_started">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="submitted">Submitted</option>
                      <option value="completed">Completed</option>
                      <option value="revision_requested">Revision requested</option>
                      <option value="overdue">Overdue</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    {canManageTask(t) && (
                      <>
                        <button
                          type="button"
                          className="btn-ghost text-xs p-1.5 text-neutral-500 hover:text-brand-600"
                          title="Edit task"
                          onClick={() => startEdit(t)}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost text-xs p-1.5 text-neutral-500 hover:text-red-600"
                          title="Delete task"
                          onClick={() => handleDelete(t.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
