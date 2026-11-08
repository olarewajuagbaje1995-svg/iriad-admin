/**
 * Knowledge Base — text extraction provider-independent module.
 *
 * Extracts plain text from uploaded documents so they can be chunked, embedded
 * and indexed via `match_knowledge_chunks`. Supported natively without external
 * dependencies: .txt, .md, .csv. PDF (.pdf) and DOCX (.docx) extraction require
 * external libraries (e.g. pdf-parse, mammoth) which are NOT installed — those
 * paths return a clear "not implemented" error until the library is added.
 *
 * Never claim successful ingestion when only a tracking row was created.
 */

export type ExtractionResult =
  | { ok: true; text: string; method: string }
  | { ok: false; error: string; method: string }

/**
 * MIME type → supported check.
 */
const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
])

export function isSupportedFileType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.has(mimeType)
}

/**
 * Extract plain text from a File. Returns the extracted text and the method used.
 * PDF and DOCX are deliberately stubbed — they require external parsing libraries.
 */
export async function extractText(file: File): Promise<ExtractionResult> {
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)

  // --- Plain text / Markdown ------------------------------------------------
  if (
    file.type === 'text/plain' ||
    file.type === 'text/markdown' ||
    file.name.toLowerCase().endsWith('.txt') ||
    file.name.toLowerCase().endsWith('.md')
  ) {
    const decoder = new TextDecoder()
    return { ok: true, text: decoder.decode(bytes), method: 'native-text' }
  }

  // --- CSV ------------------------------------------------------------------
  if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
    const decoder = new TextDecoder()
    const csvText = decoder.decode(bytes)
    // Convert CSV rows to readable lines, preserving header context
    const lines = csvText.split('\n').filter((l) => l.trim().length > 0)
    return {
      ok: true,
      text: lines.join('\n'),
      method: 'native-csv',
    }
  }

  // --- PDF ------------------------------------------------------------------
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return {
      ok: false,
      error:
        'PDF text extraction requires an external library (e.g. pdf-parse). ' +
        'Install the library and implement the PDF extraction path before ' +
        'ingesting PDF documents.',
      method: 'pdf-stub',
    }
  }

  // --- DOCX -----------------------------------------------------------------
  if (
    file.type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx')
  ) {
    return {
      ok: false,
      error:
        'DOCX text extraction requires an external library (e.g. mammoth). ' +
        'Install the library and implement the DOCX extraction path before ' +
        'ingesting DOCX documents.',
      method: 'docx-stub',
    }
  }

  return {
    ok: false,
    error: `Unsupported file type: ${file.type ?? 'unknown'}`,
    method: 'unsupported',
  }
}
