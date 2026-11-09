import { useState, useEffect } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  Clock, Plus, User, Trash2, Pencil, Save, X, Mail, CheckCircle2,
  AlertCircle, Calendar, Loader2,
} from 'lucide-react'
import type { Role } from '@/config/brand'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Not Started', color: 'text-neutral-600', bg: 'bg-neutral-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-100' },
  submitted: { label: 'Submitted', color: 'text-amber-700', bg: 'bg-amber-100' },
  completed: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
  revision_requested: { label: 'Revision Requested', color: 'text-purple-700', bg: 'bg-purple-100' },
  overdue: { label: 'Overdue', color: 'text-red-700', bg: 'bg-red-100' },
  cancelled: { label: 'Cancelled', color: 'text-neutral-500', bg: 'bg-neutral-100' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: 'text-blue-600', bg: 'bg-blue-50' },
  medium: { label: 'Medium', color: 'text-amber-600', bg: 'bg-amber-50' },
  high: { label: 'High', color: 'text-orange-600', bg: 'bg-orange-50' },
  urgent: { label: 'Urgent', color: 'text-red-600', bg: 'bg-red-50' },
}

export default function TasksPage() {
  const { profile } = useAuth()
  const role: Role = (profile?.role as Role) ?? 'staff'
  const userId = profile?.id ?? undefined
  const { tasks, loading, error, createTask, editTask, deleteTask, updateStatus, refresh } = useTasks({ userId, role, organisationId: profile?.organisation_id ?? undefined })

  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newAssignee, setNewAssignee] = useState<string | null>(null)
  const [newPriority, setNewPriority] = useState('medium')
  const [newDueDate, setNewDueDate] = useState('')
  const [staff, setStaff] = useState<{ id: string; full_name: string }[]>([])

  // Edit task state.
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editAssignee, setEditAssignee] = useState<string | null>(null)
  const [editPriority, setEditPriority] = useState('medium')
  const [editDueDate, setEditDueDate] = useState('')
  const [editStatus, setEditStatus] = useState('')

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
    setEditPriority(task.priority ?? 'medium')
    setEditDueDate(task.due_date ?? '')
    setEditStatus(task.status)
  }

  const cancelEdit = () => {
    setEditingTaskId(null)
    setEditTitle('')
    setEditDesc('')
    setEditAssignee(null)
    setEditPriority('medium')
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
      priority: editPriority,
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    await createTask({
      title: newTitle,
      description: newDesc || null,
      status: 'not_started',
      priority: newPriority,
      due_date: newDueDate || null,
      assigneeId: newAssignee || undefined,
    })
    setNewTitle('')
    setNewDesc('')
    setNewAssignee(null)
    setNewPriority('medium')
    setNewDueDate('')
  }

  const assigneeName = (task: any) => {
    const assignee = task.task_assignees?.[0]
    if (!assignee) return null
    const profileName = assignee.profiles?.full_name
    if (profileName) return profileName
    const staffMember = staff.find((s) => s.id === assignee.profile_id)
    return staffMember ? staffMember.full_name : null
  }

  const statusConfig = (status: string) => STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started
  const priorityConfig = (priority: string) => PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium

  const taskCounts = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'not_started' || t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    overdue: tasks.filter((t) => t.status === 'overdue').length,
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      <p className="mt-4 text-sm text-neutral-500">Loading tasks…</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">My Tasks</h2>
          <p className="text-sm text-neutral-500">
            {role === 'staff' ? 'Manage your assigned tasks and track progress.' : 'Oversee all tasks and manage team assignments.'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="btn-ghost px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-neutral-100"
            onClick={() => void refresh()}
          >
            <Clock className="w-4 h-4 mr-2" /> Refresh
          </button>
          <button
            className="btn-primary px-4 py-2 rounded-lg text-sm font-medium transition-all hover:shadow-md"
            onClick={() => setEditingTaskId(null)}
          >
            <Plus className="w-4 h-4 mr-2" /> New Task
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-neutral-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total</p>
              <p className="text-2xl font-bold text-neutral-900">{taskCounts.total}</p>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Mail className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-neutral-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Pending</p>
              <p className="text-2xl font-bold text-neutral-900">{taskCounts.pending}</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-neutral-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Completed</p>
              <p className="text-2xl font-bold text-neutral-900">{taskCounts.completed}</p>
            </div>
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-neutral-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Overdue</p>
              <p className="text-2xl font-bold text-neutral-900">{taskCounts.overdue}</p>
            </div>
            <div className="p-2 rounded-lg bg-red-50 text-red-600">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Create task card */}
      <div className="p-6 rounded-2xl bg-white border border-neutral-100 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Create New Task</h3>
          <Plus className="w-4 h-4 text-brand-600" />
        </div>
        <form onSubmit={(e) => void handleCreate(e)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="col-span-1 sm:col-span-2 lg:col-span-2">
            <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Task title</label>
            <input
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Draft weekly report"
            />
          </div>
          <div className="col-span-1 sm:col-span-2 lg:col-span-2">
            <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Description</label>
            <input
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Add details..."
            />
          </div>
          <div className="col-span-1 sm:col-span-1 lg:col-span-1">
            {role !== 'staff' && (
              <>
                <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Assign to</label>
                <select
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                  value={newAssignee ?? ''}
                  onChange={(e) => setNewAssignee(e.target.value || null)}
                >
                  <option value="">Unassigned</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </>
            )}
            {role === 'staff' && (
              <div className="px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-400 text-sm">
                Unassigned
              </div>
            )}
          </div>
          <div className="col-span-1 sm:col-span-1 lg:col-span-1">
            <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Priority</label>
            <select
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
            >
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
          <div className="col-span-1 sm:col-span-1 lg:col-span-1">
            <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Due date</label>
            <input
              type="date"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
            />
          </div>
          <div className="col-span-1 sm:col-span-2 lg:col-span-1 flex items-end">
            <button
              type="submit"
              className="w-full btn-primary px-6 py-3 rounded-xl text-sm font-medium transition-all hover:shadow-md hover:shadow-brand-100"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {loading ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </form>
        {error && (
          <p className="mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>

      {/* Tasks list */}
      <div className="p-6 rounded-2xl bg-white border border-neutral-100 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
            {role === 'staff' ? 'Your Tasks' : 'All Tasks'}
          </h3>
          <button
            className="btn-ghost text-xs px-3 py-2 rounded-lg transition-all hover:bg-neutral-100"
            onClick={() => void refresh()}
          >
            <Clock className="w-3 h-3 mr-1.5" /> Refresh
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
              <User className="w-8 h-8" />
            </div>
            <p className="text-sm font-medium text-neutral-700 mb-1">No tasks yet</p>
            <p className="text-xs text-neutral-500">
              {role === 'staff'
                ? 'You haven’t been assigned any tasks yet.'
                : 'No tasks have been created yet. Get started by creating one above.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((t) => (
              editingTaskId === t.id ? (
                <div key={t.id} className="p-6 rounded-2xl bg-white border border-brand-200 shadow-sm ring-1 ring-brand-200">
                  <form onSubmit={handleEditSave} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="col-span-1 sm:col-span-2 lg:col-span-2">
                      <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Title</label>
                      <input
                        className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-2 lg:col-span-2">
                      <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Description</label>
                      <input
                        className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-1 lg:col-span-1">
                      {role !== 'staff' && (
                        <>
                          <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Assign to</label>
                          <select
                            className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                            value={editAssignee ?? ''}
                            onChange={(e) => setEditAssignee(e.target.value || null)}
                          >
                            <option value="">Unassigned</option>
                            {staff.map((s) => (
                              <option key={s.id} value={s.id}>{s.full_name}</option>
                            ))}
                          </select>
                        </>
                      )}
                      {role === 'staff' && (
                        <div className="px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-400 text-sm">
                          Unassigned
                        </div>
                      )}
                    </div>
                    <div className="col-span-1 sm:col-span-1 lg:col-span-1">
                      <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Priority</label>
                      <select
                        className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value)}
                      >
                        {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                          <option key={key} value={key}>{cfg.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1 sm:col-span-1 lg:col-span-1">
                      <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Due date</label>
                      <input
                        type="date"
                        className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-1 lg:col-span-1">
                      <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Status</label>
                      <select
                        className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                      >
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                          <option key={key} value={key}>{cfg.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1 sm:col-span-2 lg:col-span-2 flex items-end gap-3">
                      <button
                        type="button"
                        className="btn-ghost px-6 py-3 rounded-xl text-sm font-medium transition-all hover:bg-neutral-100"
                        onClick={cancelEdit}
                      >
                        <X className="w-4 h-4 mr-2" /> Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn-primary px-6 py-3 rounded-xl text-sm font-medium transition-all hover:shadow-md"
                      >
                        <Save className="w-4 h-4 mr-2" /> Save Changes
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div
                  key={t.id}
                  className="p-5 rounded-2xl bg-white border border-neutral-100 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
                  onClick={() => canManageTask(t) && setEditingTaskId(t.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold uppercase ${priorityConfig(t.priority).bg} ${priorityConfig(t.priority).color}`}
                        >
                          {priorityConfig(t.priority).label}
                        </span>
                        {t.priority === 'urgent' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                        )}
                      </div>
                      <div className="text-sm font-semibold text-neutral-900 truncate mb-1">{t.title}</div>
                      {t.description && (
                        <p className="text-sm text-neutral-500 truncate mb-3 line-clamp-1">{t.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-sm">
                        {t.due_date && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-50 border border-neutral-100">
                            <Calendar className="w-3 h-3 text-neutral-400" />
                            <span className="text-neutral-600 font-medium">{t.due_date}</span>
                          </div>
                        )}
                        {assigneeName(t) && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-50 border border-neutral-100">
                            <div className="w-2 h-2 rounded-full bg-brand-600" />
                            <span className="text-neutral-600 font-medium">{assigneeName(t)}</span>
                          </div>
                        )}
                        {!assigneeName(t) && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-50 border border-neutral-100">
                            <User className="w-3 h-3 text-neutral-400" />
                            <span className="text-neutral-400 text-sm">Unassigned</span>
                          </div>
                                                    )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase ${statusConfig(t.status).bg} ${statusConfig(t.status).color}`}
                      >
                        {statusConfig(t.status).label}
                      </span>
                      <select
                        className="w-32 px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-600 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                        value={t.status}
                        onChange={(e) => void updateStatus(t.id, e.target.value as any, 'Status updated')}
                      >
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                          <option key={key} value={key}>{cfg.label}</option>
                        ))}
                      </select>
                      {canManageTask(t) && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            type="button"
                            className="w-8 h-8 rounded-xl bg-neutral-50 flex items-center justify-center text-neutral-500 hover:bg-brand-600 hover:text-white transition-all"
                            title="Edit task"
                            onClick={(e) => {
                              e.stopPropagation()
                              startEdit(t)
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className="w-8 h-8 rounded-xl bg-neutral-50 flex items-center justify-center text-neutral-500 hover:bg-red-600 hover:text-white transition-all"
                            title="Delete task"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(t.id)
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
