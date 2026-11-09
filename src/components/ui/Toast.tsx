import { useToast } from '@/hooks/useToast'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

const ICONS: Record<ToastType, JSX.Element> = {
  success: <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />,
  error: <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />,
  info: <Info className="w-4 h-4 shrink-0 text-blue-600" />,
}

const COLORS: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-100 text-green-700',
  error: 'bg-red-50 border-red-100 text-red-700',
  info: 'bg-blue-50 border-blue-100 text-blue-700',
}

export function Toast() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-auto">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-md border p-4 shadow-lg min-w-[320px] ${COLORS[t.type]}`}
        >
          {ICONS[t.type]}
          <p className="text-sm leading-none">{t.message}</p>
          <button
            onClick={() => dismiss(t.id)}
            className="ml-auto shrink-0 text-neutral-400 hover:text-neutral-700"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}
