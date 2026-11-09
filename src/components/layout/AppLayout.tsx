import { Suspense, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Menu, LogOut, Bell, Briefcase, Calendar, LayoutDashboard, Clock,
  CheckSquare, FileText, MessageCircle, Book, File, Users, CheckCircle2,
  Settings, BarChart, User, Megaphone,
} from 'lucide-react'
import { brand, NAVIGATION, type Role } from '@/config/brand'
import { formatLagos } from '@/lib/dates'
import { useNotifications } from '@/hooks/useNotifications'
import { useAuth } from '@/hooks/useAuth'

type NavItem = { label: string; path: string | null; icon: JSX.Element }

const ICONS: Record<string, JSX.Element> = {
  Dashboard: <LayoutDashboard className="w-4 h-4" />,
  'Admin Overview': <LayoutDashboard className="w-4 h-4" />,
  Attendance: <Clock className="w-4 h-4" />,
  'Attendance Overview': <Clock className="w-4 h-4" />,
  'Attendance Control': <Clock className="w-4 h-4" />,
  'My Tasks': <CheckSquare className="w-4 h-4" />,
  Tasks: <CheckSquare className="w-4 h-4" />,
  'Task & Deliverable Overview': <CheckSquare className="w-4 h-4" />,
  'My Projects': <Briefcase className="w-4 h-4" />,
  Projects: <Briefcase className="w-4 h-4" />,
  'Project Performance': <Briefcase className="w-4 h-4" />,
  'Weekly Reports': <FileText className="w-4 h-4" />,
  'Monthly Reports': <FileText className="w-4 h-4" />,
  'Automated Reports': <FileText className="w-4 h-4" />,
  'Management Reports': <FileText className="w-4 h-4" />,
  'Chat Rooms': <MessageCircle className="w-4 h-4" />,
  'Chat Room Management': <MessageCircle className="w-4 h-4" />,
  Announcements: <Megaphone className="w-4 h-4" />,
  'Announcements & Feedback': <Megaphone className="w-4 h-4" />,
  'Knowledge Assistant': <Book className="w-4 h-4" />,
  'Knowledge Base': <Book className="w-4 h-4" />,
  Documents: <File className="w-4 h-4" />,
  Calendar: <Calendar className="w-4 h-4" />,
  'Calendar & Events': <Calendar className="w-4 h-4" />,
  'Organisational Calendar': <Calendar className="w-4 h-4" />,
  Notifications: <Bell className="w-4 h-4" />,
  Staff: <Users className="w-4 h-4" />,
  'Approval Centre': <CheckCircle2 className="w-4 h-4" />,
  'My Profile': <User className="w-4 h-4" />,
  'Account Settings': <Settings className="w-4 h-4" />,
  Analytics: <BarChart className="w-4 h-4" />,
  'Audit Logs': <FileText className="w-4 h-4" />,
  'System Settings': <Settings className="w-4 h-4" />,
}

const NAV_PATHS: Record<string, string | null> = {
  Dashboard: '/app/dashboard',
  'Admin Overview': '/app/dashboard',
  Attendance: '/app/attendance',
  'Attendance Overview': '/app/attendance',
  'Attendance Control': '/app/attendance-control',
  'My Tasks': '/app/tasks',
  Tasks: '/app/tasks',
  'Task & Deliverable Overview': '/app/tasks',
  'My Projects': '/app/projects',
  Projects: '/app/projects',
  'Project Performance': '/app/projects',
  'Weekly Reports': '/app/reports',
  'Monthly Reports': '/app/reports',
  'Automated Reports': '/app/reports',
  'Management Reports': '/app/reports',
  'Chat Rooms': '/app/chat',
  'Chat Room Management': '/app/chat',
  Announcements: '/app/announcements',
  'Announcements & Feedback': '/app/announcements',
  'Knowledge Assistant': '/app/knowledge-assistant',
  'Knowledge Base': '/app/knowledge-base',
  Documents: '/app/documents',
  Calendar: '/app/calendar',
  'Calendar & Events': '/app/calendar',
  'Organisational Calendar': '/app/calendar',
  Notifications: '/app/notifications',
  Staff: '/app/staff',
  'Approval Centre': '/app/approval-centre',
  'My Profile': null,
  'Account Settings': '/app/account-settings',
  Analytics: null,
  'Audit Logs': null,
  'System Settings': null,
}

function navItem(label: string): NavItem {
  return {
    label,
    path: NAV_PATHS[label] ?? null,
    icon: ICONS[label] ?? <Briefcase className="w-4 h-4" />,
  }
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const role: Role = (profile?.role as Role) ?? 'staff'
  const navItems = (NAVIGATION[role] ?? NAVIGATION.staff).map(navItem)
  const { notifications } = useNotifications()
  const unreadCount = notifications.filter((n) => !n.is_read).length

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const handleNavClick = (path: string | null) => {
    setSidebarOpen(false)
    if (path) navigate(path)
  }

  return (
    <div className="flex h-screen bg-neutral-50">
      <aside
        className={`fixed inset-0 z-40 bg-white border-r border-neutral-200 transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:hidden`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <img src={brand.logo} alt={brand.shortName} className="h-8" />
          <button onClick={() => setSidebarOpen(false)} className="p-2 text-neutral-500 hover:text-neutral-900" aria-label="Close menu">
            <Menu className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavClick(item.path)}
              disabled={!item.path}
              aria-label={!item.path ? `${item.label} (coming soon)` : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                !item.path
                  ? 'text-neutral-400 opacity-60'
                  : location.pathname === item.path
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              {item.icon} {item.label}
              {!item.path && <span className="ml-auto text-[10px] text-neutral-400">—</span>}
            </button>
          ))}
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      <aside className="hidden lg:flex lg:w-64 flex-col border-r border-neutral-200 bg-white">
        <div className="flex items-center justify-between px-4 py-4 border-b border-neutral-200">
          <img src={brand.logo} alt={brand.shortName} className="h-8" />
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavClick(item.path)}
              disabled={!item.path}
              aria-label={!item.path ? `${item.label} (coming soon)` : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                !item.path
                  ? 'text-neutral-400 opacity-60'
                  : location.pathname === item.path
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              {item.icon} {item.label}
              {!item.path && <span className="ml-auto text-[10px] text-neutral-400">—</span>}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-neutral-200">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="p-2 text-neutral-500 hover:text-neutral-900 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <img src={brand.logo} alt={brand.shortName} className="h-8 hidden lg:block" />
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-sm text-neutral-500">
              <Calendar className="w-3 h-3" /> {formatLagos(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/app/notifications')}
                className="relative p-2 text-neutral-500 hover:text-brand-600"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white text-[10px] flex items-center justify-center">{unreadCount}</span>
                )}
              </button>
              <div className="flex items-center gap-2 pl-2 border-l border-neutral-300">
                <div>
                  <div className="text-sm font-medium text-neutral-900">{profile?.full_name ?? 'Staff User'}</div>
                  <div className="text-xs text-neutral-500 capitalize">{role}</div>
                </div>
                <img className="w-8 h-8 rounded-full border border-neutral-200" src="https://ui-avatars.com/api/?name=User&background=random" alt="avatar" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Suspense fallback={
            <div className="flex h-[400px] items-center justify-center">
              <div className="text-center py-10 text-neutral-500">
                <p>Loading page…</p>
              </div>
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
