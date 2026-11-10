import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/routes/ProtectedRoute'
import { useAuth } from '@/hooks/useAuth'

const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const AdminDashboardPage = lazy(() => import('@/features/dashboard/AdminDashboardPage'))
const DirectorDashboardPage = lazy(() => import('@/features/dashboard/DirectorDashboardPage'))
const AttendancePage = lazy(() => import('@/features/attendance/AttendancePage'))
const LeavePage = lazy(() => import('@/features/attendance/LeavePage'))
const AttendanceCorrectionsPage = lazy(() => import('@/features/attendance/AttendanceCorrectionsPage'))
const TasksPage = lazy(() => import('@/features/tasks/TasksPage'))
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'))
const ChatPage = lazy(() => import('@/features/chat/ChatPage'))
const AnnouncementsPage = lazy(() => import('@/features/announcements/AnnouncementsPage'))
const DocumentsPage = lazy(() => import('@/features/documents/DocumentsPage'))
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage'))
// const KnowledgeBasePage = lazy(() => import('@/features/knowledge-base/KnowledgeBasePage'))
const ChatbotPage = lazy(() => import('@/features/chatbot/ChatbotPage'))
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'))
const AccountSettingsPage = lazy(() => import('@/features/settings/AccountSettingsPage'))
const StaffPage = lazy(() => import('@/features/admin/StaffPage'))
const AttendanceControlPage = lazy(() => import('@/features/admin/AttendanceControlPage'))
const ApprovalCentrePage = lazy(() => import('@/features/admin/ApprovalCentrePage'))
const AutomationControlCentrePage = lazy(() => import('@/features/admin/AutomationControlCentrePage'))
const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage'))
const ProjectTableBuilderPage = lazy(() => import('@/features/projects/ProjectTableBuilderPage'))
const AnalyticsPage = lazy(() => import('@/features/settings/AnalyticsPage'))
const AuditLogsPage = lazy(() => import('@/features/settings/AuditLogsPage'))
const SystemSettingsPage = lazy(() => import('@/features/settings/SystemSettingsPage'))

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
      // { path: 'knowledge-base', element: <KnowledgeBasePage /> },
      // { path: 'knowledge-assistant', element: <ChatbotPage /> },
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
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'audit-logs', element: <AuditLogsPage /> },
      { path: 'system-settings', element: <SystemSettingsPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
