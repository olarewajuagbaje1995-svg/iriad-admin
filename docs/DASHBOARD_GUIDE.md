# IRIAD Operations Portal — Dashboard Guide

Three dashboard experiences exist, one per role:

- `admin` → Admin Dashboard (org-wide)
- `director` → Director Dashboard (org-wide, same data as admin)
- `staff` → Staff Dashboard (personal only)

The dashboard route (`/app/dashboard`) renders the role-appropriate page automatically via `RoleDashboard` in `src/routes/AppRoutes.tsx`.

---

## Staff Dashboard (`DashboardPage.tsx`)

Personal overview showing only the current user's data:

- **Stat cards:** Checked in today, Pending leave, Open tasks, Active projects
- **Quick actions:** Check in / Check out, Request leave, Review my tasks
- **Your activity:** Recent activity placeholder (populated once migrations are applied)

Data is scoped to `staff_id = current user` — staff never see organisation-wide aggregates.

---

## Admin Dashboard (`AdminDashboardPage.tsx`)

Organisation-wide command centre:

- **Stat cards:** Active staff, Active projects, Open tasks, Reports
- **Attendance trend:** 7-day check-in line chart
- **Recent activities:** Latest notifications with actor and timestamp
- **Reports & announcements:** Entry point to weekly/monthly reports and org-wide announcements

Accessible only to `admin` and `director` roles (`isAdminOrDirector`).

---

## Director Dashboard (`DirectorDashboardPage.tsx`)

Same data and layout as the Admin Dashboard (org-wide overview). Per the improvement plan, the Director dashboard mirrors the Admin dashboard so directors have full organisational visibility without the staff-management CRUD surface (which is admin-only).

Accessible only to `admin` and `director` roles.

---

## Routing

| Path | Component | Role |
|------|-----------|------|
| `/app/dashboard` | `RoleDashboard` → role-appropriate page | All |
| `/app/dashboard` (admin) | `AdminDashboardPage` | admin |
| `/app/dashboard` (director) | `DirectorDashboardPage` | director |
| `/app/dashboard` (staff) | `DashboardPage` | staff |
