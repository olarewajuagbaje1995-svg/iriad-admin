# IRIAD Operations Portal — Role and Permission Matrix

**Roles:** `admin` | `director` | `staff`  
**Demo accounts:** `admin@iriad.example`, `director@iriad.example`, `staff@iriad.example`

---

## 1. Role hierarchy

| Role | Rank | Description |
|------|------|-------------|
| `staff` | 1 | Individual contributor; personal dashboard only; own data |
| `director` | 2 | Organisation-wide oversight; same data view as admin |
| `admin` | 3 | Full organisation management; staff CRUD, account settings |

Ranking is defined in `src/lib/permissions.ts` (`ROLE_RANK = { staff: 1, director: 2, admin: 3 }`).

---

## 2. Role-based helper functions

| Function | Returns true when |
|----------|-------------------|
| `isAdmin(role)` | `role === 'admin'` |
| `isDirector(role)` | `role === 'director'` |
| `isAdminOrDirector(role)` | `role === 'admin' \| 'director'` |
| `canManage(role, targetRole)` | `role` is admin/director AND `targetRole` is staff |
| `canManageKnowledgeBase(role)` | `role` is admin or director |
| `canViewOrgWide(role)` | `role` is admin or director |

`canManage` allows admin/director to manage **staff only** — neither can promote/demote to admin or director.

---

## 3. Permission matrix by feature

| Feature | Staff | Director | Admin |
|---------|-------|----------|-------|
| Personal dashboard | ✅ | ✅ | ✅ |
| Organisational (org-wide) dashboard | ❌ | ✅ | ✅ |
| View own attendance / leave | ✅ | ✅ | ✅ |
| Approve/reject leave (org-wide) | ❌ | ✅ | ✅ |
| Manage staff accounts (CRUD) | ❌ | ✅ | ✅ |
| Deactivate/reactivate staff | ❌ | ✅ | ✅ |
| Assign roles (staff only) | ❌ | ✅ | ✅ |
| View audit log | ❌ | ✅ | ✅ |
| Knowledge base: read all_staff | ✅ | ✅ | ✅ |
| Knowledge base: create/manage sources | ❌ | ✅ | ✅ |
| Knowledge base: admin-only sources | ❌ | ✅ | ✅ |
| Account settings (own profile) | ✅ | ✅ | ✅ |
| Change own password/email/avatar | ✅ | ✅ | ✅ |
| Change role (own) | ❌ | ❌ | ❌ |
| Calendar: month/week/agenda | ✅ | ✅ | ✅ |
| Reports (weekly/monthly/automated) | ❌ | ✅ | ✅ |

---

## 4. Demo accounts

| Email | Password | Role | Dashboard |
|-------|----------|------|-----------|
| `admin@iriad.example` | `admin123` | admin | Admin Dashboard (org-wide) |
| `director@iriad.example` | `director123` | director | Director Dashboard (org-wide) |
| `staff@iriad.example` | `staff123` | staff | Staff Dashboard (personal) |

Demo mode is enabled via `VITE_DEMO_MODE=true`. Session persists in `localStorage`.

---

## 5. Navigation by role

**Staff:** Dashboard, Attendance, My Tasks, My Projects, Weekly Reports, Monthly Reports, Chat Rooms, Announcements, Knowledge Assistant, Documents, Calendar, Notifications, Account Settings

**Director:** Dashboard, Staff, Attendance Overview, Project Performance, Task & Deliverable Overview, Reports & Insights, Organisational Calendar, Management Reports, Announcements & Feedback, Knowledge Base, Documents, Calendar & Events, Analytics, Audit Logs, System Settings, Account Settings

**Admin:** Dashboard, Staff, Attendance Control, Tasks, Projects, Weekly Reports, Monthly Reports, Approval Centre, Chat Room Management, Announcements & Feedback, Knowledge Base, Documents, Calendar & Events, Automated Reports, Analytics, Audit Logs, System Settings, Account Settings

Director and Admin see the same organisational data; their navigation labels differ slightly (e.g. "Attendance Overview" vs "Attendance Control").
