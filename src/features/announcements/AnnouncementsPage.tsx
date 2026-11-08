import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Share2, X, Mail } from 'lucide-react'

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const { data } = await supabase
        .from('announcements')
        .select('*, profiles(full_name)')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
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
          announcements.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-neutral-900">{a.title}</h3>
                  {a.category && <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-200 text-[10px] font-medium text-neutral-600">{a.category}</span>}
                </div>
                <span className="text-[10px] text-neutral-400">{a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}</span>
              </div>
              <p className="text-sm text-neutral-600 mb-3 line-clamp-2">{a.body}</p>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-neutral-500">by {(a.profiles as any)?.full_name ?? 'Admin'}</span>
                <Share2 className="w-3 h-3 text-neutral-400" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
