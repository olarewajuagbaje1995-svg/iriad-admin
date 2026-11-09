import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Send, MessageCircle, Users, Plus, Paperclip, Eye, Search } from 'lucide-react'
import { formatLagos } from '@/lib/dates'
import { useAuth } from '@/hooks/useAuth'

export default function ChatPage() {
  const [rooms, setRooms] = useState<any[]>([])
  const [currentRoom, setCurrentRoom] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [roomSearch, setRoomSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const channelRef = useRef<any>(null)

  // Create room
  const { profile } = useAuth()
  const role: 'admin' | 'director' | 'staff' = (profile?.role as 'admin' | 'director' | 'staff') ?? 'staff'
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomDescription, setNewRoomDescription] = useState('')
  const [newRoomPrivate, setNewRoomPrivate] = useState(false)
  const [creatingRoom, setCreatingRoom] = useState(false)

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoomName.trim()) return
    if (!userId) return

    setCreatingRoom(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: room, error: err } = await supabase
        .from('chat_rooms')
        .insert([{
          name: newRoomName.trim(),
          description: newRoomDescription.trim() || null,
          is_private: newRoomPrivate,
          who_can_send: 'all',
          created_by: user.id,
          organisation_id: profile?.organisation_id ?? null,
        }])
        .select()
        .single()
      if (err) throw err

      // Add the creator as a room admin.
      await supabase.from('chat_room_members').insert([{
        room_id: room.id,
        profile_id: user.id,
        is_room_admin: true,
      }])

      setShowCreateForm(false)
      setNewRoomName('')
      setNewRoomDescription('')
      setNewRoomPrivate(false)
      await loadRooms()
    } catch (err: any) {
      alert(err.message || 'Failed to create room.')
    } finally {
      setCreatingRoom(false)
    }
  }

  useEffect(() => {
    loadRooms()
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [])

  const loadRooms = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)

      const { data } = await supabase.from('chat_rooms').select('*').order('created_at', { ascending: false })
      setRooms(data ?? [])
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const openRoom = async (room: any) => {
    setCurrentRoom(room)
    setMessages([])
    setAttachments([])
    try {
      const { data } = await supabase
        .from('chat_messages')
        .select('*, profiles(full_name, avatar_url), chat_message_attachments(*), chat_message_reactions(*), chat_message_reads(profile_id)')
        .eq('room_id', room.id)
        .order('created_at', { ascending: true })
        .limit(100)
      setMessages(data ?? [])

      // Mark as read
      if (userId) {
        await supabase.from('chat_message_reads').upsert([
          { room_id: room.id, profile_id: userId, read_at: new Date().toISOString() },
        ])
      }

      // Clean up previous channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }

      const channel = supabase.channel(`room:${room.id}`)
      channelRef.current = channel
      channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${room.id}` }, (payload: any) => {
          setMessages((prev) => [...prev, payload.new])
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_message_reactions', filter: `room_id=eq.${room.id}` }, (payload: any) => {
          setMessages((prev) => prev.map((m) => m.id === payload.new.message_id
            ? { ...m, chat_message_reactions: [...(m.chat_message_reactions ?? []), payload.new] }
            : m))
        })
        .subscribe()
    } catch (e: any) {
      console.error(e)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() && attachments.length === 0 || !currentRoom) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setUploading(true)

    // Insert message first to get a real message_id
    const { data } = await supabase
      .from('chat_messages')
      .insert([{ room_id: currentRoom.id, profile_id: user.id, body: newMessage }])
      .select('*, profiles(full_name), chat_message_attachments(*), chat_message_reactions(*), chat_message_reads(profile_id)').single()

    if (!data) {
      setUploading(false)
      return
    }

    // Upload attachments and link to the real message_id
    if (attachments.length > 0) {
      const orgId = (await supabase.from('profiles').select('organisation_id').eq('id', user.id).single()).data?.organisation_id
      for (const file of attachments) {
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`
        const storagePath = `chat/${orgId}/${currentRoom!.id}/${fileName}`
        const { error: upErr } = await supabase.storage.from('documents').upload(storagePath, file)
        if (!upErr) {
          await supabase.from('chat_message_attachments').insert([{
            message_id: data.id,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            storage_path: storagePath,
            uploaded_by: user.id,
          }])
        }
      }
    }

    setMessages((prev) => [...prev, data])
    setNewMessage('')
    setAttachments([])
    setUploading(false)
  }

  const removeAttachment = (file: File) => {
    setAttachments(attachments.filter((f) => f !== file))
  }

  const addReaction = async (messageId: string, emoji: string) => {
    if (!userId || !currentRoom) return
    try {
      // Check if user already reacted with this emoji
      const msg = messages.find((m) => m.id === messageId)
      const existing = msg?.chat_message_reactions?.find((r: any) => r.profile_id === userId && r.emoji === emoji)
      if (existing) {
        await supabase.from('chat_message_reactions').delete().eq('id', existing.id)
      } else {
        await supabase.from('chat_message_reactions').insert([{
          message_id: messageId, profile_id: userId, emoji,
        }])
      }
    } catch (e: any) {
      console.error(e)
    }
  }

  const getReactionCount = (message: any, emoji: string) => {
    return message.chat_message_reactions?.filter((r: any) => r.emoji === emoji).length ?? 0
  }

  const getReaders = (message: any) => {
    return message.chat_message_reads?.map((r: any) => r.profile_id).filter(Boolean) ?? []
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (loading) return <div className="p-6">Loading rooms…</div>

  return (
    <div className="flex h-[600px]">
      {/* Rooms list */}
      <div className="w-80 border-r border-neutral-200 bg-white flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-brand-600" />
            <h2 className="text-sm font-semibold text-neutral-900">Chat Rooms</h2>
          </div>
          {role === 'admin' || role === 'director' ? (
            <button className="p-1.5 text-neutral-500 hover:text-brand-600" title="New room" onClick={() => setShowCreateForm((s) => !s)}>
              <Plus className="w-4 h-4" />
            </button>
          ) : null}
        </div>
        <div className="relative px-2 pb-1">
          <Search className="absolute left-2 top-2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            className="pl-7 pr-2 input text-sm"
            placeholder="Search rooms…"
            value={roomSearch}
            onChange={(e) => setRoomSearch(e.target.value)}
          />
        </div>

        {showCreateForm && (
          <div className="p-2 space-y-2">
            <form onSubmit={(e) => void createRoom(e)} className="space-y-2">
              <label className="text-[10px] font-medium text-neutral-600 uppercase">New room</label>
              <input
                className="input text-sm"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name"
                required
              />
              <input
                className="input text-sm mt-1"
                value={newRoomDescription}
                onChange={(e) => setNewRoomDescription(e.target.value)}
                placeholder="Description (optional)"
              />
              <div className="flex items-center gap-2 mt-1">
                <input
                  id="room-private"
                  type="checkbox"
                  checked={newRoomPrivate}
                  onChange={(e) => setNewRoomPrivate(e.target.checked)}
                />
                <label htmlFor="room-private" className="text-xs text-neutral-600">Private room</label>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost text-xs flex-1" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs" disabled={creatingRoom}>
                  {creatingRoom ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {(() => {
            const filtered = rooms.filter((r) => r.name.toLowerCase().includes(roomSearch.toLowerCase()))
            if (filtered.length === 0) {
              return <div className="text-center py-10 text-neutral-500 text-sm">No chat rooms available.</div>
            }
            return filtered.map((room) => (
              <button
                key={room.id}
                onClick={() => openRoom(room)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  currentRoom?.id === room.id ? 'bg-brand-50 text-brand-700' : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                <div className="flex-1">{room.name}</div>
                <span className="text-xs text-neutral-400">{room.who_can_send}</span>
              </button>
            ))
          })()}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {!currentRoom ? (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-500">
            <p>Select a room to start messaging.</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-medium text-sm">
                  {currentRoom.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-neutral-900">{currentRoom.name}</div>
                  <div className="text-xs text-neutral-500">{currentRoom.description ?? 'Group chat'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-neutral-500" />
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-neutral-400 text-sm py-4">No messages yet.</div>
              )}
              {messages.map((m) => (
                <div key={m.id} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-neutral-200 flex-shrink-0 flex items-center justify-center text-xs text-neutral-600">
                    {(m.profiles as any)?.full_name?.charAt(0) ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium text-neutral-700">{ (m.profiles as any)?.full_name ?? 'User' }</span>
                      <span className="text-[10px] text-neutral-400">{formatLagos(m.created_at, { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className={`rounded-lg px-3 py-2 max-w-[80%] ${
                      m.profile_id === userId ? 'bg-brand-600 text-white ml-auto' : 'bg-neutral-100 text-neutral-900'
                    }`}>
                      {m.body}
                      {m.chat_message_attachments?.length > 0 && (
                        <div className="mt-2">
                          {m.chat_message_attachments.map((a: any) => (
                            <div key={a.id} className="flex items-center gap-2 mt-1 p-2 rounded bg-brand-50 text-[10px] text-brand-700 border border-brand-100">
                              <Paperclip className="w-3 h-3 mr-1" />
                              <span>{a.file_name}</span> ({formatFileSize(a.file_size)})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {[['👍', '❤️', '😂', '🎉']].flat().map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => addReaction(m.id, emoji)}
                          className="p-0.5 text-[10px] hover:bg-neutral-100 rounded"
                          title={`React ${emoji}`}
                        >
                          {emoji} {getReactionCount(m, emoji)}
                        </button>
                      ))}
                      {m.chat_message_reads?.some((r: any) => r.profile_id === userId) && (
                        <Eye className="w-3 h-3 text-green-600" />
                      )}
                      <span className="text-[10px] text-neutral-400">{getReaders(m).length} read</span>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="px-4 py-3 border-t border-neutral-200 bg-white">
              <div className="flex gap-2">
                <button type="button" className="p-2 text-neutral-400 hover:text-neutral-600 disabled:opacity-50" title="Attach" disabled={uploading}>
                  <Paperclip className="w-4 h-4" />
                </button>
                {attachments.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-100">
              {attachments.map((f) => (
                <span key={f.name} className="flex items-center gap-1 text-[10px]">
                  <button onClick={() => removeAttachment(f)} className="text-red-500 hover:text-red-700">✕</button>
                  {f.name}
                </span>
              ))}
            </div>
          )}
                <input
                  className="flex-1 input border-l-0 border-r-0 rounded-l-none rounded-r-md pl-3"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message…"
                  disabled={uploading}
                />
                <button className="btn-primary px-4" disabled={(!newMessage.trim() && attachments.length === 0) || uploading}>
                  <Send className="w-4 h-4" />
                </button>
              </div>
              {uploading && <p className="text-[10px] text-neutral-500 mt-1">Uploading attachments…</p>}
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
