import { describe, expect, it, vi } from 'vitest'

/* ------------------------------------------------------------------ */
/* RAG role-based access filtering. Supabase is mocked; no live DB.   */
/* Tables: knowledge_sources (audience, allowed_roles),               */
/*         knowledge_chunks (visibility, allowed_roles).              */
/* ------------------------------------------------------------------ */

type KnowledgeSource = {
  id: string
  audience: 'all_staff' | 'selected_roles' | 'admin_only'
  allowed_roles: string[]
  is_enabled: boolean
}

type KnowledgeChunk = {
  id: string
  source_id: string
  visibility: 'public' | 'restricted' | 'admin_only'
  allowed_roles: string[]
}

/** Is a role an admin-type role? */
function isAdminRole(role: string | null): boolean {
  return role === 'admin' || role === 'director'
}

/** Filter sources by audience for a given profile role. */
function filterSourcesByAudience(sources: KnowledgeSource[], role: string | null): KnowledgeSource[] {
  return sources.filter((s) => {
    if (!s.is_enabled) return false
    if (s.audience === 'all_staff') return true
    if (s.audience === 'admin_only') return isAdminRole(role)
    if (s.audience === 'selected_roles') {
      return s.allowed_roles.includes(role ?? 'staff')
    }
    return false
  })
}

/** Filter chunks by visibility for a given profile role. */
function filterChunksByVisibility(chunks: KnowledgeChunk[], role: string | null): KnowledgeChunk[] {
  return chunks.filter((c) => {
    if (c.visibility === 'public') return true
    if (c.visibility === 'admin_only') return isAdminRole(role)
    if (c.visibility === 'restricted') return c.allowed_roles.includes(role ?? 'staff')
    return false
  })
}

describe('rag-access — audience filtering', () => {
  const sources: KnowledgeSource[] = [
    { id: 's1', audience: 'all_staff', allowed_roles: [], is_enabled: true },
    { id: 's2', audience: 'selected_roles', allowed_roles: ['director', 'admin'], is_enabled: true },
    { id: 's3', audience: 'admin_only', allowed_roles: [], is_enabled: true },
    { id: 's4', audience: 'selected_roles', allowed_roles: ['staff'], is_enabled: false },
  ]

  it('all_staff is visible to every role', () => {
    expect(filterSourcesByAudience(sources, 'staff').map((s) => s.id)).toContain('s1')
    expect(filterSourcesByAudience(sources, 'admin').map((s) => s.id)).toContain('s1')
  })

  it('selected_roles restricts to allowed roles', () => {
    expect(filterSourcesByAudience(sources, 'director').map((s) => s.id)).toContain('s2')
    expect(filterSourcesByAudience(sources, 'admin').map((s) => s.id)).toContain('s2')
    expect(filterSourcesByAudience(sources, 'staff').map((s) => s.id)).not.toContain('s2')
  })

  it('admin_only restricts to admin roles', () => {
    const admins = filterSourcesByAudience(sources, 'admin').map((s) => s.id)
    expect(admins).toContain('s3')
    expect(filterSourcesByAudience(sources, 'director').map((s) => s.id)).toContain('s3')
    expect(filterSourcesByAudience(sources, 'staff').map((s) => s.id)).not.toContain('s3')
  })

  it('excludes disabled sources', () => {
    expect(filterSourcesByAudience(sources, 'staff').map((s) => s.id)).not.toContain('s4')
  })
})

describe('rag-access — knowledge_chunks visibility', () => {
  const chunks: KnowledgeChunk[] = [
    { id: 'c1', source_id: 's1', visibility: 'public', allowed_roles: [] },
    { id: 'c2', source_id: 's1', visibility: 'restricted', allowed_roles: ['director', 'admin'] },
    { id: 'c3', source_id: 's1', visibility: 'admin_only', allowed_roles: [] },
  ]

  it('public chunks visible to everyone', () => {
    expect(filterChunksByVisibility(chunks, 'staff').map((c) => c.id)).toContain('c1')
    expect(filterChunksByVisibility(chunks, null).map((c) => c.id)).toContain('c1')
  })

  it('restricted chunks only to allowed roles', () => {
    expect(filterChunksByVisibility(chunks, 'director').map((c) => c.id)).toContain('c2')
    expect(filterChunksByVisibility(chunks, 'admin').map((c) => c.id)).toContain('c2')
    expect(filterChunksByVisibility(chunks, 'staff').map((c) => c.id)).not.toContain('c2')
  })

  it('admin_only chunks only to admin roles', () => {
    expect(filterChunksByVisibility(chunks, 'admin').map((c) => c.id)).toContain('c3')
    expect(filterChunksByVisibility(chunks, 'staff').map((c) => c.id)).not.toContain('c3')
    expect(filterChunksByVisibility(chunks, null).map((c) => c.id)).not.toContain('c3')
  })
})

/* ------------------------------------------------------------------ */
/* Supabase-mocked integration tests (fetch + filter).                 */
/* ------------------------------------------------------------------ */

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'

const mockedSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> }

function stubKnowledge(sources: KnowledgeSource[], chunks: KnowledgeChunk[]) {
  ;(mockedSupabase.from as any).mockImplementation((table: string) => {
    const select = vi.fn().mockReturnThis()
    const eq = vi.fn().mockReturnThis()

    if (table === 'knowledge_sources') {
      select.mockResolvedValue({ data: sources, error: null })
    } else if (table === 'knowledge_chunks') {
      eq.mockImplementation((_col: string, val: any) => Promise.resolve({ data: chunks.filter((c) => c.source_id === val), error: null }))
    }

    return { select, eq }
  })
}

describe('rag-access — supabase-mocked fetch', () => {
  it('returns filtered sources for a staff role', async () => {
    const sources: KnowledgeSource[] = [
      { id: 's1', audience: 'all_staff', allowed_roles: [], is_enabled: true },
      { id: 's2', audience: 'admin_only', allowed_roles: [], is_enabled: true },
    ]
    stubKnowledge(sources, [])

    const { data } = await mockedSupabase.from('knowledge_sources').select('*')
    const visible = filterSourcesByAudience(data, 'staff')
    expect(visible.map((s) => s.id)).toEqual(['s1'])
  })

  it('returns filtered chunks for a restricted source', async () => {
    const chunks: KnowledgeChunk[] = [
      { id: 'c1', source_id: 's1', visibility: 'public', allowed_roles: [] },
      { id: 'c2', source_id: 's1', visibility: 'restricted', allowed_roles: ['admin'] },
    ]
    stubKnowledge([], chunks)

    const { data } = await mockedSupabase.from('knowledge_chunks').select('*').eq('source_id', 's1')
    const visible = filterChunksByVisibility(data, 'staff')
    expect(visible.map((c) => c.id)).toEqual(['c1'])
  })
})
