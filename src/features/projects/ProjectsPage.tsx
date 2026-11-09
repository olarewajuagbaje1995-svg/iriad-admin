import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Plus, Trash2, Pencil, Save } from 'lucide-react'

export default function ProjectsPage() {
  const { profile } = useAuth()
  const role: string = (profile?.role as string) ?? 'staff'

  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formLeadId, setFormLeadId] = useState<string | null>(null)
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formStatus, setFormStatus] = useState('planning')
  const [creating, setCreating] = useState(false)
  const [staff, setStaff] = useState<{ id: string; full_name: string }[]>([])

  // Edit project state.
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editLeadId, setEditLeadId] = useState<string | null>(null)
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editStatus, setEditStatus] = useState('')

  const canManageProject = () => role === 'admin' || role === 'director'

  useEffect(() => {
    load()
    loadStaff()
  }, [])

  const load = async () => {
    try {
      const { data } = await supabase
        .from('projects')
        .select('*, project_members(profile_id), profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(50)
      setProjects(data ?? [])
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

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

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim()) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setCreating(true)
    try {
      const { data: project, error: err } = await supabase
        .from('projects')
        .insert([{
          title: formTitle,
          description: formDescription || null,
          start_date: formStartDate || null,
          end_date: formEndDate || null,
          project_lead_id: formLeadId || user.id,
          status: formStatus,
          created_by: user.id,
        }])
        .select()
        .single()
      if (err) throw err

      // Ensure the project lead is a member of the project.
      await supabase.from('project_members').insert([{
        project_id: project.id,
        profile_id: formLeadId || user.id,
        role: 'lead',
      }])

      setShowForm(false)
      setFormTitle('')
      setFormDescription('')
      setFormLeadId(null)
      setFormStartDate('')
      setFormEndDate('')
      setFormStatus('planning')
      load()
    } catch (err: any) {
      alert(err.message || 'Failed to create project.')
    } finally {
      setCreating(false)
    }
  }

  const startEditProject = (p: any) => {
    if (!canManageProject()) return
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
      const { error: err } = await supabase
        .from('projects')
        .update({
          title: editTitle,
          description: editDescription || null,
          project_lead_id: editLeadId || undefined,
          start_date: editStartDate || null,
          end_date: editEndDate || null,
          status: editStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingProjectId)
      if (err) throw err
      cancelEditProject()
      load()
    } catch (err: any) {
      alert(err.message || 'Failed to update project.')
    }
  }

  const handleDeleteProject = async (id: string) => {
    if (!canManageProject()) return
    if (!window.confirm('Delete this project?')) return
    try {
      const { error: err } = await supabase.from('projects').delete().eq('id', id)
      if (err) throw err
      load()
    } catch (err: any) {
      alert(err.message || 'Failed to delete project.')
    }
  }

  if (loading) return <div className="p-6">Loading projects…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Projects</h2>
          <p className="text-sm text-neutral-500">Manage projects, teams, milestones, and deliverables.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)} title="New project">
          <Plus className="w-4 h-4 mr-2" /> New project
        </button>
      </div>

      {showForm && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">New project</h3>
          <form onSubmit={(e) => void createProject(e)} className="space-y-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-2">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">Project title</label>
              <input
                className="input w-full"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Website redesign"
                required
              />
            </div>
            <div className="col-span-2 sm:col-span-2">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">Description</label>
              <input
                className="input w-full"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief project description"
              />
            </div>
            <div className="col-span-1 sm:col-span-1">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">Project lead</label>
              <select
                className="input w-full"
                value={formLeadId ?? ''}
                onChange={(e) => setFormLeadId(e.target.value || null)}
              >
                <option value="">Myself</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-1 sm:col-span-1">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">Start date</label>
              <input
                type="date"
                className="input w-full"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
              />
            </div>
            <div className="col-span-1 sm:col-span-1">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">End date</label>
              <input
                type="date"
                className="input w-full"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
              />
            </div>
            <div className="col-span-1 sm:col-span-1">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">Status</label>
              <select
                className="input w-full"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="col-span-2 sm:col-auto flex items-end">
              <button type="button" className="btn-ghost mr-2" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </form>
        </div>
      )}

      {editingProjectId && canManageProject() && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Edit project</h3>
          <form onSubmit={handleEditProjectSave} className="space-y-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-2">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">Project title</label>
              <input
                className="input w-full"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </div>
            <div className="col-span-2 sm:col-span-2">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">Description</label>
              <input
                className="input w-full"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="col-span-1 sm:col-span-1">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">Project lead</label>
              <select
                className="input w-full"
                value={editLeadId ?? ''}
                onChange={(e) => setEditLeadId(e.target.value || null)}
              >
                <option value="">Myself</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-1 sm:col-span-1">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">Start date</label>
              <input
                type="date"
                className="input w-full"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
              />
            </div>
            <div className="col-span-1 sm:col-span-1">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">End date</label>
              <input
                type="date"
                className="input w-full"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
              />
            </div>
            <div className="col-span-1 sm:col-span-1">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">Status</label>
              <select
                className="input w-full"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="col-span-2 sm:col-auto flex items-end gap-2">
              <button type="button" className="btn-ghost mr-2" onClick={cancelEditProject}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                <Save className="w-4 h-4 mr-1" /> Save
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-neutral-200 text-neutral-500 text-xs uppercase">
                <th className="pb-3">Project</th>
                <th className="pb-3">Lead</th>
                <th className="pb-3">Dates</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Members</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-neutral-500">No projects yet.</td></tr>
              ) : (
                projects.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-3 text-neutral-900">{p.title}</td>
                    <td className="py-3 text-neutral-600 text-sm">
                      {formLeadName(p) ?? (p.profiles as any)?.full_name ?? '—'}
                    </td>
                    <td className="py-3 text-neutral-600 text-sm">{p.start_date ?? '—'} → {p.end_date ?? '—'}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        p.status === 'completed' ? 'bg-green-100 text-green-700' :
                        p.status === 'active' ? 'bg-blue-100 text-blue-700' :
                        p.status === 'on_hold' ? 'bg-amber-100 text-amber-700' :
                        'bg-neutral-100 text-neutral-600'
                      }`}>
                        {p.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-neutral-600 text-sm">
                      {(p.project_members as any[])?.length ?? 0} members
                    </td>
                    <td className="py-3 text-right">
                      {canManageProject() ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="btn-ghost text-xs p-1.5 text-neutral-500 hover:text-brand-600"
                            title="Edit project"
                            onClick={() => startEditProject(p)}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            className="btn-ghost text-xs p-1.5 text-neutral-500 hover:text-red-600"
                            title="Delete project"
                            onClick={() => handleDeleteProject(p.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  function formLeadName(p: any): string | undefined {
    const leadId = p.project_lead_id
    if (!leadId) return undefined
    const member = staff.find((s) => s.id === leadId)
    return member ? member.full_name : undefined
  }
}
