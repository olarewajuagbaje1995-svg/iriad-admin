import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus } from 'lucide-react'
import { ROLES, ROLE_LABELS, type Role } from '@/config/brand'
import { canManage, isAdminOrDirector } from '@/lib/permissions'
import { useAuth } from '@/hooks/useAuth'

export default function StaffPage() {
  const { profile } = useAuth()
  const myRole = (profile?.role as Role | null) ?? null
  const [staff, setStaff] = useState<any[]>([])
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openAdd, setOpenAdd] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  const [addForm, setAddForm] = useState({
    fullName: '',
    email: '',
    role: 'staff' as string,
    department: '',
  })

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const [profiles, audits] = await Promise.all([
        supabase.from('profiles').select('*, departments(name)').order('full_name', { ascending: true }),
        supabase.from('staff_audit_log').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(50),
      ])
      setStaff(profiles.data ?? [])
      setAuditLog(audits.data ?? [])
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const isSaving = saving !== null

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.email || !addForm.fullName) {
      alert('Please fill in full name and email.')
      return
    }
    // Only admins can create admin/director accounts; staff creation is open to admins/directors
    if ((addForm.role === 'admin' || addForm.role === 'director') && !canManage(myRole, addForm.role as any)) {
      alert('Only an Admin can create Admin or Director accounts.')
      return
    }
    setSaving('create')
    try {
      // All account creation goes through the staff-provision Edge Function,
      // which uses the Supabase Admin API server-side and sends a secure
      // invitation email (no password is ever handled by the frontend).
      const { error } = await supabase.functions.invoke('staff-provision', {
        body: {
          action: 'create',
          email: addForm.email,
          fullName: addForm.fullName,
          role: addForm.role,
          departmentId: addForm.department || null,
        },
      })
      if (error) throw error

      setAddForm({ fullName: '', email: '', role: 'staff', department: '' })
      setOpenAdd(false)
      load()
    } catch (err: any) {
      alert(err.message || 'Failed to create staff account')
    } finally {
      setSaving(null)
    }
  }

  const updateRole = async (id: string, role: string) => {
    if (!canManage(myRole, role as any)) {
      alert('You are not permitted to assign that role.')
      return
    }
    setSaving(id)
    try {
      const { error } = await supabase.functions.invoke('staff-provision', {
        body: {
          action: 'update_role',
          targetUserId: id,
          role,
        },
      })
      if (error) throw error
      load()
    } catch (err: any) {
      alert(err.message || 'Failed to update role')
    } finally {
      setSaving(null)
    }
  }

  const toggleActive = async (id: string, currentlyActive: boolean) => {
    setSaving(id)
    try {
      const { error } = await supabase.functions.invoke('staff-provision', {
        body: {
          action: currentlyActive ? 'deactivate' : 'reactivate',
          targetUserId: id,
        },
      })
      if (error) throw error
      load()
    } catch (err: any) {
      alert(err.message || 'Failed to update status')
    } finally {
      setSaving(null)
    }
  }

  const deleteStaff = async (id: string) => {
    if (!confirm('Delete this staff account? This cannot be undone.')) return
    setSaving(id)
    try {
      // All account deletion goes through the staff-provision Edge Function,
      // which removes both the profile and the Auth user and writes an audit entry.
      const { error } = await supabase.functions.invoke('staff-provision', {
        body: {
          action: 'delete',
          targetUserId: id,
        },
      })
      if (error) throw error
      load()
    } catch (err: any) {
      alert(err.message || 'Failed to delete staff')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="p-6">Loading staff…</div>

  if (!isAdminOrDirector(myRole)) {
    return (
      <div className="p-6 text-center text-neutral-500">
        <p>You do not have permission to manage staff accounts.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Staff Management</h2>
          <p className="text-sm text-neutral-500">Create, edit, and deactivate staff accounts. Role changes are audited.</p>
        </div>
        <button
          onClick={() => setOpenAdd(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add staff
        </button>
      </div>

      <div className="card p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-neutral-200 text-neutral-500 text-xs uppercase">
                <th className="pb-3">Name</th>
                <th className="pb-3">Email</th>
                <th className="pb-3">Department</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-neutral-500">No staff records.</td></tr>
              ) : (
                staff.map((s) => (
                  <tr key={s.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-3 text-neutral-900">{s.full_name ?? '—'}</td>
                    <td className="py-3 text-neutral-600 text-sm">{s.email ?? '—'}</td>
                    <td className="py-3 text-neutral-600 text-sm">{ (s.departments as any)?.name ?? '—' }</td>
                    <td className="py-3">
                      <select
                        className="input input-sm text-[11px] bg-transparent border-0 focus:ring-0"
                        value={s.role}
                        disabled={isSaving}
                        onChange={(e) => updateRole(s.id, e.target.value)}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        s.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {s.is_active !== false ? 'Active' : 'Inactive'}
                      </span>{' '}
                      <button
                        onClick={() => toggleActive(s.id, s.is_active !== false)}
                        disabled={isSaving}
                        className="text-[10px] px-2 py-0.5 rounded border border-neutral-300 text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
                      >
                        {s.is_active !== false ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => deleteStaff(s.id)}
                        disabled={isSaving}
                        className="text-[10px] text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Audit log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-neutral-200 text-neutral-500 text-xs uppercase">
                <th className="pb-3">Staff</th>
                <th className="pb-3">Action</th>
                <th className="pb-3">New value</th>
                <th className="pb-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-neutral-500">No audit entries yet.</td></tr>
              ) : (
                auditLog.map((a) => (
                  <tr key={a.id} className="border-b border-neutral-100">
                    <td className="py-3 text-neutral-900 text-sm">{ (a.profiles as any)?.full_name ?? '—' }</td>
                    <td className="py-3 text-neutral-600 text-sm">{a.action?.replace('_', ' ') ?? '—'}</td>
                    <td className="py-3 text-neutral-600 text-sm">{a.new_value ?? '—'}</td>
                    <td className="py-3 text-right text-neutral-500 text-xs">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpenAdd(false)} />
          <div className="relative z-10 bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-900">Add staff account</h3>
              <button onClick={() => setOpenAdd(false)} className="p-1 text-neutral-400 hover:text-neutral-600">✕</button>
            </div>
            <form onSubmit={createStaff} className="space-y-4">
              <div>
                <label className="label block mb-1">Full name</label>
                <input
                  className="input"
                  value={addForm.fullName}
                  onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="label block mb-1">Email</label>
                <input
                  className="input"
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="email@iriad.example"
                />
              </div>
              <div>
                <label className="label block mb-1">Role</label>
                <select
                  className="input"
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value as any })}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-500 mt-1">
                  Only an Admin can create Admin or Director accounts.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" className="btn-ghost text-xs" onClick={() => setOpenAdd(false)}>Cancel</button>
                <button type="submit" className="btn-primary text-xs" disabled={isSaving}>
                  {isSaving ? 'Creating…' : 'Create account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
