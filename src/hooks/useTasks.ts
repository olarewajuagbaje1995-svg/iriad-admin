import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { Role } from '@/config/brand'

type Task = Database['public']['Tables']['tasks']['Row']

interface UseTasksOptions {
  userId?: string
  role?: Role
}

export function useTasks({ userId, role }: UseTasksOptions = {}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('tasks')
        .select('*, task_assignees(profile_id), task_updates(*)')
        .order('created_at', { ascending: false })
        .limit(100)

      // Staff only see tasks assigned to them; admins/directors see everything.
      if (role === 'staff' && userId) {
        query = query.eq('task_assignees.profile_id', userId)
      }

      const { data, error: err } = await query
      if (err) throw err
      setTasks(data ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [userId, role])

  useEffect(() => { void load() }, [load])

  const createTask = async (task: Partial<Task> & { assigneeId?: string }) => {
    const { data, error: err } = await supabase.from('tasks').insert([task]).select().single()
    if (err) { setError(err.message); return null }
    if (task.assigneeId) {
      await supabase.from('task_assignees').insert([{
        task_id: data.id,
        profile_id: task.assigneeId,
        assigned_by: userId,
      }])
    }
    setTasks([data, ...tasks])
    return data
  }

  const updateStatus = async (id: string, status: Task['status'], note?: string) => {
    const { data, error: err } = await supabase
      .from('tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (err) { setError(err.message); return null }
    // record status history
    await supabase.from('task_updates').insert([{ task_id: id, status, progress_note: note }])
    setTasks(tasks.map((t) => (t.id === id ? data : t)))
    return data
  }

  return { tasks, loading, error, createTask, updateStatus, refresh: load }
}
