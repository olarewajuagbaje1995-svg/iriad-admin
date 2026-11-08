/**
 * Knowledge Base pipeline barrel export.
 *
 * Modules:
 *   extraction.ts   — text extraction from uploaded files
 *   chunking.ts     — overlapping text chunking
 *   embedding.ts    — embedding providers (NVIDIA + stub)
 *   rpc.ts          — match_knowledge_chunks RPC client
 *   ingest.ts       — ingestion orchestration
 */

export { extractText, isSupportedFileType, type ExtractionResult } from './extraction'
export { chunkText, type Chunk, type ChunkingOptions } from './chunking'
export {
  type EmbeddingProvider,
  type EmbeddingResult,
  NvidiaEmbeddingProvider,
  StubEmbeddingProvider,
  createEmbeddingProvider,
  createFrontendEmbeddingProvider,
} from './embedding'
export {
  searchKnowledgeChunks,
  isRpcAvailable,
  type KnowledgeChunk,
  type RpcSearchOptions,
  type RpcSearchResult,
} from './rpc'
export {
  ingestFile,
  ingestFiles,
  reindexDocument,
  type IngestOptions,
  type IngestResult,
} from './ingest'
