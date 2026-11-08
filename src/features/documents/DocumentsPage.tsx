import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Download, FileText, Trash2 } from 'lucide-react'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [linkedToType, setLinkedToType] = useState('')
  const [linkedToId, setLinkedToId] = useState('')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const { data } = await supabase
        .from('documents')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(100)
      setDocuments(data ?? [])
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    const fileInput = document.getElementById('document-file') as HTMLInputElement | null
    const file = fileInput?.files?.[0]
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('File type not supported.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      alert('File too large (max 10 MB).')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      setUploading(true)
      setUploadProgress(0)

      const orgId = (await supabase.from('profiles').select('organisation_id').eq('id', user.id).single()).data?.organisation_id
      if (!orgId) throw new Error('No organisation found')

      const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`
      const storagePath = `${orgId}/${fileName}`

      // Upload to private Storage bucket
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Create document record
      const { error: insertError } = await supabase.from('documents').insert([
        {
          organisation_id: orgId,
          title: title || file.name,
          category: category || null,
          description: description || null,
          storage_path: storagePath,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          owner_id: user.id,
          linked_to_type: linkedToType || null,
          linked_to_id: linkedToId || null,
        },
      ])

      if (insertError) throw insertError

      setUploadProgress(100)
      setTitle('')
      setCategory('')
      setDescription('')
      setLinkedToType('')
      setLinkedToId('')
      if (fileInput) fileInput.value = ''
      load()
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Upload failed.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const downloadDocument = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.storage_path, 300) // 5-minute signed URL
      if (error) throw error
      if (!data?.signedUrl) throw new Error('No signed URL returned')
      window.open(data.signedUrl, '_blank')
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Download failed.')
    }
  }

  const deleteDocument = async (id: string, path: string) => {
    if (!confirm('Delete this document?')) return
    try {
      await supabase.storage.from('documents').remove([path])
      await supabase.from('documents').delete().eq('id', id)
      load()
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Delete failed.')
    }
  }

  if (loading) return <div className="p-6">Loading documents…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Documents</h2>
          <p className="text-sm text-neutral-500">Private file storage with signed, authorised downloads and version history.</p>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Upload document</h3>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className="label">File</label>
              <input
                id="document-file"
                type="file"
                className="block w-full text-sm text-neutral-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
              />
            </div>
            <div className="col-span-1 sm:col-span-1">
              <label className="label">Category</label>
              <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Policy, Report" />
            </div>
          </div>
          <div className="col-span-1 sm:col-span-2">
            <label className="label">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <label className="label">Description</label>
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional description" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-1">
              <label className="label">Link to type</label>
              <select className="input" value={linkedToType} onChange={(e) => setLinkedToType(e.target.value)}>
                <option value="">None</option>
                <option value="project">Project</option>
                <option value="task">Task</option>
                <option value="report">Report</option>
                <option value="announcement">Announcement</option>
              </select>
            </div>
            <div className="col-span-1 sm:col-span-1">
              <label className="label">Link ID</label>
              <input className="input" value={linkedToId} onChange={(e) => setLinkedToId(e.target.value)} placeholder="Record ID" />
            </div>
          </div>
          <button
            type="submit"
            className="btn-primary px-6 disabled:opacity-50"
            disabled={uploading}
          >
            {uploading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Uploading… {uploadProgress}%
              </div>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" /> Upload document
              </>
            )}
          </button>
          <p className="text-xs text-neutral-500">Max 10 MB. Supported: PDF, DOCX, TXT, MD, PNG, JPG, GIF, WEBP, CSV, XLSX.</p>
        </form>
      </div>

      <div className="space-y-3">
        {documents.length === 0 ? (
          <div className="text-center py-10 text-neutral-500">
            <FileText className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
            <p>No documents yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-neutral-200 text-neutral-500 text-xs uppercase">
                  <th className="pb-3">Title</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Size</th>
                  <th className="pb-3">Uploaded by</th>
                  <th className="pb-3">Uploaded</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-3 text-neutral-900">{d.title ?? d.file_name}</td>
                    <td className="py-3 text-neutral-600 text-sm capitalize">{d.category ?? '—'}</td>
                    <td className="py-3 text-neutral-600 text-sm">{d.file_type}</td>
                    <td className="py-3 text-neutral-600 text-sm">{((d.file_size ?? 0) / 1024).toFixed(1)} KB</td>
                    <td className="py-3 text-neutral-600 text-sm">{ (d.profiles as any)?.full_name ?? '—' }</td>
                    <td className="py-3 text-neutral-600 text-sm">{new Date(d.created_at).toLocaleDateString()}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => downloadDocument(d)}
                        className="flex items-center gap-1 btn-ghost text-xs text-brand-600 hover:text-brand-700"
                        title="Download (signed URL)"
                      >
                        <Download className="w-3 h-3" /> Download
                      </button>
                      <button
                        onClick={() => deleteDocument(d.id, d.storage_path)}
                        className="ml-2 flex items-center gap-1 btn-ghost text-xs text-red-600 hover:text-red-700"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
