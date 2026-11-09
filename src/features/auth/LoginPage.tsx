import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ShieldCheck, Lock } from 'lucide-react'
import { PasswordInput } from '@/components/ui/PasswordInput'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { demoMode, signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email, password)
    setLoading(false)
    if (err) {
      setError(err)
      return
    }
    navigate('/app/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="/brand/iriad-logo.jpg" alt="IRIAD" className="h-12" />
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-neutral-900">{'IRIAD Operations Portal'}</h1>
            <p className="text-sm text-neutral-500">Staff sign-in</p>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          {demoMode && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
              Demo mode active — signing in without Supabase. Email and password only.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <PasswordInput
                value={password}
                onChange={(value) => setPassword(value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="border-t border-neutral-200 pt-5 flex items-center gap-2">
            <span className="text-xs text-neutral-500 flex-1"></span>
            <div className="text-xs text-neutral-500 flex items-center gap-2">
              <Lock className="w-3 h-3" /> {demoMode ? 'Demo auth (localStorage)' : 'Supabase Auth'}
            </div>
            <span className="text-xs text-neutral-500 flex-1"></span>
          </div>

          <details className="text-left space-y-1">
            <summary className="text-xs text-neutral-400 underline cursor-pointer">
              Demo accounts (email / password)
            </summary>
            <ul className="text-xs text-neutral-500 pl-4 space-y-1">
              <li>
                <span className="font-medium">admin@iriad.example</span> / admin123 (Admin)
              </li>
              <li>
                <span className="font-medium">director@iriad.example</span> / director123 (Director)
              </li>
              <li>
                <span className="font-medium">staff@iriad.example</span> / staff123 (Staff)
              </li>
            </ul>
          </details>

          {!demoMode && (
            <p className="text-center text-xs text-neutral-500">
              Need access? Contact your organisation administrator.
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center gap-2 text-sm text-neutral-600">
          <ShieldCheck className="w-4 h-4" /> RLScan &nbsp;|&nbsp; Supabase Auth
        </div>
      </div>
    </div>
  )
}
