import { FileText } from 'lucide-react'

export default function AuditLogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-brand-600" />
          <h2 className="text-2xl font-semibold text-neutral-900">Audit Logs</h2>
        </div>
        <p className="text-sm text-neutral-500">System activity and change history for compliance and review.</p>
      </div>
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Recent activity</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-neutral-200 text-neutral-500 text-xs uppercase">
                <th className="pb-3">Time</th>
                <th className="pb-3">Actor</th>
                <th className="pb-3">Action</th>
                <th className="pb-3">Target</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-3 text-neutral-600 text-sm">—</td>
                <td className="py-3 text-neutral-600 text-sm">—</td>
                <td className="py-3 text-neutral-600 text-sm">—</td>
                <td className="py-3 text-neutral-600 text-sm">—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-neutral-500">Audit log entries will appear here.</p>
      </div>
    </div>
  )
}
