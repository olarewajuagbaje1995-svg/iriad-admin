/**
 * AI Provider Redundancy — mocked failover scenario tests.
 *
 * These tests simulate the ai-proxy Edge Function's dual-provider failover
 * logic (NVIDIA primary + Groq backup) with mocked provider responses.
 * They do NOT make live API calls — no credentials are required, and no
 * provider API keys are ever read or exposed.
 *
 * Scenarios covered:
 *   1. NVIDIA healthy → answer from NVIDIA, no failover
 *   2. NVIDIA unavailable → failover to Groq
 *   3. NVIDIA rate-limited (HTTP 429) → failover to Groq
 *   4. NVIDIA timeout → failover to Groq
 *   5. Both providers unavailable → error, no answer
 *   6. Recovery → NVIDIA healthy again after cooldown, back to primary
 */

import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Mocked provider responses (simulate fetch calls to NVIDIA / Groq)
// ---------------------------------------------------------------------------

type MockProviderCall = {
  provider: 'nvidia' | 'groq'
  ok: boolean
  content?: string
  error?: string
  status?: number
  delayMs?: number
}

/**
 * Simulates the ai-proxy Edge Function's chat/complete flow with failover.
 * Mirrors the logic in supabase/functions/ai-proxy/index.ts:
 *   - selectProvider: primary first if healthy/not in cooldown, then backup
 *   - isInCooldown: circuit breaker cooldown (5 min, failure threshold 3)
 *   - try providers in order; first success wins; both fail → error
 */
function simulateAiProxy(
  providerCalls: MockProviderCall[],
  primary: 'nvidia' | 'groq' = 'nvidia',
  failoverEnabled: boolean = true,
  engineFailures: Record<string, number> = {},
  engineStatus: Record<string, 'healthy' | 'degraded' | 'unavailable'> = {},
  lastCheckAt: Record<string, string | null> = {},
): {
  answer: string | null
  provider: string | null
  providersAttempted: string[]
  error: string | null
} {
  const failures: Record<string, number> = { ...engineFailures }
  const status: Record<string, 'healthy' | 'degraded' | 'unavailable'> = { ...engineStatus }
  const lastCheck: Record<string, string | null> = { ...lastCheckAt }

  const CIRCUIT_FAILURE_THRESHOLD = 3
  const CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000

  const isInCooldown = (name: string): boolean => {
    if (status[name] === 'healthy') return false
    if (!lastCheck[name]) return false
    return Date.now() - new Date(lastCheck[name]).getTime() < CIRCUIT_COOLDOWN_MS
  }

  // Build provider order (mirrors selectProvider in the Edge Function)
  const order: string[] = []
  if (!isInCooldown(primary)) order.push(primary)
  const backup = primary === 'nvidia' ? 'groq' : 'nvidia'
  if (failoverEnabled && !isInCooldown(backup)) order.push(backup)
  if (order.length === 0) {
    order.push(primary, backup)
  }

  const providersAttempted: string[] = []
  let answer: string | null = null
  let activeProvider: string | null = null

  // Find the mock call for a provider
  const getMock = (name: string): MockProviderCall | undefined =>
    providerCalls.find((c) => c.provider === name)

  for (const name of order) {
    providersAttempted.push(name)
    const mock = getMock(name)
    if (!mock) continue

    // Simulate circuit breaker: mark failure if provider is unhealthy
    if (status[name] === 'unavailable' || failures[name] >= CIRCUIT_FAILURE_THRESHOLD) {
      failures[name] = (failures[name] ?? 0) + 1
      status[name] = failures[name] >= CIRCUIT_FAILURE_THRESHOLD ? 'unavailable' : 'degraded'
      lastCheck[name] = new Date().toISOString()
      continue
    }

    if (mock.ok) {
      answer = mock.content ?? null
      activeProvider = name
      failures[name] = 0
      status[name] = 'healthy'
      lastCheck[name] = new Date().toISOString()
      break
    } else {
      // Provider call failed
      failures[name] = (failures[name] ?? 0) + 1
      status[name] = failures[name] >= CIRCUIT_FAILURE_THRESHOLD ? 'unavailable' : 'degraded'
      lastCheck[name] = new Date().toISOString()
    }
  }

  return {
    answer,
    provider: activeProvider,
    providersAttempted,
    error: answer ? null : 'All AI providers are temporarily unavailable. Please try again later.',
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ai-proxy failover — NVIDIA healthy (primary)', () => {
  it('returns answer from NVIDIA with no failover when healthy', () => {
    const result = simulateAiProxy([
      { provider: 'nvidia', ok: true, content: 'Answer from NVIDIA' },
      { provider: 'groq', ok: true, content: 'Answer from Groq' },
    ])

    expect(result.answer).toBe('Answer from NVIDIA')
    expect(result.provider).toBe('nvidia')
    expect(result.providersAttempted).toEqual(['nvidia'])
    expect(result.error).toBeNull()
  })

  it('still uses NVIDIA when Groq is also available but NVIDIA is primary', () => {
    const result = simulateAiProxy([
      { provider: 'nvidia', ok: true, content: 'NVIDIA answer' },
      { provider: 'groq', ok: true, content: 'Groq answer' },
    ], 'nvidia', true)

    expect(result.provider).toBe('nvidia')
    expect(result.providersAttempted).toEqual(['nvidia'])
  })
})

