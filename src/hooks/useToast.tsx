import { createContext, useContext, useCallback, useState, useRef } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  toast: (message: string, options?: { type?: ToastType; duration?: number }) => void
  success: (message: string, options?: { duration?: number }) => void
  error: (message: string, options?: { duration?: number }) => void
  info: (message: string, options?: { duration?: number }) => void
  dismiss: (id: string) => void
  dismissAll: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0
function generateId(): string {
  return `toast-${++nextId}`
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const clearTimer = (id: string) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
  }

  const toast = useCallback(
    (message: string, options: { type?: ToastType; duration?: number } = {}) => {
      const { type = 'info', duration = 5000 } = options
      const item: Toast = { id: generateId(), message, type, duration }
      setToasts((prev) => [...prev, item])
      if (duration > 0) {
        const timer = setTimeout(() => {
          clearTimer(item.id)
          setToasts((prev) => prev.filter((t) => t.id !== item.id))
        }, duration)
        timers.current.set(item.id, timer)
      }
    },
    [],
  )

  const success = useCallback(
    (message: string, options?: { duration?: number }) => toast(message, { type: 'success', ...options }),
    [toast],
  )
  const error = useCallback(
    (message: string, options?: { duration?: number }) => toast(message, { type: 'error', ...options }),
    [toast],
  )
  const info = useCallback(
    (message: string, options?: { duration?: number }) => toast(message, { type: 'info', ...options }),
    [toast],
  )

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id)
      setToasts((prev) => prev.filter((t) => t.id !== id))
    },
    [],
  )
  const dismissAll = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer))
    timers.current.clear()
    setToasts([])
  }, [])

  const value: ToastContextValue = { toasts, toast, success, error, info, dismiss, dismissAll }
  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
