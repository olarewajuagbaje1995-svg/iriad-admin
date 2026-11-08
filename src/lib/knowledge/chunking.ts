/**
 * Knowledge Base — text chunking.
 *
 * Splits extracted text into overlapping chunks suitable for vector embedding
 * and storage in `knowledge_chunks`. Chunks preserve sentence boundaries where
 * possible and carry `chunk_index` for ordering.
 */

export interface Chunk {
  chunk_index: number
  content: string
  character_start: number
  character_end: number
}

export interface ChunkingOptions {
  /** Target maximum characters per chunk. Default 1000. */
  maxChars?: number
  /** Overlap characters between adjacent chunks. Default 200. */
  overlap?: number
}

/**
 * Split text into overlapping chunks. Attempts to split at sentence boundaries
 * (`.`, `!`, `?` followed by whitespace or end) to avoid cutting mid-sentence.
 */
export function chunkText(
  text: string,
  options: ChunkingOptions = {}
): Chunk[] {
  const maxChars = options.maxChars ?? 1000
  const overlap = options.overlap ?? 200

  if (maxChars <= 0) throw new Error('maxChars must be positive')
  if (overlap >= maxChars) throw new Error('overlap must be less than maxChars')
  if (!text || text.trim().length === 0) return []

  const chunks: Chunk[] = []
  let start = 0
  let index = 0

  while (start < text.length) {
    // Determine the end of this chunk
    let end = Math.min(start + maxChars, text.length)

    // If we're not at the end of the text, try to back up to a sentence boundary
    if (end < text.length) {
      const sentenceEnd = findLastSentenceEnd(text, start, end)
      if (sentenceEnd > start && sentenceEnd < end) {
        end = sentenceEnd + 1 // include the sentence-ending punctuation
      }
    }

    const content = text.slice(start, end).trim()
    if (content.length > 0) {
      chunks.push({
        chunk_index: index,
        content,
        character_start: start,
        character_end: end,
      })
      index++
    }

    // Move start forward, accounting for overlap
    start = end
    if (start < text.length && overlap > 0) {
      start = Math.max(start - overlap, start)
      // Ensure we make progress
      if (start <= chunks[chunks.length - 1]?.character_start) {
        start = end
      }
    }
  }

  return chunks
}

/**
 * Find the last sentence-ending punctuation within [start, end).
 * Sentence enders: . ! ? followed by whitespace or end of string.
 */
function findLastSentenceEnd(text: string, start: number, end: number): number {
  for (let i = end - 1; i >= start; i--) {
    const ch = text[i]
    if (ch === '.' || ch === '!' || ch === '?') {
      // Check next char is whitespace or end-of-string
      const next = i + 1
      if (next >= text.length || /\s/.test(text[next])) {
        return i
      }
    }
  }
  return start
}