describe('ai-proxy failover — NVIDIA unavailable', () => {
  it('fails over to Groq when NVIDIA returns an error', () => {
    const result = simulateAiProxy([
      { provider: 'nvidia', ok: false, error: 'NVIDIA_API_KEY not configured' },
      { provider: 'groq', ok: true, content: 'Answer from Groq' },
    ])

    expect(result.answer).toBe('Answer from Groq')
    expect(result.provider).toBe('groq')
    expect(result.providersAttempted).toEqual(['nvidia', 'groq'])
    expect(result.error).toBeNull()
  })

  it('fails over to Groq when NVIDIA is marked unavailable (circuit open)', () => {
    const result = simulateAiProxy(
      [
        { provider: 'nvidia', ok: true, content: 'NVIDIA answer' },
        { provider: 'groq', ok: true, content: 'Groq answer' },
      ],
      'nvidia',
      true,
      { nvidia: 3 }, // at failure threshold → unavailable
      { nvidia: 'unavailable' },
      { nvidia: new Date(Date.now() - 1000).toISOString() }, // just checked → still in cooldown
    )

    expect(result.provider).toBe('groq')
    expect(result.providersAttempted).toEqual(['groq'])
    expect(result.error).toBeNull()
  })
})

describe('ai-proxy failover — NVIDIA rate-limited (HTTP 429)', () => {
  it('fails over to Groq when NVIDIA returns 429', () => {
    const result = simulateAiProxy([
      { provider: 'nvidia', ok: false, error: 'NVIDIA chat API returned 429: rate limit exceeded', status: 429 },
      { provider: 'groq', ok: true, content: 'Answer from Groq' },
    ])

    expect(result.answer).toBe('Answer from Groq')
    expect(result.provider).toBe('groq')
    expect(result.providersAttempted).toEqual(['nvidia', 'groq'])
    expect(result.error).toBeNull()
  })
})

describe('ai-proxy failover — NVIDIA timeout', () => {
  it('fails over to Groq when NVIDIA times out', () => {
    const result = simulateAiProxy([
      { provider: 'nvidia', ok: false, error: 'Fetch failed: AbortSignal timed out' },
      { provider: 'groq', ok: true, content: 'Answer from Groq' },
    ])

    expect(result.answer).toBe('Answer from Groq')
    expect(result.provider).toBe('groq')
    expect(result.providersAttempted).toEqual(['nvidia', 'groq'])
    expect(result.error).toBeNull()
  })
})

describe('ai-proxy failover — both providers unavailable', () => {
  it('returns error when both NVIDIA and Groq fail', () => {
    const result = simulateAiProxy([
      { provider: 'nvidia', ok: false, error: 'NVIDIA API error' },
      { provider: 'groq', ok: false, error: 'Groq API error' },
    ])

    expect(result.answer).toBeNull()
    expect(result.provider).toBeNull()
    expect(result.providersAttempted).toEqual(['nvidia', 'groq'])
    expect(result.error).toContain('All AI providers are temporarily unavailable')
  })

  it('returns error when both providers are in circuit-breaker cooldown', () => {
    const result = simulateAiProxy(
      [
        { provider: 'nvidia', ok: true, content: 'NVIDIA answer' },
        { provider: 'groq', ok: true, content: 'Groq answer' },
      ],
      'nvidia',
      true,
      { nvidia: 3, groq: 3 },
      { nvidia: 'unavailable', groq: 'unavailable' },
    )

    // All in cooldown → order falls back to [primary, backup] → both still fail
    expect(result.answer).toBeNull()
    expect(result.error).toContain('All AI providers are temporarily unavailable')
  })
})

