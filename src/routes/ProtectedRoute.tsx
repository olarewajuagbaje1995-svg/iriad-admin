import { type ReactNode, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface ProtectedRouteProps {
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const navigate = useNavigate()
  const { profile, loading } = useAuth()

  // Redirect unauthenticated users to login after the initial load settles.
  // Use an effect so we don't navigate during render.
  useEffect(() => {
    if (!loading && !profile) {
      navigate('/login', { replace: true })
    }
  }, [loading, profile, navigate])

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        <p className="text-sm text-neutral-500">Signing in…</p>
      </div>
    </div>
  )
  if (!profile) return null
  return <>{children}</>
}
