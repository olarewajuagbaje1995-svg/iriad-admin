import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus } from 'lucide-react'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const { data } = await supabase
        .from('projects')
        .select('*, project_members(profile_id), profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(50)
      setProjects(data ?? [])
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-6">Loading projects…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Projects</h2>
          <p className="text-sm text-neutral-500">Manage projects, teams, milestones, and deliverables.</p>
        </div>
        <button className="btn-primary" title="New project">
          <Plus className="w-4 h-4 mr-2" /> New project
        </button>
      </div>

      <div className="card p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-neutral-200 text-neutral-500 text-xs uppercase">
                <th className="pb-3">Project</th>
                <th className="pb-3">Lead</th>
                <th className="pb-3">Dates</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Members</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-neutral-500">No projects yet.</td></tr>
              ) : (
                projects.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-3 text-neutral-900">{p.title}</td>
                    <td className="py-3 text-neutral-600 text-sm">{ (p.profiles as any)?.full_name ?? '—' }</td>
                    <td className="py-3 text-neutral-600 text-sm">{p.start_date ?? '—'} → {p.end_date ?? '—'}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        p.status === 'completed' ? 'bg-green-100 text-green-700' :
                        p.status === 'active' ? 'bg-blue-100 text-blue-700' :
                        p.status === 'on_hold' ? 'bg-amber-100 text-amber-700' :
                        'bg-neutral-100 text-neutral-600'
                      }`}>
                        {p.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-neutral-600 text-sm">
                      {(p.project_members as any[])?.length ?? 0} members
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
