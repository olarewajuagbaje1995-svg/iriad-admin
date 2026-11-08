/**
 * Knowledge Base — match_knowledge_chunks RPC client.
 *
 * Calls the Supabase RPC `match_knowledge_chunks` defined in migration 010.
 * Signature:
 *   match_knowledge_chunks(
 *     query_embedding vector(1536),
 *     match_threshold float default 0.5,
 *     match_count int default 10,
 *     p_organisation_id uuid default null,
 *     p_allowed_roles text[] default null
 *   )
 * Returns similarity-scored chunks with content, metadata, and similarity.
 *
 * Provider-independent: works with any embedding provider as long as the
 * embedding dimension matches (1536).
 */

import { supabase } from '@/lib/supabase'

export interface KnowledgeChunk {
  id: string
  document_id: string
  content: string
  chunk_index: number
  similarity: number
  metadata?: Record<string, unknown>
  created_at?: string
}

export interface RpcSearchOptions {
  /** Minimum similarity score (0-1). Default 0.5. */
  threshold?: number
  /** Maximum number of chunks to return. Default 10. */
  count?: number
  /** Optional organisation filter. */
  organisation_id?: string | null
  /** Optional allowed roles filter. */
  allowed_roles?: string[] | null
}

export type RpcSearchResult =
  | { ok: true; chunks: KnowledgeChunk[] }
  | { ok: false; error: string }

/**
 * Safely convert an unknown value to a string without triggering
 * @typescript-eslint/no-base-to-string on object types.
 */
function toStringSafe(val: unknown): string {
  if (val == null) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  return JSON.stringify(val)
}

/**
 * Search knowledge chunks by semantic similarity using match_knowledge_chunks RPC.
 */
export async function searchKnowledgeChunks(
  queryEmbedding: number[],
  options: RpcSearchOptions = {}
): Promise<RpcSearchResult> {
  const threshold = options.threshold ?? 0.5
  const count = options.count ?? 10

  try {
    const rpcResult = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: count,
      p_organisation_id: options.organisation_id ?? null,
      p_allowed_roles: options.allowed_roles ?? null,
    })

    const error = rpcResult.error
    if (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, error: message }
    }

    const rows: unknown[] = Array.isArray(rpcResult.data) ? rpcResult.data : []
    const chunks: KnowledgeChunk[] = rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: toStringSafe(r.id ?? ''),
        document_id: toStringSafe(r.document_id ?? ''),
        content: toStringSafe(r.content ?? ''),
        chunk_index: typeof r.chunk_index === 'number' ? r.chunk_index : Number(toStringSafe(r.chunk_index ?? 0)),
        similarity: typeof r.similarity === 'number' ? r.similarity : Number(toStringSafe(r.similarity ?? 0)),
        metadata: (r.metadata as Record<string, unknown> | undefined) ?? undefined,
        created_at: r.created_at ? toStringSafe(r.created_at) : undefined,
      }
    })

    return { ok: true, chunks }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

/**
 * Check whether the match_knowledge_chunks RPC is available by attempting a
 * zero-vector search with count 1. Returns true if the RPC exists and is
 * executable; false otherwise.
 */
export async function isRpcAvailable(): Promise<boolean> {
  const zeroVector: number[] = []
  for (let i = 0; i < 1536; i++) zeroVector.push(0)
  const result = await searchKnowledgeChunks(zeroVector, { count: 1 })
  return result.ok
}
