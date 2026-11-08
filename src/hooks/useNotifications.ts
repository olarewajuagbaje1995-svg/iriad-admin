import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useNotifications() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50)
      setNotifications(data ?? [])
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [load])

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id)
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)))
  }

  return { notifications, loading, markRead, refresh: load }
}
