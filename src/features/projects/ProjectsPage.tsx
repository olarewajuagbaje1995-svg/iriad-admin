import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useProjects } from '@/hooks/useProjects'
import {
  Plus, Trash2, Pencil, Save, Clock, X, Calendar, Loader2, User, Mail,
} from 'lucide-react'
import type { Role } from '@/config/brand'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  planning: { label: 'Planning', color: 'text-neutral-600', bg: 'bg-neutral-100' },
  active: { label: 'Active', color: 'text-blue-700', bg: 'bg-blue-100' },
  on_hold: { label: 'On Hold', color: 'text-amber-700', bg: 'bg-amber-100' },
  completed: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
  cancelled: { label: 'Cancelled', color: 'text-neutral-500', bg: 'bg-neutral-100' },
}

export default function ProjectsPage() {
  const { profile } = useAuth()
  const role: Role = (profile?.role as Role) ?? 'staff'
  const userId = profile?.id ?? undefined
  const canManageProject = role === 'admin' || role === 'director'

  const { projects, loading, error, updateProjectStatus, createProject, editProject, deleteProject, refresh } = useProjects({ userId, role })

  const [staff, setStaff] = useState<{ id: string; full_name: string }[]>([])

  // Create project form state.
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formLeadId, setFormLeadId] = useState<string | null>(null)
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formStatus, setFormStatus] = useState('planning')
  const [creating, setCreating] = useState(false)

  // Edit project form state.
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editLeadId, setEditLeadId] = useState<string | null>(null)
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editStatus, setEditStatus] = useState('')

  useEffect(() => {
    loadStaff()
  }, [])

  const loadStaff = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('is_active', true)
        .order('full_name', { ascending: true })
      setStaff((data ?? []).map((p: any) => ({ id: p.id, full_name: p.full_name ?? 'Unnamed' })))
    } catch (e: any) {
      console.error(e)
    }
  }

  const leadName = (leadId: string | null | undefined): string => {
    if (!leadId) return '—'
    const member = staff.find((s) => s.id === leadId)
    return member ? member.full_name : '—'
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim()) return

    setCreating(true)
    try {
      await createProject({
        title: formTitle,
        description: formDescription || null,
        start_date: formStartDate || null,
        end_date: formEndDate || null,
        project_lead_id: formLeadId || null,
        status: formStatus,
      })
      setShowForm(false)
      setFormTitle('')
      setFormDescription('')
      setFormLeadId(null)
      setFormStartDate('')
      setFormEndDate('')
      setFormStatus('planning')
    } catch (err: any) {
      alert(err.message || 'Failed to create project.')
    } finally {
      setCreating(false)
    }
  }

  const startEditProject = (p: any) => {
    if (!canManageProject) return
    setEditingProjectId(p.id)
    setEditTitle(p.title)
    setEditDescription(p.description ?? '')
    setEditLeadId(p.project_lead_id ?? null)
    setEditStartDate(p.start_date ?? '')
    setEditEndDate(p.end_date ?? '')
    setEditStatus(p.status)
  }

  const cancelEditProject = () => {
    setEditingProjectId(null)
    setEditTitle('')
    setEditDescription('')
    setEditLeadId(null)
    setEditStartDate('')
    setEditEndDate('')
    setEditStatus('')
  }

  const handleEditProjectSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProjectId) return
    try {
      await editProject(editingProjectId, {
        title: editTitle,
        description: editDescription || null,
        project_lead_id: editLeadId || null,
        start_date: editStartDate || null,
        end_date: editEndDate || null,
        status: editStatus,
      })
      cancelEditProject()
    } catch (err: any) {
      alert(err.message || 'Failed to update project.')
    }
  }

  const handleDeleteProject = async (id: string) => {
    if (!canManageProject) return
    if (!window.confirm('Delete this project?')) return
    try {
      await deleteProject(id)
    } catch (err: any) {
      alert(err.message || 'Failed to delete project.')
    }
  }

  const projectCounts = {
    total: projects.length,
    active: projects.filter((p) => p.status === 'active').length,
    planning: projects.filter((p) => p.status === 'planning').length,
    completed: projects.filter((p) => p.status === 'completed').length,
    onHold: projects.filter((p) => p.status === 'on_hold').length,
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      <p className="mt-4 text-sm text-neutral-500">Loading projects…</p>
    </div>
  )

  if (error) {
    return (
      <div className="p-6 text-neutral-500">
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Projects</h2>
          <p className="text-sm text-neutral-500">
            Manage projects, teams, milestones, and deliverables.
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
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-4 h-4 mr-2" /> New Project
          </button>
        </div>
      </div>

      {/* Quick stats — derived directly from the fetched projects array */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-neutral-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total</p>
              <p className="text-2xl font-bold text-neutral-900">{projectCounts.total}</p>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Mail className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-neutral-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Active</p>
              <p className="text-2xl font-bold text-neutral-900">{projectCounts.active}</p>
            </div>
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <Mail className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-neutral-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Planning</p>
              <p className="text-2xl font-bold text-neutral-900">{projectCounts.planning}</p>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-neutral-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Completed</p>
              <p className="text-2xl font-bold text-neutral-900">{projectCounts.completed}</p>
            </div>
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <Mail className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Create project card */}
      {showForm && (
        <div className="p-6 rounded-2xl bg-white border border-neutral-100 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">New Project</h3>
            <Plus className="w-4 h-4 text-brand-600" />
          </div>
          <form onSubmit={(e) => void handleCreateProject(e)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="col-span-1 sm:col-span-2 lg:col-span-2">
              <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Project title</label>
              <input
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Website redesign"
                required
              />
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-2">
              <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Description</label>
              <input
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief project description"
              />
            </div>
            <div className="col-span-1 sm:col-span-1 lg:col-span-1">
              {canManageProject && (
                <>
                  <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Project lead</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                    value={formLeadId ?? ''}
                    onChange={(e) => setFormLeadId(e.target.value || null)}
                  >
                    <option value="">Myself</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                  </select>
                </>
              )}
              {!canManageProject && (
                <div className="px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-400 text-sm">
                  Myself
                </div>
              )}
            </div>
            <div className="col-span-1 sm:col-span-1 lg:col-span-1">
              <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Start date</label>
              <input
                type="date"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
              />
            </div>
            <div className="col-span-1 sm:col-span-1 lg:col-span-1">
              <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">End date</label>
              <input
                type="date"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
              />
            </div>
            <div className="col-span-1 sm:col-span-1 lg:col-span-1">
              <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Status</label>
              <select
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
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
                onClick={() => setShowForm(false)}
              >
                <X className="w-4 h-4 mr-2" /> Cancel
              </button>
              <button
                type="submit"
                className="btn-primary px-6 py-3 rounded-xl text-sm font-medium transition-all hover:shadow-md hover:shadow-brand-100"
                disabled={creating}
              >
                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                {creating ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit project card */}
      {editingProjectId && canManageProject && (
        <div className="p-6 rounded-2xl bg-white border border-brand-200 shadow-sm ring-1 ring-brand-200">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Edit Project</h3>
            <X className="w-4 h-4 text-brand-600 cursor-pointer" onClick={cancelEditProject} />
          </div>
          <form onSubmit={handleEditProjectSave} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="col-span-1 sm:col-span-2 lg:col-span-2">
              <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Project title</label>
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
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="col-span-1 sm:col-span-1 lg:col-span-1">
              <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Project lead</label>
              <select
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                value={editLeadId ?? ''}
                onChange={(e) => setEditLeadId(e.target.value || null)}
              >
                <option value="">Myself</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-1 sm:col-span-1 lg:col-span-1">
              <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">Start date</label>
              <input
                type="date"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
              />
            </div>
            <div className="col-span-1 sm:col-span-1 lg:col-span-1">
              <label className="block mb-2 text-xs font-medium text-neutral-600 uppercase tracking-wider">End date</label>
              <input
                type="date"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
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
                onClick={cancelEditProject}
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
      )}

      {/* Projects list */}
      <div className="p-6 rounded-2xl bg-white border border-neutral-100 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">All Projects</h3>
          <button
            className="btn-ghost text-xs px-3 py-2 rounded-lg transition-all hover:bg-neutral-100"
            onClick={() => void refresh()}
          >
            <Clock className="w-3 h-3 mr-1.5" /> Refresh
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
              <Mail className="w-8 h-8" />
            </div>
            <p className="text-sm font-medium text-neutral-700 mb-1">No projects yet</p>
            <p className="text-xs text-neutral-500">
              {role === 'staff'
                ? 'You haven’t been added to any projects yet.'
                : 'No projects have been created yet. Get started by creating one above.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              editingProjectId === p.id ? (
                // Edit form shown separately above; render a placeholder row.
                <div key={p.id} className="p-5 rounded-2xl bg-neutral-50 border border-neutral-100" />
              ) : (
                <div
                  key={p.id}
                  className="p-5 rounded-2xl bg-white border border-neutral-100 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
                  onClick={() => canManageProject && setEditingProjectId(p.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Interactive status dropdown — stopPropagation prevents card edit toggle */}
                      <select
                        className="w-32 px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-600 focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all"
                        value={p.status}
                        onChange={(e) => {
                          e.stopPropagation()
                          void updateProjectStatus(p.id, e.target.value)
                        }}
                      >
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                          <option key={key} value={key}>{cfg.label}</option>
                        ))}
                      </select>
                      <div className="text-sm font-semibold text-neutral-900 truncate mb-1 mt-2">{p.title}</div>
                      {p.description && (
                        <p className="text-sm text-neutral-500 truncate mb-3 line-clamp-1">{p.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-sm">
                        {(p.start_date || p.end_date) && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-50 border border-neutral-100">
                            <Calendar className="w-3 h-3 text-neutral-400" />
                            <span className="text-neutral-600 font-medium">
                              {p.start_date ?? '—'} → {p.end_date ?? '—'}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-50 border border-neutral-100">
                          <User className="w-3 h-3 text-neutral-400" />
                          <span className="text-neutral-600 font-medium">{leadName(p.project_lead_id)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-50 border border-neutral-100">
                          <div className="w-2 h-2 rounded-full bg-brand-600" />
                          <span className="text-neutral-600 font-medium">
                            {(p.project_members as any[])?.length ?? 0} members
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      {canManageProject && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            type="button"
                            className="w-8 h-8 rounded-xl bg-neutral-50 flex items-center justify-center text-neutral-500 hover:bg-brand-600 hover:text-white transition-all"
                            title="Edit project"
                            onClick={(e) => {
                              e.stopPropagation()
                              startEditProject(p)
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className="w-8 h-8 rounded-xl bg-neutral-50 flex items-center justify-center text-neutral-500 hover:bg-red-600 hover:text-white transition-all"
                            title="Delete project"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteProject(p.id)
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