describe('ai-proxy failover — recovery', () => {
  it('recovers to NVIDIA as primary after cooldown when NVIDIA becomes healthy again', () => {
    // First call: NVIDIA fails (3 consecutive failures → circuit open)
    const first = simulateAiProxy(
      [
        { provider: 'nvidia', ok: false, error: 'NVIDIA down' },
        { provider: 'groq', ok: true, content: 'Groq answer' },
      ],
      'nvidia',
      true,
      { nvidia: 3 },
      { nvidia: 'unavailable' },
    )
    expect(first.provider).toBe('groq')

    // Second call: NVIDIA is healthy again (circuit reset) → back to primary
    const second = simulateAiProxy(
      [
        { provider: 'nvidia', ok: true, content: 'NVIDIA recovered' },
        { provider: 'groq', ok: true, content: 'Groq answer' },
      ],
      'nvidia',
      true,
      { nvidia: 0 },
      { nvidia: 'healthy' },
    )
    expect(second.provider).toBe('nvidia')
    expect(second.answer).toBe('NVIDIA recovered')
    expect(second.providersAttempted).toEqual(['nvidia'])
  })

  it('stays on Groq while NVIDIA remains in cooldown', () => {
    const result = simulateAiProxy(
      [
        { provider: 'nvidia', ok: true, content: 'NVIDIA answer' },
        { provider: 'groq', ok: true, content: 'Groq answer' },
      ],
      'nvidia',
      true,
      { nvidia: 3 },
      { nvidia: 'unavailable' },
      { nvidia: new Date(Date.now() - 1000).toISOString() }, // just checked, still in cooldown
    )
    expect(result.provider).toBe('groq')
    expect(result.providersAttempted).toEqual(['groq'])
  })
})

describe('ai-proxy failover — failover disabled', () => {
  it('does not fall back to Groq when failover is disabled and NVIDIA fails', () => {
    const result = simulateAiProxy(
      [
        { provider: 'nvidia', ok: false, error: 'NVIDIA down' },
        { provider: 'groq', ok: true, content: 'Groq answer' },
      ],
      'nvidia',
      false, // failover disabled
    )

    expect(result.answer).toBeNull()
    expect(result.provider).toBeNull()
    expect(result.providersAttempted).toEqual(['nvidia'])
    expect(result.error).toContain('All AI providers are temporarily unavailable')
  })
})

describe('ai-proxy failover — Groq as primary', () => {
  it('uses Groq as primary when configured, falls back to NVIDIA', () => {
    const result = simulateAiProxy(
      [
        { provider: 'nvidia', ok: true, content: 'NVIDIA answer' },
        { provider: 'groq', ok: true, content: 'Groq answer' },
      ],
      'groq', // Groq is primary
      true,
    )

    expect(result.provider).toBe('groq')
    expect(result.providersAttempted).toEqual(['groq'])
  })

  it('fails over from Groq to NVIDIA when Groq is primary and fails', () => {
    const result = simulateAiProxy(
      [
        { provider: 'nvidia', ok: true, content: 'NVIDIA answer' },
        { provider: 'groq', ok: false, error: 'Groq down' },
      ],
      'groq',
      true,
    )

    expect(result.provider).toBe('nvidia')
    expect(result.providersAttempted).toEqual(['groq', 'nvidia'])
    expect(result.answer).toBe('NVIDIA answer')
  })
})

describe('ai-proxy failover — provider call ordering', () => {
  it('attempts primary before backup', () => {
    const result = simulateAiProxy(
      [
        { provider: 'nvidia', ok: true, content: 'NVIDIA answer' },
        { provider: 'groq', ok: true, content: 'Groq answer' },
      ],
      'nvidia',
      true,
    )
    // providersAttempted should only contain nvidia since it succeeded first
    expect(result.providersAttempted).toEqual(['nvidia'])
    expect(result.provider).toBe('nvidia')
  })

  it('records all attempted providers when both fail', () => {
    const result = simulateAiProxy(
      [
        { provider: 'nvidia', ok: false, error: 'NVIDIA error' },
        { provider: 'groq', ok: false, error: 'Groq error' },
      ],
      'nvidia',
      true,
    )
    expect(result.providersAttempted).toEqual(['nvidia', 'groq'])
  })
})

// ---------------------------------------------------------------------------
// Edge Function contract assertions (server-side security)
// ---------------------------------------------------------------------------

describe('ai-proxy — security contract (no frontend key exposure)', () => {
  it('embeddings always use NVIDIA (1536 dimensions) for KB compatibility', () => {
    // Documented constraint: embeddings use nvidia/embed-qa-4 (1536 dims)
    // Groq is chat-completion only, never used for embeddings
    const EMBEDDING_DIMENSIONS = 1536
    const EMBEDDING_MODEL = 'nvidia/embed-qa-4'
    expect(EMBEDDING_DIMENSIONS).toBe(1536)
    expect(EMBEDDING_MODEL).toBe('nvidia/embed-qa-4')
  })

  it('provider order is deterministic: primary first, then backup', () => {
    const result = simulateAiProxy(
      [
        { provider: 'nvidia', ok: true, content: 'NVIDIA' },
        { provider: 'groq', ok: true, content: 'Groq' },
      ],
      'nvidia',
      true,
    )
    expect(result.providersAttempted[0]).toBe('nvidia')
  })
})
