import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Plus, Share2, X, Mail, Pencil, Trash2, Save } from 'lucide-react'

export default function AnnouncementsPage() {
  const { profile } = useAuth()
  const role = (profile?.role as 'admin' | 'director' | 'staff') ?? 'staff'
  const isAdminOrDirector = role === 'admin' || role === 'director'

  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [sending, setSending] = useState(false)

  // Inline edit state.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editIsPublished, setEditIsPublished] = useState(true)
  const [saving, setSaving] = useState(false)

  // Delete state.
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setError(null)
      const { data, error: err } = await supabase
        .from('announcements')
        .select('*, profiles(full_name)')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
      if (err) throw err
      setAnnouncements(data ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const createAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim() || !formBody.trim()) return

    const webhookUrl = import.meta.env.VITE_N8N_ANNOUNCEMENT_WEBHOOK_URL
    if (!webhookUrl) {
      setError('Announcement webhook is not configured. Please contact your administrator.')
      return
    }

    setSending(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (user) headers['Authorization'] = `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}`

      await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: formTitle.trim(),
          body: formBody.trim(),
          category: formCategory.trim() || 'general',
          created_by: user?.id,
        }),
      })
      setShowForm(false)
      setFormTitle('')
      setFormBody('')
      setFormCategory('')
      await load()
    } catch (err: any) {
      setError(err.message || 'Failed to send announcement webhook.')
    } finally {
      setSending(false)
    }
  }

  const startEdit = (announcement: any) => {
    setEditingId(announcement.id)
    setEditTitle(announcement.title ?? '')
    setEditBody(announcement.body ?? '')
    setEditCategory(announcement.category ?? '')
    setEditIsPublished(announcement.is_published ?? true)
    setError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
    setEditBody('')
    setEditCategory('')
    setEditIsPublished(true)
    setError(null)
  }

  const updateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return

    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('announcements')
        .update({
          title: editTitle.trim(),
          body: editBody.trim(),
          category: editCategory.trim() || null,
          is_published: editIsPublished,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId)

      if (err) throw err
      cancelEdit()
      await load()
    } catch (err: any) {
      setError(err.message || 'Failed to update announcement.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this announcement? This cannot be undone.')) return

    setDeletingId(id)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id)

      if (err) throw err
      await load()
    } catch (err: any) {
      setError(err.message || 'Failed to delete announcement.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <div className="p-6">Loading announcements…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Announcements</h2>
          <p className="text-sm text-neutral-500">Organisation-wide announcements and feedback.</p>
        </div>
        <button className="btn-ghost" onClick={() => setShowForm(true)} title="New announcement">
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      {showForm && (
        <div className="card p-5">
          <h3 className="text-base font-semibold text-neutral-900 mb-4">New Announcement</h3>
          <form onSubmit={createAnnouncement} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Title</label>
              <input
                type="text"
                className="input w-full"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Office closed Friday"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Category</label>
              <input
                type="text"
                className="input w-full"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="e.g. operations, hr, it"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Message</label>
              <textarea
                className="input w-full min-h-[100px]"
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="Announcement details…"
                required
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>
                <X className="w-4 h-4" /> Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={sending}>
                {sending ? 'Sending…' : <><Mail className="w-4 h-4 mr-2" />Send Announcement</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="space-y-3">
        {announcements.length === 0 ? (
          <div className="text-center py-10 text-neutral-500">No announcements yet.</div>
        ) : (
          announcements.map((a) => {
            const isEditing = editingId === a.id
            const isDeleting = deletingId === a.id

            return (
              <div key={a.id} className={`card p-5 ${isEditing ? 'border-brand-200 ring-1 ring-brand-200' : ''}`}>
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-base font-semibold text-neutral-900">Edit Announcement</h3>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="btn-ghost text-xs hover:text-neutral-600"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    </div>
                    <form onSubmit={updateAnnouncement} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">Title</label>
                        <input
                          type="text"
                          className="input w-full"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">Category</label>
                        <input
                          type="text"
                          className="input w-full"
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">Message</label>
                        <textarea
                          className="input w-full min-h-[100px]"
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs font-medium text-neutral-700">
                          <input
                            type="checkbox"
                            checked={editIsPublished}
                            onChange={(e) => setEditIsPublished(e.target.checked)}
                            className="rounded"
                          />
                          Published
                        </label>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <button type="button" className="btn-ghost" onClick={cancelEdit}>
                          <X className="w-4 h-4 mr-2" /> Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={saving}
                        >
                          {saving ? 'Saving…' : <><Save className="w-4 h-4 mr-2" />Save changes</>}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-neutral-900">{a.title}</h3>
                        {a.category && (
                          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-200 text-[10px] font-medium text-neutral-600">
                            {a.category}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-neutral-400">
                        {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600 mb-3 line-clamp-2">{a.body}</p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-neutral-500">by {(a.profiles as any)?.full_name ?? 'Admin'}</span>
                      <Share2 className="w-3 h-3 text-neutral-400" />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {isAdminOrDirector && (
                        <button
                          onClick={() => startEdit(a)}
                          className="btn-ghost text-xs text-brand-600 hover:text-brand-700"
                        >
                          <Pencil className="w-3 h-3 mr-1" /> Edit
                        </button>
                      )}
                      {isAdminOrDirector && (
                        <button
                          onClick={() => handleDelete(a.id!)}
                          className="btn-ghost text-xs text-red-600 hover:text-red-700"
                          disabled={isDeleting}
                        >
                          {isDeleting ? 'Deleting…' : <><Trash2 className="w-3 h-3 mr-1" /> Delete</>}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
