import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/routes/AppRoutes'
import { ToastProvider } from '@/hooks/useToast'
import { Toast } from '@/components/ui/Toast'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
      <Toast />
    </ToastProvider>
  </StrictMode>
)
