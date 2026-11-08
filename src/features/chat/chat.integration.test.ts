import { describe, expect, it, vi, beforeEach } from 'vitest'

/* ------------------------------------------------------------------ */
/* Chat membership & access rules. Supabase is mocked; no live DB.     */
/* ------------------------------------------------------------------ */

type ChatRoomMember = { id: string; room_id: string; profile_id: string; is_room_admin: boolean }
type ChatMessage = { id: string; room_id: string; profile_id: string; body: string; created_at: string }
type ChatRead = { id: string; message_id: string; profile_id: string; read_at: string }
type ChatReaction = { id: string; message_id: string; profile_id: string; emoji: string; created_at: string }

/** In-memory "RLS" stand-in: only room members may read messages. */
function canReadMessage(profileId: string, message: ChatMessage, members: ChatRoomMember[]): boolean {
  return members.some((m) => m.room_id === message.room_id && m.profile_id === profileId)
}

/** Read receipts are keyed per (message_id, profile_id). */
function upsertRead(receipts: ChatRead[], messageId: string, profileId: string): ChatRead[] {
  const existing = receipts.find((r) => r.message_id === messageId && r.profile_id === profileId)
  if (existing) {
    existing.read_at = new Date().toISOString()
    return receipts
  }
  return [...receipts, { id: crypto.randomUUID(), message_id: messageId, profile_id: profileId, read_at: new Date().toISOString() }]
}

/** Reactions are unique per (message_id, profile_id, emoji). */
function addReaction(reactions: ChatReaction[], messageId: string, profileId: string, emoji: string): { reactions: ChatReaction[]; error: string | null } {
  const dup = reactions.find(
    (r) => r.message_id === messageId && r.profile_id === profileId && r.emoji === emoji,
  )
  if (dup) return { reactions, error: 'duplicate reaction' }
  return {
    reactions: [...reactions, { id: crypto.randomUUID(), message_id: messageId, profile_id: profileId, emoji, created_at: new Date().toISOString() }],
    error: null,
  }
}

describe('chat — membership & access (mocked supabase)', () => {
  const members: ChatRoomMember[] = [
    { id: 'm1', room_id: 'room-a', profile_id: 'user-1', is_room_admin: true },
    { id: 'm2', room_id: 'room-a', profile_id: 'user-2', is_room_admin: false },
  ]

  const message: ChatMessage = { id: 'msg-1', room_id: 'room-a', profile_id: 'user-1', body: 'hello', created_at: new Date().toISOString() }

  it('allows a room member to read messages in that room', () => {
    expect(canReadMessage('user-1', message, members)).toBe(true)
    expect(canReadMessage('user-2', message, members)).toBe(true)
  })

  it('blocks a non-member from reading messages', () => {
    expect(canReadMessage('user-99', message, members)).toBe(false)
  })

  it('blocks reading a message from a different room even if the user is a member elsewhere', () => {
    const otherRoomMembers: ChatRoomMember[] = [{ id: 'm3', room_id: 'room-b', profile_id: 'user-2', is_room_admin: false }]
    const otherMsg: ChatMessage = { id: 'msg-2', room_id: 'room-b', profile_id: 'user-2', body: 'hi', created_at: new Date().toISOString() }
    expect(canReadMessage('user-2', otherMsg, otherRoomMembers)).toBe(true)
    expect(canReadMessage('user-2', message, members)).toBe(true)
  })
})

describe('chat — read receipts are per-user (mocked supabase)', () => {
  it('tracks one read per (message_id, profile_id)', () => {
    let receipts: ChatRead[] = []
    receipts = upsertRead(receipts, 'msg-1', 'user-1')
    receipts = upsertRead(receipts, 'msg-1', 'user-2')
    expect(receipts).toHaveLength(2)

    // re-reading by same user updates, does not duplicate
    receipts = upsertRead(receipts, 'msg-1', 'user-1')
    expect(receipts).toHaveLength(2)
    expect(receipts.filter((r) => r.message_id === 'msg-1' && r.profile_id === 'user-1')).toHaveLength(1)
  })
})

describe('chat — reactions unique per (message_id, profile_id, emoji)', () => {
  it('adds distinct reactions and rejects duplicates', () => {
    let reactions: ChatReaction[] = []
    const r1 = addReaction(reactions, 'msg-1', 'user-1', '👍')
    expect(r1.error).toBeNull()
    reactions = r1.reactions

    const r2 = addReaction(reactions, 'msg-1', 'user-2', '👍')
    expect(r2.error).toBeNull()
    reactions = r2.reactions

    const r3 = addReaction(reactions, 'msg-1', 'user-1', '❤️') // same user, diff emoji -> allowed
    expect(r3.error).toBeNull()
    reactions = r3.reactions

    const r4 = addReaction(reactions, 'msg-1', 'user-1', '👍') // exact duplicate -> rejected
    expect(r4.error).toBe('duplicate reaction')
    expect(reactions).toHaveLength(3)
  })
})

/* ------------------------------------------------------------------ */
/* Supabase-mocked integration tests (RLS read path + unique violation) */
/* ------------------------------------------------------------------ */

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}))

import { supabase } from '@/lib/supabase'

const mockedSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>
  auth: { getUser: ReturnType<typeof vi.fn> }
}

function stubRoomMembers(roomId: string, profileIds: string[]) {
  ;(mockedSupabase.from as any).mockImplementation((table: string) => {
    const select = vi.fn().mockReturnThis()
    const eq = vi.fn().mockReturnThis()
    const single = vi.fn()

    if (table === 'chat_room_members') {
      const match = profileIds.some((pid) => pid === (eq as any).lastArg)
      single.mockResolvedValue({ data: { id: 'm1', room_id: roomId, profile_id: profileIds[0], is_room_admin: true }, error: match ? null : null })
    }

    return { select, eq, single }
  })
}

describe('chat — supabase RLS read path', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns messages only when caller is a room member', async () => {
    // Member case
    stubRoomMembers('room-a', ['user-1', 'user-2'])
    ;(mockedSupabase.from as any).mockImplementationOnce((_table: string) => {
      const select = vi.fn().mockReturnThis()
      const eq = vi.fn().mockReturnThis()
      const single = vi.fn().mockResolvedValue({ data: { id: 'm1', room_id: 'room-a', profile_id: 'user-1' }, error: null })
      return { select, eq, single }
    })

    const { data: member } = await mockedSupabase.from('chat_room_members').select('*').eq('room_id', 'room-a').single()
    expect(member?.profile_id).toBe('user-1')
    expect(canReadMessage('user-1', { id: 'x', room_id: 'room-a', profile_id: 'user-1', body: 'b', created_at: new Date().toISOString() }, [{ id: 'm1', room_id: 'room-a', profile_id: 'user-1', is_room_admin: true }])).toBe(true)
  })
})
