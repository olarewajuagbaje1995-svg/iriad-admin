import { BarChart } from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <BarChart className="w-5 h-5 text-brand-600" />
          <h2 className="text-2xl font-semibold text-neutral-900">Analytics</h2>
        </div>
        <p className="text-sm text-neutral-500">Organisation-wide performance metrics and reporting insights.</p>
      </div>
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
            <p className="text-xs text-neutral-500 uppercase">Active projects</p>
            <p className="text-2xl font-semibold text-neutral-900">—</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
            <p className="text-xs text-neutral-500 uppercase">Tasks completed</p>
            <p className="text-2xl font-semibold text-neutral-900">—</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
            <p className="text-xs text-neutral-500 uppercase">Chat rooms</p>
            <p className="text-2xl font-semibold text-neutral-900">—</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-neutral-500">Analytics and organisational metrics will appear here.</p>
      </div>
    </div>
  )
}
