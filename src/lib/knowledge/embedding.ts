/**
 * Knowledge Base — embedding provider interface.
 *
 * Defines the contract for generating vector embeddings from text chunks.
 * The NVIDIA provider requires server-side configuration (NVIDIA_API_KEY).
 * In frontend/browser contexts, only the stub provider is used — API keys
 * must never be exposed in frontend code or read from import.meta.env.
 * Real embedding generation happens server-side via the ai-proxy Edge Function.
 */

export type EmbeddingResult =
  | { ok: true; embedding: number[]; provider: string; model: string }
  | { ok: false; error: string; provider: string }

export interface EmbeddingProvider {
  name: string
  model: string
  dimensions: number
  embed(text: string): Promise<EmbeddingResult>
}

/**
 * NVIDIA NIM embedding provider.
 *
 * Calls the NVIDIA embedding API. Requires `NVIDIA_API_KEY` to be configured
 * server-side. Safe to import in frontend code because it gracefully
 * degrades when no key is available — but the key itself must never be
 * passed from frontend code. Use the ai-proxy Edge Function for real
 * embedding generation.
 */
export class NvidiaEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'nvidia'
  readonly model = 'nvidia/embed-qa-4'
  readonly dimensions = 1536

  private apiKey: string | null
  private baseUrl: string

  constructor(apiKey: string | null, baseUrl = 'https://integrate.api.nvidia.com/v1') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  async embed(text: string): Promise<EmbeddingResult> {
    if (!this.apiKey) {
      return {
        ok: false,
        error:
          'NVIDIA_API_KEY is not configured server-side. Embedding generation ' +
          'is blocked until the key is set via Edge Function environment ' +
          'variables. Knowledge ingestion cannot proceed without embeddings.',
        provider: 'nvidia',
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: text,
          model: this.model,
          input_type: 'query',
          encoding_format: 'float',
        }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        return {
          ok: false,
          error: `NVIDIA embedding API returned ${response.status}: ${errorText}`,
          provider: 'nvidia',
        }
      }

      const json = await response.json() as { data?: Array<{ embedding?: number[] }> }
      const embedding = json.data?.[0]?.embedding
      if (!embedding || embedding.length !== this.dimensions) {
        return {
          ok: false,
          error: `NVIDIA returned invalid embedding (expected ${this.dimensions} dimensions)`,
          provider: 'nvidia',
        }
      }

      return { ok: true, embedding, provider: 'nvidia', model: this.model }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        ok: false,
        error: message,
        provider: 'nvidia',
      }
    }
  }
}

/**
 * Fallback provider for testing/development when no real embedding provider is
 * configured. Returns deterministic pseudo-embeddings so the ingestion pipeline
 * can be exercised end-to-end without an API key. NOT for production use.
 */
export class StubEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'stub'
  readonly model = 'stub-deterministic'
  readonly dimensions = 1536

  async embed(text: string): Promise<EmbeddingResult> {
    // Deterministic pseudo-embedding based on text hash — for pipeline testing only
    const embedding: number[] = []
    for (let i = 0; i < this.dimensions; i++) {
      let hash = 0
      for (let j = 0; j < text.length; j++) {
        hash = (hash * 31 + text.charCodeAt(j)) % 1000003
      }
      embedding.push(((hash + i) % 1000) / 1000 - 0.5)
    }
    // Normalise to unit length
    const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0))
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= norm
    }
    await Promise.resolve()
    return { ok: true, embedding, provider: 'stub', model: this.model }
  }
}

/**
 * Create the appropriate embedding provider based on available configuration.
 * In server-side Edge Function contexts, pass the real NVIDIA API key to get
 * the NVIDIA provider. In frontend contexts, always use the stub provider —
 * API keys must never be read from import.meta.env in browser code.
 */
export function createEmbeddingProvider(
  apiKey: string | null,
  useStubForTesting = false
): EmbeddingProvider {
  if (useStubForTesting || !apiKey) {
    return new StubEmbeddingProvider()
  }
  return new NvidiaEmbeddingProvider(apiKey)
}

/**
 * Frontend-safe factory: always returns the stub provider. Never reads
 * import.meta.env for API keys. Use this from browser code.
 */
export function createFrontendEmbeddingProvider(): EmbeddingProvider {
  return new StubEmbeddingProvider()
}
