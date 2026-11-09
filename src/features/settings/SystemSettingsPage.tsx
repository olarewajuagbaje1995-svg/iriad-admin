import { Settings } from 'lucide-react'

export default function SystemSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-brand-600" />
          <h2 className="text-2xl font-semibold text-neutral-900">System Settings</h2>
        </div>
        <p className="text-sm text-neutral-500">Organisation-wide configuration and system preferences.</p>
      </div>
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white">
            <div>
              <div className="text-sm font-medium text-neutral-900">Organisation name</div>
              <div className="text-xs text-neutral-500">IRIAD Operations Portal</div>
            </div>
            <span className="text-xs text-neutral-400">Read only</span>
          </div>
        </div>
        <p className="mt-4 text-sm text-neutral-500">System configuration options will be available here.</p>
      </div>
    </div>
  )
}
