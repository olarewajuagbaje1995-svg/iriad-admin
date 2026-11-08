import { createBrowserRouter } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/routes/ProtectedRoute'
import LoginPage from '@/features/auth/LoginPage'
import DashboardPage from '@/features/dashboard/DashboardPage'
import AdminDashboardPage from '@/features/dashboard/AdminDashboardPage'
import DirectorDashboardPage from '@/features/dashboard/DirectorDashboardPage'
import AttendancePage from '@/features/attendance/AttendancePage'
import LeavePage from '@/features/attendance/LeavePage'
import TasksPage from '@/features/tasks/TasksPage'
import ReportsPage from '@/features/reports/ReportsPage'
import ChatPage from '@/features/chat/ChatPage'
import AnnouncementsPage from '@/features/announcements/AnnouncementsPage'
import DocumentsPage from '@/features/documents/DocumentsPage'
import CalendarPage from '@/features/calendar/CalendarPage'
import KnowledgeBasePage from '@/features/knowledge-base/KnowledgeBasePage'
import ChatbotPage from '@/features/chatbot/ChatbotPage'
import NotificationsPage from '@/features/notifications/NotificationsPage'
import AccountSettingsPage from '@/features/settings/AccountSettingsPage'
import StaffPage from '@/features/admin/StaffPage'
import AttendanceControlPage from '@/features/admin/AttendanceControlPage'
import ApprovalCentrePage from '@/features/admin/ApprovalCentrePage'
import AutomationControlCentrePage from '@/features/admin/AutomationControlCentrePage'
import AttendanceCorrectionsPage from '@/features/attendance/AttendanceCorrectionsPage'
import ProjectsPage from '@/features/projects/ProjectsPage'
import ProjectTableBuilderPage from '@/features/projects/ProjectTableBuilderPage'
import { useAuth } from '@/hooks/useAuth'

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-2xl font-semibold text-neutral-900">Page not found</h2>
      <p className="text-neutral-500">The page you're looking for doesn't exist.</p>
    </div>
  )
}

/** Renders the role-appropriate dashboard: org-wide for admin/director, personal for staff. */
function RoleDashboard() {
  const { profile } = useAuth()
  const role = (profile?.role as string | null) ?? 'staff'
  if (role === 'admin') return <AdminDashboardPage />
  if (role === 'director') return <DirectorDashboardPage />
  return <DashboardPage />
}

export const router = createBrowserRouter([
  { path: '/', element: <LoginPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/app',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <RoleDashboard /> },
      { path: 'dashboard', element: <RoleDashboard /> },
      { path: 'attendance', element: <AttendancePage /> },
      { path: 'leave', element: <LeavePage /> },
{ path: 'attendance-corrections', element: <AttendanceCorrectionsPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'my-tasks', element: <TasksPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'weekly-reports', element: <ReportsPage /> },
      { path: 'monthly-reports', element: <ReportsPage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'chat-rooms', element: <ChatPage /> },
      { path: 'announcements', element: <AnnouncementsPage /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'knowledge-base', element: <KnowledgeBasePage /> },
      { path: 'knowledge-assistant', element: <ChatbotPage /> },
      { path: 'chatbot', element: <ChatbotPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'account-settings', element: <AccountSettingsPage /> },
      { path: 'staff', element: <StaffPage /> },
      { path: 'attendance-control', element: <AttendanceControlPage /> },
      { path: 'approval-centre', element: <ApprovalCentrePage /> },
      { path: 'automation-control-centre', element: <AutomationControlCentrePage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'my-projects', element: <ProjectsPage /> },
      { path: 'project-tables', element: <ProjectTableBuilderPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
