export const brand = {
  organisation: 'Initiative for Research, Innovation, and Advocacy in Development (IRIAD)',
  product: 'IRIAD Operations Portal',
  shortName: 'IRIAD',
  website: 'https://iriadng.org/',
  logo: '/brand/iriad-logo.jpg',
  logoDark: '/brand/iriad-logo.jpg',
  primaryColor: '#0274be',
  secondaryColor: '#21759b',
} as const

export type Role = 'admin' | 'director' | 'staff'

export const ROLES: Role[] = ['admin', 'director', 'staff']

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  director: 'Director',
  staff: 'Staff',
}

export const NAVIGATION: Record<Role, string[]> = {
  staff: [
    'Dashboard',
    'Attendance',
    'My Tasks',
    'My Projects',
    'Weekly Reports',
    'Monthly Reports',
    'Chat Rooms',
    'Announcements',
    'Documents',
    'Calendar',
    'Notifications',
    'Account Settings',
  ],
  admin: [
    'Dashboard',
    'Staff',
    'Attendance Control',
    'Tasks',
    'Projects',
    'Weekly Reports',
    'Monthly Reports',
    'Approval Centre',
    'Chat Room Management',
    'Announcements & Feedback',
    'Documents',
    'Calendar & Events',
    'Automated Reports',
    'Analytics',
    'Audit Logs',
    'System Settings',
    'Account Settings',
  ],
  director: [
    'Dashboard',
    'Staff',
    'Attendance Overview',
    'Project Performance',
    'Task & Deliverable Overview',
    'Reports & Insights',
    'Organisational Calendar',
    'Management Reports',
    'Announcements & Feedback',
    'Documents',
    'Calendar & Events',
    'Analytics',
    'Audit Logs',
    'System Settings',
    'Account Settings',
  ],
}
