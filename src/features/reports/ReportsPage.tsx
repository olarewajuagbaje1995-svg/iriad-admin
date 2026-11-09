import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FileText, FileCheck, RefreshCw, Search } from 'lucide-react'
import { useReports } from '@/hooks/useReports'
import { useAuth } from '@/hooks/useAuth'
import { reportSchema, type ReportFormData } from '@/lib/validation'
import { generateReportPDF, type ReportPDFData } from '@/lib/pdf'
import type { Role } from '@/config/brand'

export default function ReportsPage() {
  const [reportType, setReportType] = useState<'weekly' | 'monthly'>('weekly')
  const [searchTerm, setSearchTerm] = useState('')

  const { profile } = useAuth()
  const userId = profile?.id
  const role: Role = (profile?.role as Role) ?? 'staff'

  const { reports, loading, error, createReport, submitReport, refresh } = useReports({ reportType, userId, role })

  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      activities: '',
      tasks: '',
      meetings: '',
      achievements: '',
      challenges: '',
      outstanding: '',
      nextPlan: '',
    },
  })

  const onSubmit = async (data: ReportFormData) => {
    const base: any = {
      activities_carried_out: data.activities,
      tasks_completed: data.tasks,
      meetings_attended: data.meetings ?? '',
      achievements_outcomes: data.achievements ?? '',
      challenges: data.challenges ?? '',
      outstanding_activities: data.outstanding ?? '',
      next_week_plan: data.nextPlan,
    }
    if (reportType === 'monthly') {
      base.reporting_month = new Date().toISOString().slice(0, 8) + '01'
    } else {
      base.reporting_week_start = new Date().toISOString().slice(0, 10)
    }
    await createReport(base)
    form.reset()
  }

  if (loading) return <div className="p-6">Loading reports…</div>

  const label = reportType === 'monthly' ? 'Monthly report' : 'Weekly report'
  const icon = reportType === 'monthly' ? <FileCheck className="w-4 h-4 mr-2" /> : <FileText className="w-4 h-4 mr-2" />
  const periodLabel = reportType === 'monthly' ? 'Month' : 'Week starting'

  const toPDFData = (r: any): ReportPDFData => {
    const period = !(r.reporting_month) ? r.reporting_week_start : r.reporting_month
    return {
      orgName: 'IRIAD',
      reportType: reportType as 'Weekly' | 'Monthly',
      period: period ? new Date(period).toLocaleDateString() : '—',
      staffName: (r.profiles as any)?.full_name ?? 'Staff',
      staffRole: '',
      activities: r.activities_carried_out ?? '',
      tasks: r.tasks_completed ?? '',
      meetings: r.meetings_attended ?? '',
      achievements: r.achievements_outcomes ?? '',
      challenges: r.challenges ?? '',
      outstanding: r.outstanding_activities ?? '',
      nextPlan: r.next_week_plan ?? '',
      status: r.status ?? 'draft',
      submittedAt: r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : '—',
      generatedAt: new Date().toLocaleDateString(),
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">{label}s</h2>
          <p className="text-sm text-neutral-500">Save drafts, submit for review, and track approval status.</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setReportType('weekly')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${reportType === 'weekly' ? 'bg-brand-100 text-brand-700' : 'bg-neutral-100 text-neutral-600 hover:bg-brand-50 text-brand-700'}`}
          >
            Weekly
          </button>
          <button
            onClick={() => setReportType('monthly')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${reportType === 'monthly' ? 'bg-brand-100 text-brand-700' : 'bg-neutral-100 text-neutral-600 hover:bg-brand-50 text-brand-700'}`}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">New {label.toLowerCase()}</h3>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-2">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">Activities carried out</label>
              <textarea
                className="input"
                {...form.register('activities')}
                rows={2}
                placeholder={`What did you do this ${reportType === 'monthly' ? 'month' : 'week'}?`}
              />
              {form.formState.errors.activities && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.activities.message}</p>
              )}
            </div>
            <div className="col-span-2 sm:col-span-2">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">Tasks completed</label>
              <textarea
                className="input"
                {...form.register('tasks')}
                rows={2}
                placeholder="Which tasks did you complete?"
              />
              {form.formState.errors.tasks && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.tasks.message}</p>
              )}
            </div>
            <div className="col-span-2 sm:col-span-2">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">Meetings attended</label>
              <textarea
                className="input"
                {...form.register('meetings')}
                rows={2}
              />
            </div>
            <div className="col-span-2 sm:col-span-2">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">Achievements &amp; outcomes</label>
              <textarea
                className="input"
                {...form.register('achievements')}
                rows={2}
              />
            </div>
            <div className="col-span-2 sm:col-span-2">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">Challenges</label>
              <textarea
                className="input"
                {...form.register('challenges')}
                rows={2}
              />
            </div>
            <div className="col-span-2 sm:col-span-2">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">Outstanding activities</label>
              <textarea
                className="input"
                {...form.register('outstanding')}
                rows={2}
              />
            </div>
            <div className="col-span-2 sm:col-span-2">
              <label className="label block mb-1 text-xs font-medium text-neutral-600 uppercase">{reportType === 'monthly' ? "Next month's plan" : "Next week's plan"}</label>
              <textarea
                className="input"
                {...form.register('nextPlan')}
                rows={2}
              />
              {form.formState.errors.nextPlan && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.nextPlan.message}</p>
              )}
            </div>
          </div>
          <button className="btn-primary" disabled={loading}>
            {icon} {loading ? 'Submitting…' : 'Save as draft'}
          </button>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </form>
      </div>

      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider">My {label.toLowerCase()}s</h3>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-3 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              className="pl-7 input"
              placeholder="Search reports…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn-ghost text-xs" onClick={refresh}>
            <RefreshCw className="w-3 h-3 mr-1" /> Refresh
          </button>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-10 text-neutral-500">No {label.toLowerCase()}s yet.</div>
        ) : (
          <div className="space-y-3">
            {reports
              .filter((r) => {
                const text = searchTerm.toLowerCase()
                const activities = ((r as any).activities_carried_out ?? '').toLowerCase()
                const tasks = ((r as any).tasks_completed ?? '').toLowerCase()
                const period = ((r as any).reporting_week_start || (r as any).reporting_month || '').toLowerCase()
                return activities.includes(text) || tasks.includes(text) || period.includes(text)
              })
              .map((r) => {
                const isWeekly = !(r as any).reporting_month
                const period = isWeekly ? (r as any).reporting_week_start : (r as any).reporting_month
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-neutral-200 bg-white">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-neutral-900">{periodLabel} {period ? new Date(period).toLocaleDateString() : '—'}</div>
                        {(r as any).profiles && (
                          <span className="text-xs text-neutral-500">• {(r as any).profiles.full_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-neutral-500">{`${(r as any).activities_carried_out?.slice(0, 80) ?? ''}`}…</div>
                        {(r as any).profiles?.avatar_url && (
                          <img
                            src={(r as any).profiles.avatar_url}
                            className="w-6 h-6 rounded-full border border-neutral-200"
                            alt="Author avatar"
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(r as any).profiles?.avatar_url && (
                        <img
                          src={(r as any).profiles.avatar_url}
                          className="w-6 h-6 rounded-full border border-neutral-200"
                          alt="Author avatar"
                        />
                      )}
                      <span className={`px-2.5 py-1 rounded text-[10px] font-semibold capitalize ${
                        r.status === 'approved' ? 'bg-green-100 text-green-700' :
                        r.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                        r.status === 'revision_requested' ? 'bg-amber-100 text-amber-700' :
                        r.status === 'draft' ? 'bg-neutral-100 text-neutral-600' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {r.status.replace('_', ' ')}
                      </span>
                      {r.status === 'draft' && (
                        <button onClick={() => submitReport(r.id!)} className="btn-ghost text-xs text-brand-600 hover:text-brand-700">Submit</button>
                      )}
                      <button
                        onClick={() => generateReportPDF(toPDFData(r))}
                        className="btn-ghost text-xs text-neutral-600 hover:text-neutral-800"
                        title="Download PDF"
                      >
                        PDF
                      </button>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
