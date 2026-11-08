import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Send, MessageCircle } from 'lucide-react'

export default function ChatbotPage() {
  const [currentConv, setCurrentConv] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [configured, setConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    try {
      const { data } = await supabase.from('chatbot_conversations').select('*').order('updated_at', { ascending: false }).limit(20)
      setCurrentConv(data?.[0] ?? null)
      // Check if webhook is configured
      setConfigured(!!import.meta.env.VITE_N8N_KNOWLEDGE_CHAT_WEBHOOK_URL)
    } catch (e: any) {
      console.error(e)
    }
  }

  const loadHistory = async (conversationId: string) => {
    try {
      const { data } = await supabase
        .from('chatbot_messages')
        .select('role, content, sources, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      setMessages(data ?? [])
    } catch (e: any) {
      console.error(e)
    }
  }

  const sendQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMessages((prev) => [...prev, { role: 'assistant' as const, content: 'Please sign in to use the knowledge assistant.', sources: [], created_at: new Date().toISOString() }])
      return
    }

    const userMsg = { role: 'user' as const, content: input, created_at: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)

    // Ensure a conversation exists
    let convId = currentConv?.id
    if (!convId) {
      const { data: newConv } = await supabase.from('chatbot_conversations').insert([{
        profile_id: user.id,
        title: input.slice(0, 60),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]).select().single()
      convId = newConv?.id
      if (convId) setCurrentConv(newConv)
    }

    // Save user message
    if (convId) {
      await supabase.from('chatbot_messages').insert([{
        conversation_id: convId,
        profile_id: user.id,
        role: 'user',
        content: input,
        created_at: new Date().toISOString(),
      }])
      loadHistory(convId)
    }

    try {
      const webhookUrl = import.meta.env.VITE_N8N_KNOWLEDGE_CHAT_WEBHOOK_URL
      if (!webhookUrl) {
        setMessages((prev) => [...prev, { role: 'assistant' as const, content: 'Knowledge assistant is not configured yet. Please contact your administrator.', sources: [], created_at: new Date().toISOString() }])
        return
      }

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ question: input, conversation_id: convId, profile_id: user.id }),
      })
      const json = await res.json().catch(() => ({}))
      const assistantMsg = { role: 'assistant' as const, content: json.answer ?? 'I could not find this in the approved knowledge base.', sources: json.sources ?? [], created_at: new Date().toISOString() }
      setMessages((prev) => [...prev, assistantMsg])
      if (convId) {
        await supabase.from('chatbot_messages').insert([{
          conversation_id: convId,
          profile_id: user.id,
          role: 'assistant',
          content: assistantMsg.content,
          sources: assistantMsg.sources,
          created_at: assistantMsg.created_at,
        }])
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant' as const, content: 'Knowledge assistant is temporarily unavailable. Please try again later.', sources: [], created_at: new Date().toISOString() }])
    } finally {
      setSending(false)
    }
  }

  if (configured === false) {
    return (
      <div className="flex h-[600px] flex-col">
        <div className="border-b border-neutral-200 bg-white px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Knowledge Assistant</h2>
            <p className="text-xs text-neutral-500">Ask about IRIAD policies, projects, and procedures.</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="text-center py-10 text-neutral-500">
            <p>Knowledge assistant is not configured.</p>
            <p className="mt-2 text-xs text-neutral-400">Set VITE_N8N_KNOWLEDGE_CHAT_WEBHOOK_URL and connect the n8n knowledge-chat webhook.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[600px] flex-col">
      <div className="border-b border-neutral-200 bg-white px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
          <MessageCircle className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Knowledge Assistant</h2>
          <p className="text-xs text-neutral-500">Ask about IRIAD policies, projects, and procedures.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-10 text-neutral-500">
            <p>Ask me anything about IRIAD.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
              m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-900'
            }`}>
              {m.content}
              {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                <div className="mt-2 text-[10px] text-neutral-500">
                  Sources: {Array.isArray(m.sources) ? m.sources.join(', ') : String(m.sources)}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && <div className="flex justify-start"><div className="bg-neutral-100 text-neutral-900 rounded-lg px-4 py-2">Thinking…</div></div>}
      </div>

      <form onSubmit={sendQuestion} className="px-6 py-4 border-t border-neutral-200 bg-white">
        <div className="flex gap-2">
          <input
            className="flex-1 input rounded-l-md"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            disabled={sending}
          />
          <button className="btn-primary px-4 rounded-r-md" disabled={sending || !input.trim()}>
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">Answers are grounded in approved knowledge sources. Not configured? Contact your admin.</p>
      </form>
    </div>
  )
}
