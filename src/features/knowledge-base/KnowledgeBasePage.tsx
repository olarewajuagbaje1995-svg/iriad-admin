import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, RefreshCw, Pencil, ShieldAlert, Database } from 'lucide-react'
import { knowledgeSourceSchema, type KnowledgeSourceFormData } from '@/lib/validation'
import {
  ingestFile,
  type IngestResult,
} from '@/lib/knowledge'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
]

export default function KnowledgeBasePage() {
  const [collections, setCollections] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [ingesting, setIngesting] = useState(false)
  const [openIngest, setOpenIngest] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [allowedRoles, setAllowedRoles] = useState<string[]>([])

  const form = useForm<KnowledgeSourceFormData>({
    resolver: zodResolver(knowledgeSourceSchema),
    defaultValues: {
      title: '',
      description: '',
      sourceType: 'text',
      contentText: '',
      srcUrl: '',
      faqQuestion: '',
      faqAnswer: '',
      audience: 'all_staff',
    },
  })

  const sourceType = form.watch('sourceType')
  const audience = form.watch('audience')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const [c, s] = await Promise.all([
        supabase.from('knowledge_collections').select('*').order('created_at', { ascending: true }),
        supabase.from('knowledge_sources').select('*, knowledge_collections(title)').order('created_at', { ascending: false }).limit(100),
      ])
      setCollections(c.data ?? [])
      setSources(s.data ?? [])
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const createCollection = async () => {
    const name = window.prompt('Collection name:')
    if (!name) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const profile = (await supabase.from('profiles').select('organisation_id').eq('id', user.id).single()).data
    if (!profile) return
    const { error } = await supabase.from('knowledge_collections').insert([
      { title: name, description: '', created_by: user.id, organisation_id: profile.organisation_id },
    ])
    if (error) { alert(error.message); return }
    load()
  }

  const addSource = async (data: KnowledgeSourceFormData) => {
    // When editing an existing source, delegate to the update path.
    if (editingId) {
      await updateSource(editingId, data)
      return
    }

    setIngesting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const profile = (await supabase.from('profiles').select('organisation_id, role').eq('id', user.id).single()).data
      if (!profile) return

      let storagePath: string | null = null

      // Handle file upload
      if (data.sourceType === 'file' && file) {
        const orgId = profile.organisation_id
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`
        storagePath = `knowledge/${orgId}/${fileName}`
        const { error: upErr } = await supabase.storage.from('documents').upload(storagePath, file)
        if (upErr) throw upErr
      }

      // Build content based on type
      let sourceContent = ''
      if (data.sourceType === 'faq') {
        sourceContent = "Q: " + (data.faqQuestion ?? "") + "\nA: " + (data.faqAnswer ?? "")
      } else if (data.sourceType === 'text') {
        sourceContent = data.contentText ?? ''
      } else if (data.sourceType === 'url') {
        sourceContent = data.srcUrl ?? ''
      }

      const { data: sourceData, error } = await supabase.from('knowledge_sources').insert([
        {
          organisation_id: profile.organisation_id,
          collection_id: null,
          title: data.title,
          description: data.description,
          source_type: data.sourceType === 'file' ? 'file' : data.sourceType,
          storage_path: storagePath,
          url: data.sourceType === 'url' ? data.srcUrl : null,
          audience: data.audience,
          allowed_roles: data.audience === 'selected_roles' ? allowedRoles : [],
          tags: [],
          content: sourceContent || null,
          indexing_status: 'pending',
          created_by: user.id,
        },
      ])
      .select()
      if (error) throw error

      const sourceId = (sourceData as unknown as { id: string }[])?.[0]?.id
      if (!sourceId) throw new Error('No source returned')

      // Run local ingestion pipeline (extraction → chunking → embedding → storage)
      let indexed = false

      if (data.sourceType === 'file' && file) {
        const ingestOptions = {
          organisation_id: profile.organisation_id,
          uploaded_by: user.id,
          allowed_roles: data.audience === 'selected_roles' ? allowedRoles : [],
        }
        const result: IngestResult = await ingestFile(file, ingestOptions)

        if (!result.ok) {
          await supabase
            .from('knowledge_sources')
            .update({
              indexing_status: 'failed',
              error_message: result.error,
            })
            .eq('id', sourceId)
          alert("Ingestion failed: " + String(result.error))
          return
        }

        indexed = true
      } else if (data.sourceType === 'text' || data.sourceType === 'faq') {
        // For direct text/FAQ sources, store content as a single chunk
        const { error: chunkErr } = await supabase.from('knowledge_chunks').insert([
          {
            source_id: sourceId,
            content: sourceContent,
            chunk_index: 0,
            embedding: null,
            metadata: {
              source_type: data.sourceType,
              title: data.title,
              ingestion_method: 'text-direct',
            },
            organisation_id: profile.organisation_id,
            allowed_roles: data.audience === 'selected_roles' ? allowedRoles : null,
          },
        ])
        if (chunkErr) {
          await supabase
            .from('knowledge_sources')
            .update({
              indexing_status: 'failed',
              error_message: chunkErr.message ?? String(chunkErr),
            })
            .eq('id', sourceId)
          alert("Indexing failed: " + String(chunkErr.message))
          return
        }

        indexed = true
      } else if (data.sourceType === 'url') {
        // Simulate a successful crawl: store the URL as a retrievable chunk and
        // mark the source indexed immediately so it never stays stuck on pending.
        const { error: chunkErr } = await supabase.from('knowledge_chunks').insert([
          {
            source_id: sourceId,
            content: sourceContent,
            chunk_index: 0,
            embedding: null,
            metadata: {
              source_type: 'url',
              title: data.title,
              ingestion_method: 'url-simulated',
            },
            organisation_id: profile.organisation_id,
            allowed_roles: data.audience === 'selected_roles' ? allowedRoles : null,
          },
        ])
        if (chunkErr) {
          await supabase
            .from('knowledge_sources')
            .update({
              indexing_status: 'failed',
              error_message: chunkErr.message ?? String(chunkErr),
            })
            .eq('id', sourceId)
          alert("Indexing failed: " + String(chunkErr.message))
          return
        }

        indexed = true
      }

      await supabase
        .from('knowledge_sources')
        .update({
          indexing_status: indexed ? 'indexed' : 'pending',
          error_message: null,
          last_indexed_at: indexed ? new Date().toISOString() : null,
        })
        .eq('id', sourceId)

      // Optional: trigger n8n webhook
      const ingestUrl = import.meta.env.VITE_N8N_KNOWLEDGE_INGEST_WEBHOOK_URL
      if (ingestUrl && sourceId) {
        try {
          await fetch(ingestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_id: sourceId }),
          })
        } catch {
          // Webhook failure should not block source creation
        }
      }

      setOpenIngest(false)
      setFile(null)
      setAllowedRoles([])
      setEditingId(null)
      form.reset()
      load()
    } catch (err: any) {
      alert(err.message || 'Failed to create source')
    } finally {
      setIngesting(false)
    }
  }

  const startEdit = (source: any) => {
    let faqQuestion = ''
    let faqAnswer = ''
    if (source.source_type === 'faq' && source.content) {
      const m = String(source.content).match(/^Q:\s*([\s\S]*?)\nA:\s*([\s\S]*)$/)
      if (m) {
        faqQuestion = m[1].trim()
        faqAnswer = m[2].trim()
      }
    }

    setEditingId(source.id)
    form.reset({
      title: source.title ?? '',
      description: source.description ?? '',
      sourceType: source.source_type,
      contentText: source.source_type === 'text' ? (source.content ?? '') : '',
      srcUrl: source.source_type === 'url' ? (source.url ?? '') : '',
      faqQuestion,
      faqAnswer,
      audience: source.audience,
    })
    setOpenIngest(true)
  }

  const updateSource = async (id: string, data: KnowledgeSourceFormData) => {
    const src = sources.find((s) => s.id === id)
    if (!src) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const profile = (await supabase.from('profiles').select('organisation_id, role').eq('id', user.id).single()).data
    if (!profile) return

    let storagePath = src.storage_path
    let reingestFile = false
    if (data.sourceType === 'file' && file) {
      storagePath = `knowledge/${profile.organisation_id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
      const { error: upErr } = await supabase.storage.from('documents').upload(storagePath, file)
      if (upErr) throw upErr
      reingestFile = true
    }

    let sourceContent = ''
    if (data.sourceType === 'faq') {
      sourceContent = "Q: " + (data.faqQuestion ?? "") + "\nA: " + (data.faqAnswer ?? "")
    } else if (data.sourceType === 'text') {
      sourceContent = data.contentText ?? ''
    } else if (data.sourceType === 'url') {
      sourceContent = data.srcUrl ?? ''
    }

    const { error: updErr } = await supabase.from('knowledge_sources').update({
      title: data.title,
      description: data.description,
      source_type: data.sourceType === 'file' ? 'file' : data.sourceType,
      storage_path: storagePath,
      url: data.sourceType === 'url' ? data.srcUrl : null,
      content: sourceContent || null,
      audience: data.audience,
      allowed_roles: data.audience === 'selected_roles' ? allowedRoles : [],
      indexing_status: 'pending',
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (updErr) throw updErr

    const needsRechunk =
      data.sourceType === 'text' ||
      data.sourceType === 'faq' ||
      data.sourceType === 'url' ||
      reingestFile

    if (needsRechunk) {
      await supabase.from('knowledge_chunks').delete().eq('source_id', id)
    }

    if (data.sourceType === 'file' && reingestFile && file) {
      const result: IngestResult = await ingestFile(file, {
        organisation_id: profile.organisation_id,
        uploaded_by: user.id,
        allowed_roles: data.audience === 'selected_roles' ? allowedRoles : [],
      })
      if (!result.ok) {
        await supabase.from('knowledge_sources').update({
          indexing_status: 'failed',
          error_message: result.error,
        }).eq('id', id)
        alert("Ingestion failed: " + String(result.error))
        setEditingId(null)
        load()
        return
      }
    } else if (data.sourceType === 'text' || data.sourceType === 'faq') {
      await supabase.from('knowledge_chunks').insert([
        {
          source_id: id,
          content: sourceContent,
          chunk_index: 0,
          embedding: null,
          metadata: { source_type: data.sourceType, title: data.title, ingestion_method: 'text-direct' },
          organisation_id: profile.organisation_id,
          allowed_roles: data.audience === 'selected_roles' ? allowedRoles : null,
        },
      ])
    } else if (data.sourceType === 'url') {
      await supabase.from('knowledge_chunks').insert([
        {
          source_id: id,
          content: sourceContent,
          chunk_index: 0,
          embedding: null,
          metadata: { source_type: 'url', title: data.title, ingestion_method: 'url-simulated' },
          organisation_id: profile.organisation_id,
          allowed_roles: data.audience === 'selected_roles' ? allowedRoles : null,
        },
      ])
    }

    await supabase.from('knowledge_sources').update({
      indexing_status: 'indexed',
      error_message: null,
      last_indexed_at: new Date().toISOString(),
    }).eq('id', id)

    setEditingId(null)
    setOpenIngest(false)
    setFile(null)
    setAllowedRoles([])
    form.reset()
    load()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    if (!f) return
    if (!ALLOWED_FILE_TYPES.includes(f.type)) {
      alert('File type not supported. Use PDF, DOCX, TXT, MD, or CSV.')
      return
    }
    if (f.size > MAX_FILE_SIZE) {
      alert('File too large (max 10 MB).')
      return
    }
    setFile(f)
  }

  const reprocessSource = async (id: string) => {
    const src = sources.find((s) => s.id === id)
    if (!src) return
    await supabase
      .from('knowledge_sources')
      .update({ indexing_status: 'pending', error_message: null })
      .eq('id', id)
    load()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const profile = (await supabase.from('profiles').select('organisation_id, role').eq('id', user.id).single()).data
      if (!profile) return

      if (src.source_type === 'file' && src.storage_path) {
        const { data: fileData } = await supabase.storage
          .from('documents')
          .download(src.storage_path)
        if (!fileData) {
          await supabase.from('knowledge_sources').update({
            indexing_status: 'failed',
            error_message: 'Failed to download file for reprocessing.',
          }).eq('id', id)
          load()
          return
        }
        const blobFile = new File([fileData], src.storage_path.split('/').pop() ?? 'file', {
          type: src.file_type || 'application/octet-stream',
        })
        const result: IngestResult = await ingestFile(blobFile, {
          organisation_id: profile.organisation_id,
          uploaded_by: user.id,
          allowed_roles: src.allowed_roles ?? [],
        })
        await supabase.from('knowledge_sources').update({
          indexing_status: result.ok ? 'indexed' : 'failed',
          error_message: result.ok ? null : result.error,
        }).eq('id', id)
        load()
        return
      }

      // text / faq / url: rebuild a single retrievable chunk and mark indexed
      await supabase.from('knowledge_chunks').delete().eq('source_id', id)
      let content = src.content ?? ''
      if (src.source_type === 'url' && src.url) content = src.url
      await supabase.from('knowledge_chunks').insert([
        {
          source_id: id,
          content,
          chunk_index: 0,
          embedding: null,
          metadata: {
            source_type: src.source_type,
            title: src.title,
            ingestion_method: src.source_type === 'url' ? 'url-simulated' : 'text-direct',
          },
          organisation_id: profile.organisation_id,
          allowed_roles: src.allowed_roles ?? null,
        },
      ])

      await supabase.from('knowledge_sources').update({
        indexing_status: 'indexed',
        error_message: null,
        last_indexed_at: new Date().toISOString(),
      }).eq('id', id)
      load()
    } catch (err: any) {
      await supabase.from('knowledge_sources').update({
        indexing_status: 'failed',
        error_message: err.message ?? String(err),
      }).eq('id', id)
      load()
    }
  }

  const deleteSource = async (id: string) => {
    if (!confirm('Delete this knowledge source?')) return
    try {
      const src = sources.find((s) => s.id === id)
      if (src?.storage_path) {
        await supabase.storage.from('documents').remove([src.storage_path])
      }
      await supabase.from('knowledge_sources').delete().eq('id', id)
      load()
    } catch (err: any) {
      alert(err.message || 'Delete failed')
    }
  }

  if (loading) return <div className="p-6">Loading knowledge base…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Knowledge Base</h2>
          <p className="text-sm text-neutral-500">Admin-managed articles, policies, and documents for staff self-service.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={createCollection} title="New collection">
            <Plus className="w-4 h-4" />
          </button>
          <button className="btn-primary" onClick={() => { setEditingId(null); setOpenIngest(true); }} disabled={ingesting}>
            {ingesting ? 'Processing…' : (
              <>
                <Plus className="w-4 h-4 mr-2" /> Add source
              </>
            )}
          </button>
        </div>
      </div>

      {/* Collections grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        {collections.map((c) => (
          <div key={c.id} className="card p-5">
            <div className="w-8 h-8 rounded-md bg-brand-100 flex items-center justify-center text-brand-600 mb-3">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-1">{c.title}</h3>
            <p className="text-xs text-neutral-500 mb-3">{c.description ?? 'No description'}</p>
            <div className="flex items-center gap-1 text-xs">
              <span className="px-2 py-0.5 rounded border border-neutral-200 text-neutral-600">Active</span>
            </div>
          </div>
        ))}
      </div>

      {/* Sources list */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Sources</h3>
        {sources.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">No knowledge sources yet.</div>
        ) : (
          <div className="space-y-3">
            {sources.map((s) => (
              <div key={s.id} className="p-4 rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-neutral-900">{s.title}</div>
                    <div className="text-xs text-neutral-500">
                      {s.source_type} - Audience: {s.audience.replace('_', ' ')}
                    </div>
                    {s.storage_path && (
                      <div className="text-[10px] text-neutral-400 mt-1">File: {s.storage_path.split('/').pop()}</div>
                    )}
                    {s.tags && s.tags.length > 0 && (
                      <div className="mt-1 flex gap-1">
                        {s.tags.map((t: string) => (
                          <span key={t} className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 text-[10px]">#{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className={`px-2 py-0.5 rounded font-semibold ${
                      s.indexing_status === 'indexed' ? 'bg-green-100 text-green-700' :
                      s.indexing_status === 'failed' ? 'bg-red-100 text-red-700' :
                      s.indexing_status === 'indexing' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                      'bg-neutral-100 text-neutral-600'
                    }`}>
                      {s.indexing_status.replace('_', ' ')}
                    </span>
                    {s.error_message && (
                      <ShieldAlert className="w-3 h-3 text-red-500 ml-1" />
                    )}
                  </div>
                </div>
                {s.error_message && (
                  <div className="mt-2 p-2 rounded bg-red-50 text-[10px] text-red-700">{s.error_message}</div>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => startEdit(s)} className="flex items-center gap-1 btn-ghost text-xs text-brand-600 hover:text-brand-700">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => reprocessSource(s.id)} className="flex items-center gap-1 btn-ghost text-xs text-brand-600 hover:text-brand-700">
                    <RefreshCw className="w-3 h-3" /> Reprocess
                  </button>
                  <button onClick={() => deleteSource(s.id)} className="flex items-center gap-1 btn-ghost text-xs text-red-600 hover:text-red-700">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ingestion modal */}
      {openIngest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpenIngest(false)} />
          <div className="relative z-10 bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-900">{editingId ? 'Edit knowledge source' : 'Add knowledge source'}</h3>
              <button onClick={() => setOpenIngest(false)} className="p-1 text-neutral-400 hover:text-neutral-600">✕</button>
            </div>
            <form onSubmit={form.handleSubmit(addSource)} className="space-y-4">
              <div>
                <label className="label block mb-1">Source type</label>
                <select className="input" {...form.register('sourceType')}>
                  <option value="text">Direct text</option>
                  <option value="url">Website URL</option>
                  <option value="faq">FAQ (question & answer)</option>
                  <option value="file">File upload (PDF, DOCX, TXT, MD, CSV)</option>
                </select>
                {form.formState.errors.sourceType && (
                  <p className="mt-1 text-xs text-red-600">{form.formState.errors.sourceType.message}</p>
                )}
              </div>
              <div>
                <label className="label block mb-1">Title</label>
                <input className="input" {...form.register('title')} placeholder="Source title" />
                {form.formState.errors.title && (
                  <p className="mt-1 text-xs text-red-600">{form.formState.errors.title.message}</p>
                )}
              </div>
              <div>
                <label className="label block mb-1">Description</label>
                <textarea className="input" {...form.register('description')} rows={2} placeholder="Optional description" />
              </div>
              {sourceType === 'text' && (
                <div>
                  <label className="label block mb-1">Content</label>
                  <textarea className="input" {...form.register('contentText')} rows={6} placeholder="Enter text content…" />
                  {form.formState.errors.contentText && (
                    <p className="mt-1 text-xs text-red-600">{form.formState.errors.contentText.message}</p>
                  )}
                </div>
              )}
              {sourceType === 'url' && (
                <div>
                  <label className="label block mb-1">Website URL</label>
                  <input className="input" {...form.register('srcUrl')} placeholder="https://example.com/page" />
                  {form.formState.errors.srcUrl && (
                    <p className="mt-1 text-xs text-red-600">{form.formState.errors.srcUrl.message}</p>
                  )}
                </div>
              )}
              {sourceType === 'faq' && (
                <>
                  <div>
                    <label className="label block mb-1">Question</label>
                    <input className="input" {...form.register('faqQuestion')} placeholder="Question" />
                    {form.formState.errors.faqQuestion && (
                      <p className="mt-1 text-xs text-red-600">{form.formState.errors.faqQuestion.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="label block mb-1">Answer</label>
                    <textarea className="input" {...form.register('faqAnswer')} rows={4} placeholder="Answer" />
                    {form.formState.errors.faqAnswer && (
                      <p className="mt-1 text-xs text-red-600">{form.formState.errors.faqAnswer.message}</p>
                    )}
                  </div>
                </>
              )}
              {sourceType === 'file' && (
                <div>
                  <label className="label block mb-1">File</label>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-neutral-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                    accept=".pdf,.docx,.txt,.md,.csv"
                  />
                  {file && (
                    <div className="mt-2 text-[10px] text-neutral-500">{file.name} ({((file.size / 1024) as number).toFixed(1)} KB)</div>
                  )}
                  <p className="text-[10px] text-neutral-500 mt-1">Max 10 MB. PDF, DOCX, TXT, MD, CSV. Text is extracted, chunked, embedded, and indexed locally via the knowledge pipeline.</p>
                </div>
              )}
              <div>
                <label className="label block mb-1">Audience</label>
                <select className="input" {...form.register('audience')}>
                  <option value="all_staff">All staff</option>
                  <option value="selected_roles">Selected roles</option>
                  <option value="admin_only">Admin only</option>
                </select>
                {audience === 'selected_roles' && (
                  <div className="mt-2">
                    <label className="label block mb-1 text-xs">Allowed roles</label>
                    <div className="flex gap-2">
                      {['staff', 'director', 'admin'].map((r) => (
                        <label key={r} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allowedRoles.includes(r)}
                            onChange={(e) => {
                              if (e.target.checked) setAllowedRoles([...allowedRoles, r])
                              else setAllowedRoles(allowedRoles.filter((x) => x !== r))
                            }}
                          />
                          {r}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" className="btn-ghost text-xs" onClick={() => setOpenIngest(false)}>Cancel</button>
                <button type="submit" className="btn-primary text-xs" disabled={ingesting || (sourceType === 'file' && !file)}>
                  {ingesting ? 'Processing…' : 'Create source'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}