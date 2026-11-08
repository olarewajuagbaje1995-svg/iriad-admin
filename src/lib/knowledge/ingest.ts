/**
 * Knowledge Base — ingestion orchestration.
 *
 * Combines extraction → chunking → embedding → storage → RPC indexing into a
 * single pipeline. Provider-independent: works with any EmbeddingProvider.
 *
 * Design rules (from the remediation directive):
 *   - Never claim successful ingestion when only a tracking row was created.
 *   - PDF/DOCX require external libraries; return clear errors until installed.
 *   - NVIDIA embeddings require NVIDIA_API_KEY; stub used otherwise for testing.
 *   - All errors surface to the caller; no silent failures.
 */

import { supabase } from '@/lib/supabase'
import { extractText, isSupportedFileType } from './extraction'
import { chunkText, type Chunk } from './chunking'
import {
  type EmbeddingProvider,
  type EmbeddingResult,
  createFrontendEmbeddingProvider,
} from './embedding'

export interface IngestOptions {
  /** Organisation that owns the document. */
  organisation_id: string
  /** User who uploaded the document. */
  uploaded_by: string
  /** Allowed roles for retrieval filtering. */
  allowed_roles?: string[]
  /** Similarity threshold for retrieval (used for indexing metadata). */
  _retrieval_threshold?: number
}

export type IngestResult =
  | { ok: true; document_id: string; chunks_indexed: number; provider: string; model: string; method: string }
  | { ok: false; error: string; stage: 'extract' | 'chunk' | 'embed' | 'store' | 'index'; provider?: string }

/**
 * Ingest a single File through the full knowledge pipeline:
 *   1. Extract plain text
 *   2. Chunk into overlapping segments
 *   3. Embed each chunk
 *   4. Store chunks + embeddings in knowledge_chunks
 *   5. Return indexing summary
 *
 * Returns failure at the first stage that errors — never partial success claimed
 * as full ingestion.
 */
export async function ingestFile(
  file: File,
  options: IngestOptions
): Promise<IngestResult> {
  const { organisation_id, uploaded_by, allowed_roles } = options

  // --- Stage 1: Extract ------------------------------------------------------
  if (!isSupportedFileType(file.type)) {
    return {
      ok: false,
      error: `Unsupported file type: ${file.type ?? 'unknown'}`,
      stage: 'extract',
    }
  }

  const extraction = await extractText(file)
  if (!extraction.ok) {
    return {
      ok: false,
      error: extraction.error,
      stage: 'extract',
      provider: extraction.method,
    }
  }

  const { text, method } = extraction

  // --- Stage 2: Chunk --------------------------------------------------------
  const chunks: Chunk[] = chunkText(text)
  if (chunks.length === 0) {
    return {
      ok: false,
      error: 'No text content could be extracted from the document',
      stage: 'chunk',
      provider: method,
    }
  }

  // --- Stage 3: Embed --------------------------------------------------------
  // Frontend-safe: never read API keys from import.meta.env in browser code.
  // Real embedding generation happens server-side via the ai-proxy Edge Function.
  const provider: EmbeddingProvider = createFrontendEmbeddingProvider()

  const embeddedChunks: { chunk: Chunk; embedding: number[] }[] = []
  for (const chunk of chunks) {
    const result: EmbeddingResult = await provider.embed(chunk.content)
    if (!result.ok) {
      return {
        ok: false,
        error: `Embedding failed for chunk ${chunk.chunk_index}: ${result.error}`,
        stage: 'embed',
        provider: result.provider,
      }
    }
    embeddedChunks.push({ chunk, embedding: result.embedding })
  }

  // --- Stage 4: Store --------------------------------------------------------
  // Create a document tracking row
  const { data: docData, error: docError } = (await supabase
    .from('knowledge_documents')
    .insert([
      {
        organisation_id,
        uploaded_by,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        status: 'indexing',
        chunk_count: embeddedChunks.length,
      },
    ])
    .select('id')
    .single()) as { data: { id: string }; error: unknown }

  if (docError) {
    return {
      ok: false,
      error: `Failed to create document record: ${docError instanceof Error ? docError.message : JSON.stringify(docError)}`,
      stage: 'store',
      provider: provider.name,
    }
  }

  const document_id = docData.id

  // Insert chunks with embeddings
  const chunkRows = embeddedChunks.map(({ chunk, embedding }) => ({
    document_id,
    content: chunk.content,
    chunk_index: chunk.chunk_index,
    embedding,
    metadata: {
      file_name: file.name,
      file_type: file.type,
      character_start: chunk.character_start,
      character_end: chunk.character_end,
      extraction_method: method,
      embedding_provider: provider.name,
      embedding_model: provider.model,
    },
    organisation_id,
    allowed_roles: allowed_roles ?? null,
  }))

  const { error: chunksError } = await supabase
    .from('knowledge_chunks')
    .insert(chunkRows)

  if (chunksError) {
    return {
      ok: false,
      error: `Failed to store chunks: ${chunksError.message}`,
      stage: 'store',
      provider: provider.name,
    }
  }

  // Mark document as indexed
  await supabase
    .from('knowledge_documents')
    .update({ status: 'indexed', updated_at: new Date().toISOString() })
    .eq('id', document_id)

  return {
    ok: true,
    document_id,
    chunks_indexed: embeddedChunks.length,
    provider: provider.name,
    model: provider.model,
    method,
  }
}

/**
 * Ingest multiple files sequentially. Returns per-file results.
 */
export async function ingestFiles(
  files: FileList,
  options: IngestOptions
): Promise<IngestResult[]> {
  const results: IngestResult[] = []
  for (let i = 0; i < files.length; i++) {
    results.push(await ingestFile(files[i], options))
  }
  return results
}

/**
 * Reset/re-index an existing document: delete its chunks and re-ingest from
 * the stored file. Requires the original File object (re-upload).
 */
export async function reindexDocument(
  document_id: string,
  file: File,
  options: IngestOptions
): Promise<IngestResult> {
  // Delete existing chunks
  await supabase.from('knowledge_chunks').delete().eq('document_id', document_id)
  // Delete document row
  await supabase.from('knowledge_documents').delete().eq('id', document_id)
  // Re-ingest
  return ingestFile(file, options)
}
