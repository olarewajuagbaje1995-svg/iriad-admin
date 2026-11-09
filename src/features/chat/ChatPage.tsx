import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Send,
  MessageCircle,
  Users,
  Plus,
  Image,
  Eye,
  Search,
  Trash2,
  Pencil,
  Save,
  X,
  MessageSquare,
} from 'lucide-react'
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
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' && window.innerWidth > 768)

  const [userId, setUserId] = useState<string | null>(null)
  const channelRef = useRef<any>(null)

  const { profile } = useAuth()
  const role: 'admin' | 'director' | 'staff' = (profile?.role as 'admin' | 'director' | 'staff') ?? 'staff'
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomDescription, setNewRoomDescription] = useState('')
  const [newRoomPrivate, setNewRoomPrivate] = useState(false)
  const [creatingRoom, setCreatingRoom] = useState(false)

  const canManageRoom = () => role === 'admin' || role === 'director'

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, currentRoom])

  // Create room
  const startEditRoom = (room: any) => {
    if (!canManageRoom()) return
    setEditingRoomId(room.id)
    setEditRoomName(room.name)
    setEditRoomDescription(room.description ?? '')
    setEditRoomPrivate(room.is_private)
  }

  const cancelEditRoom = () => {
    setEditingRoomId(null)
    setEditRoomName('')
    setEditRoomDescription('')
    setEditRoomPrivate(false)
  }

  const handleEditRoomSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRoomId) return
    try {
      const { error: err } = await supabase
        .from('chat_rooms')
        .update({
          name: editRoomName.trim(),
          description: editRoomDescription.trim() || null,
          is_private: editRoomPrivate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingRoomId)
      if (err) throw err
      cancelEditRoom()
      await loadRooms()
    } catch (err: any) {
      alert(err.message || 'Failed to update room.')
    }
  }

  const handleDeleteRoom = async (id: string) => {
    if (!canManageRoom()) return
    if (!window.confirm('Delete this room?')) return
    try {
      const { error: err } = await supabase.from('chat_rooms').delete().eq('id', id)
      if (err) throw err
      loadRooms()
      if (currentRoom?.id === id) setCurrentRoom(null)
    } catch (err: any) {
      alert(err.message || 'Failed to delete room.')
    }
  }

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

  // Edit room state.
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [editRoomName, setEditRoomName] = useState('')
  const [editRoomDescription, setEditRoomDescription] = useState('')
  const [editRoomPrivate, setEditRoomPrivate] = useState(false)

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
    setImagePreviews([])
    if (isMobile) setSidebarOpen(false)

    try {
      const { data } = await supabase
        .from('chat_messages')
        .select('*, profiles(full_name, avatar_url), chat_message_attachments(*), chat_message_reactions(*), chat_message_reads(profile_id)')
        .eq('room_id', room.id)
        .order('created_at', { ascending: true })
        .limit(100)
      setMessages(data ?? [])

      if (userId) {
        await supabase.from('chat_message_reads').upsert([
          { room_id: room.id, profile_id: userId, read_at: new Date().toISOString() },
        ])
      }

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }

      const channel = supabase.channel(`room:${room.id}`)
      channelRef.current = channel
      channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${room.id}` }, (payload: any) => {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === payload.new.id)
            if (exists) return prev
            return [...prev, payload.new]
          })
          setTimeout(scrollToBottom, 100)
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const imageFiles = files.filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    const previews = imageFiles.map((f) => URL.createObjectURL(f))
    setImagePreviews((prev) => [...prev, ...previews])
    setAttachments((prev) => [...prev, ...imageFiles])
    e.target.value = ''
  }

  const removeImagePreview = (index: number) => {
    setAttachments((prev) => {
      const file = prev[index]
      if (file) URL.revokeObjectURL(imagePreviews[index])
      return prev.filter((_, i) => i !== index)
    })
    setImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  const uploadImage = async (file: File, messageId: string) => {
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`
    const orgId = (await supabase.from('profiles').select('organisation_id').eq('id', userId).single()).data?.organisation_id
    const storagePath = `chat_images/${orgId}/${currentRoom!.id}/${fileName}`

    const { error: upErr } = await supabase.storage.from('chat_images').upload(storagePath, file)
    if (upErr) {
      console.error('Image upload failed:', upErr)
      return null
    }

    const { data: urlData } = supabase.storage.from('chat_images').getPublicUrl(storagePath)
    const imageUrl = urlData.publicUrl

    await supabase.from('chat_message_attachments').insert([{
      message_id: messageId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
    }])

    return imageUrl
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!newMessage.trim() && attachments.length === 0 && imagePreviews.length === 0) || !currentRoom) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setUploading(true)

    try {
      const { data } = await supabase
        .from('chat_messages')
        .insert([{
          room_id: currentRoom.id,
          profile_id: user.id,
          body: newMessage.trim(),
          message_type: attachments.length > 0 || imagePreviews.length > 0 ? 'image' : 'text',
        }])
        .select('*, profiles(full_name, avatar_url), chat_message_attachments(*), chat_message_reactions(*), chat_message_reads(profile_id)').single()

      if (!data) {
        setUploading(false)
        return
      }

      // Upload images
      const imageFiles = attachments.filter((f) => f.type.startsWith('image/'))
      for (const file of imageFiles) {
        const imageUrl = await uploadImage(file, data.id)
        if (imageUrl) {
          await supabase.from('chat_messages').update({
            body: imageUrl,
          }).eq('id', data.id)
        }
      }

      setMessages((prev) => [...prev, data])
      setNewMessage('')
      setAttachments([])
      setImagePreviews([])
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to send message.')
    } finally {
      setUploading(false)
    }
  }

  const addReaction = async (messageId: string, emoji: string) => {
    if (!userId || !currentRoom) return
    try {
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

  const isOwnMessage = (message: any) => message.profile_id === userId

  const senderName = (message: any) => {
    return (message.profiles as any)?.full_name ?? 'User'
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <MessageCircle className="w-8 h-8 text-brand-600 animate-pulse" />
        <p className="text-neutral-500">Loading chat…</p>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">
      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Rooms sidebar */}
      <aside className="hidden md:flex flex-col w-80 border-r border-neutral-200 bg-white">
        <div className="flex items-center justify-between px-4 py-4 border-b border-neutral-200 bg-white">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-brand-600" />
            <h2 className="text-sm font-semibold text-neutral-900">Chats</h2>
          </div>
          {canManageRoom() && (
            <button
              className="p-1.5 text-neutral-500 hover:text-brand-600 hover:bg-neutral-100 rounded-md transition-colors"
              title="New room"
              onClick={() => setShowCreateForm((s) => !s)}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="relative px-2 pb-2">
          <Search className="absolute left-2 top-2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            className="pl-7 pr-2 input text-sm w-full"
            placeholder="Search rooms…"
            value={roomSearch}
            onChange={(e) => setRoomSearch(e.target.value)}
          />
        </div>

        {showCreateForm && (
          <div className="p-3 space-y-2 border-b border-neutral-100 bg-white/80 backdrop-blur">
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

        {editingRoomId && canManageRoom() && (
          <div className="p-3 space-y-2 border-b border-neutral-100 bg-white/80 backdrop-blur">
            <h3 className="text-[10px] font-medium text-neutral-600 uppercase mb-1">Edit room</h3>
            <form onSubmit={handleEditRoomSave} className="space-y-2">
              <input
                className="input text-sm"
                value={editRoomName}
                onChange={(e) => setEditRoomName(e.target.value)}
                placeholder="Room name"
                required
              />
              <input
                className="input text-sm mt-1"
                value={editRoomDescription}
                onChange={(e) => setEditRoomDescription(e.target.value)}
                placeholder="Description (optional)"
              />
              <div className="flex items-center gap-2 mt-1">
                <input
                  id="edit-room-private"
                  type="checkbox"
                  checked={editRoomPrivate}
                  onChange={(e) => setEditRoomPrivate(e.target.checked)}
                />
                <label htmlFor="edit-room-private" className="text-xs text-neutral-600">Private room</label>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost text-xs flex-1" onClick={cancelEditRoom}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs">
                  <Save className="w-3 h-3 mr-1" /> Save
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
              <div
                key={room.id}
                className={`flex items-center justify-between px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                  currentRoom?.id === room.id ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'text-neutral-600 hover:bg-neutral-100'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  openRoom(room)
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0">{room.name.charAt(0).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-neutral-900 truncate">{room.name}</div>
                      <div className="text-xs text-neutral-400 truncate">{room.who_can_send}</div>
                    </div>
                  </div>
                </div>
                {canManageRoom() && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      className="btn-ghost text-xs p-1.5 text-neutral-500 hover:text-brand-600"
                      title="Edit room"
                      onClick={(e) => { e.stopPropagation(); startEditRoom(room) }}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs p-1.5 text-neutral-500 hover:text-red-600"
                      title="Delete room"
                      onClick={(e) => { e.stopPropagation(); handleDeleteRoom(room.id) }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))
          })()}
        </div>
      </aside>

      {/* Mobile toggle sidebar */}
      {isMobile && (
        <button
          className="md:hidden p-3 text-neutral-600 hover:bg-neutral-200"
          onClick={() => setSidebarOpen((s) => !s)}
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
        </button>
      )}

      {/* Chat window */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {!currentRoom ? (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-500">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mb-4">
              <Users className="w-8 h-8" />
            </div>
            <p className="text-sm font-medium text-neutral-900">Select a room to start messaging.</p>
            <p className="text-xs text-neutral-500 mt-1">Pick a conversation from the sidebar.</p>
          </div>
        ) : (
          <div className="flex flex-col h-full min-w-0">
            <header className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-medium text-sm">
                  {currentRoom.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-neutral-900">{currentRoom.name}</div>
                  <div className="text-xs text-neutral-500">
                    {currentRoom.description ?? 'Group chat'} • {(currentRoom as any)?.organisation_id ? 'Organisation channel' : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-neutral-500" />
                <Eye className="w-4 h-4 text-neutral-500 hover:text-brand-600 cursor-pointer" />
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth" ref={scrollRef}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
                  <MessageCircle className="w-10 h-10 mb-2" />
                  <p className="text-sm">No messages yet.</p>
                </div>
              )}
              {messages.map((m) => {
                const own = isOwnMessage(m)
                const isImage = m.message_type === 'image' || (m.body && (m.body.match(/\.(jpeg|jpg|png|gif|webp)$/i) || m.body.startsWith('http')))
                return (
                  <div
                    key={m.id}
                    className={`flex w-full max-w-[85%] ${own ? 'justify-end' : 'justify-start'} animate-fade-in`}
                  >
                    {!own && (
                      <div className="flex items-end gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center text-[10px] font-medium text-neutral-700">
                          {senderName(m).charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[10px] font-medium text-neutral-500">{senderName(m)}</span>
                      </div>
                    )}
                    <div className={`rounded-2xl px-4 py-2.5 max-w-xs sm:max-w-md text-sm ${
                      own
                        ? 'bg-brand-600 text-white'
                        : 'bg-neutral-200 text-neutral-900'
                    } ${isImage ? 'p-1' : ''}`}>
                      {isImage && m.body && (m.body.startsWith('http') || m.body.match(/\.(jpeg|jpg|png|gif|webp)$/i)) ? (
                        <img
                          src={m.body}
                          alt="Message image"
                          className="max-w-[200px] max-h-[200px] rounded-lg object-cover cursor-pointer"
                          onClick={() => window.open(m.body, '_blank')}
                        />
                      ) : (
                        m.body
                      )}
                    </div>
                    <div className={`flex items-end gap-1 ${own ? 'justify-end' : 'justify-start'}`}>
                      <span className={`text-[10px] ${
                        own ? 'text-brand-400' : 'text-neutral-400'
                      }`}>
                        {formatLagos(m.created_at, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {own && (
                        <>
                          <span className={`text-[10px] ${getReaders(m).length > 0 ? 'text-green-500' : 'text-neutral-400'}`}>
                            {getReaders(m).length > 0 ? '✓✓' : '✓'}
                          </span>
                          <div className="flex gap-1 ml-1">
                            {['👍', '❤️', '😂', '🎉'].map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => addReaction(m.id, emoji)}
                                className="p-1 text-[10px] hover:bg-white/20 rounded-md"
                                title={`React ${emoji}`}
                              >
                                {emoji} {getReactionCount(m, emoji)}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="px-4 py-3 border-t border-neutral-200 bg-white shrink-0">
              <div className="flex gap-2 items-end">
                <button
                  type="button"
                  className="p-2 text-neutral-500 hover:text-brand-600 hover:bg-neutral-100 rounded-md transition-colors disabled:opacity-50"
                  title="Attach image"
                  disabled={uploading}
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById('chat-image-upload')?.click()
                  }}
                >
                  <Image className="w-4 h-4" />
                </button>
                <input
                  id="chat-image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageSelect}
                />

                {imagePreviews.length > 0 && (
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {imagePreviews.map((preview, i) => (
                      <div key={i} className="relative flex-shrink-0">
                        <img
                          src={preview}
                          alt="Preview"
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            removeImagePreview(i)
                          }}
                          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500/90 text-white text-[10px] flex items-center justify-center"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  className="flex-1 input border-l-0 border-r-0 rounded-l-none rounded-r-md pl-3 pr-3 text-sm min-h-[40px]"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message…"
                  disabled={uploading}
                />
                <button
                  className="btn-primary px-4 rounded-full text-sm min-h-[40px]"
                  disabled={((!newMessage.trim() && attachments.length === 0 && imagePreviews.length === 0) || uploading)}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              {uploading && (
                <p className="text-[10px] text-neutral-500 mt-1">Sending…</p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
