import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Role } from '@/config/brand'

interface UseProjectsOptions {
  userId?: string
  role?: Role
}

export function useProjects({ userId, role }: UseProjectsOptions = {}) {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('projects')
        .select('*, project_members(profile_id), profiles!projects_project_lead_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(50)

      // Strict role-based frontend filtering: staff only see projects they lead,
      // created, or are a member of via project_members.
      if (role === 'staff' && userId) {
        query = query.or(`project_lead_id.eq.${userId},created_by.eq.${userId}`)
      }

      const { data, error: err } = await query
      if (err) throw err

      let result = data ?? []

      // For staff, also include projects where they are a member via project_members.
      if (role === 'staff' && userId) {
        const { data: members } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('profile_id', userId)

        const memberProjectIds = (members ?? []).map((m: any) => m.project_id)
        const newMemberProjectIds = memberProjectIds.filter(
          (id: string) => !result.find((p: any) => p.id === id)
        )

        if (newMemberProjectIds.length > 0) {
          const { data: memberProjects } = await supabase
            .from('projects')
            .select('*, project_members(profile_id), profiles!projects_project_lead_id_fkey(full_name)')
            .in('id', newMemberProjectIds)
            .order('created_at', { ascending: false })

          result = [...result, ...(memberProjects ?? [])]
        }
      }

      setProjects(result)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [userId, role])

  useEffect(() => { void load() }, [load])

  const updateProjectStatus = async (id: string, status: string) => {
    try {
      const { error: err } = await supabase
        .from('projects')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (err) throw err
      await load()
    } catch (e: any) {
      setError(e.message)
      throw e
    }
  }

  const createProject = async (project: {
    title: string
    description?: string | null
    start_date?: string | null
    end_date?: string | null
    project_lead_id?: string | null
    status?: string
  }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error: err } = await supabase
      .from('projects')
      .insert([{
        title: project.title,
        description: project.description ?? null,
        start_date: project.start_date ?? null,
        end_date: project.end_date ?? null,
        project_lead_id: project.project_lead_id ?? user.id,
        status: project.status ?? 'planning',
        created_by: user.id,
      }])
      .select()
      .single()
    if (err) { setError(err.message); return null }

    // Ensure the project lead is a member of the project.
    await supabase.from('project_members').insert([{
      project_id: data.id,
      profile_id: project.project_lead_id ?? user.id,
      role: 'lead',
    }])

    await load()
    return data
  }

  const editProject = async (id: string, updates: {
    title?: string
    description?: string | null
    project_lead_id?: string | null
    start_date?: string | null
    end_date?: string | null
    status?: string
  }) => {
    const { error: err } = await supabase
      .from('projects')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (err) { setError(err.message); return null }
    await load()
    return true
  }

  const deleteProject = async (id: string) => {
    const { error: err } = await supabase.from('projects').delete().eq('id', id)
    if (err) { setError(err.message); return false }
    await load()
    return true
  }

  return { projects, loading, error, updateProjectStatus, createProject, editProject, deleteProject, refresh: load }
}
