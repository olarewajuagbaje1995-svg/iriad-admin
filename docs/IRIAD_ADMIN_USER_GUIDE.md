# IRIAD Operations Portal — Admin User Guide

**Product:** IRIAD Operations Portal  
**Role:** Admin  
**Audience:** Organisation administrators (full organisation management)  
**Date:** 2026-11-08  
**Prepared by:** Claude Code

---

## 1. About the Admin role

The Admin role has the highest level of access within an organisation. Admins can manage staff accounts, control attendance, approve leave and attendance corrections, review reports, access system settings and audit logs, and use the Automation Control Centre.

- **Rank:** 3 (highest of the three roles: staff < director < admin)
- **Demo account:** `admin@iriad.example` / `admin123` (demo mode only)
- **Dashboard:** Admin Dashboard (organisation-wide view)

## 2. What you can do (Admin)

| Feature | Admin can |
|---------|-----------|
| Personal dashboard | ✅ View own data |
| Organisation-wide dashboard | ✅ View all staff/org data |
| View own attendance / leave | ✅ |
| Approve/reject leave (org-wide) | ✅ |
| Manage staff accounts (CRUD) | ✅ Create, edit, deactivate/reactivate staff |
| Assign roles | ✅ Assign `staff` role only; cannot promote to admin/director |
| View audit log | ✅ |
| Knowledge base: read all sources | ✅ |
| Knowledge base: create/manage sources | ✅ |
| Knowledge base: admin-only sources | ✅ |
| Account settings (own profile) | ✅ |
| Change own password/email/avatar | ✅ |
| Change own role | ❌ No one can change their own role |
| Attendance control | ✅ Open/close attendance sessions |
| Approval centre | ✅ Review and approve/revise weekly & monthly reports |
| Automation Control Centre | ✅ View engine health, execution stats, failover controls |
| System settings | ✅ Manage organisation-wide settings |
| Reports (weekly/monthly/automated) | ✅ View and manage all org reports |

Admins and Directors see the same organisational data. The Admin navigation includes "Attendance Control" and "Automated Reports" with infrastructure-level labels, while Director uses "Attendance Overview" and "Management Reports".

## 3. Admin navigation

From the sidebar, Admins have access to:

- Dashboard
- Staff — manage staff accounts and roles
- Attendance Control — open/close attendance sessions, manage the check-in window
- Tasks — view and manage all tasks
- Projects — view and manage all projects
- Weekly Reports / Monthly Reports — view all org reports
- Approval Centre — review and approve/revise submitted reports
- Chat Room Management — manage chat rooms
- Announcements & Feedback — create and manage announcements
- Knowledge Base — create/manage knowledge sources (incl. admin-only)
- Documents — view and manage all org documents
- Calendar & Events — view organisational calendar
- Automated Reports — configure and view automated reports
- Analytics — view org-wide charts
- Audit Logs — view the audit trail of administrative actions
- System Settings — manage organisation settings
- Account Settings — manage own profile

**Staff never see** the Staff, Attendance Control, Approval Centre, Automation Control Centre, Audit Logs, or System Settings pages. These are hidden from staff navigation and guarded by role + RLS.

## 4. Staff management

On the **Staff** page, Admins can:
- View all staff members in the organisation
- Create new staff accounts
- Edit staff details (name, email, department, role)
- Activate or deactivate staff accounts
- Assign the `staff` role only — Admins cannot promote anyone to Admin or Director, and cannot demote themselves

## 5. Attendance control

On the **Attendance Control** page, Admins can:
- Open the attendance session for the work day (enables the 08:00–09:00 check-in window)
- Close the attendance session (check-in window closes at 09:00 Africa/Lagos)
- View attendance records for all staff
- Manage attendance corrections (approve/reject requests)

The check-in window is enforced on the server by the `attendance-checkin` Edge Function (08:00–09:00 Africa/Lagos, Monday–Friday). Check-ins after 09:00 are recorded as late.

> **Note:** The attendance check-in Edge Function has a known timezone bug (it evaluates the window in server-local time rather than Africa/Lagos). This must be fixed before production use. See `docs/IRIAD_FINAL_TEST_REPORT.md`.

## 6. Approval Centre

On the **Approval Centre**, Admins can:
- Review submitted weekly and monthly reports
- Approve or request revisions on reports
- View report status (draft, submitted, under review, approved)

## 7. Automation Control Centre

On the **Automation Control Centre** page (Admin + Director only), Admins can:
- View engine health: n8n status, native backup engine status, last health check, current execution mode
- View execution statistics: successful/failed/pending/running/uncertain jobs
- View workflow monitoring: last execution, status, retry count, recent errors
- Enable/disable automatic failover between n8n and the native backup engine
- Manually select the preferred execution mode
- Inspect failed jobs and retry eligible jobs
- View recovery history

Every Control Centre action is audited to the `activity_logs` table.

> **Note:** The Automation Control Centre depends on the dual-automation engine migrations (011/012) which are **not yet applied**. The page exists in the UI but cannot operate against live automation tables until those migrations are applied and approved.

## 8. System settings

On the **System Settings** page, Admins can:
- Manage organisation-wide configuration (key/value settings)
- Configure reporting deadlines (`report_weekly_deadline`, `report_monthly_deadline`)
- Manage automation configuration (when the dual-engine migrations are applied)

## 9. Audit logs

On the **Audit Logs** page, Admins can view the trail of administrative actions recorded in `activity_logs` (actor, action, target, timestamp, metadata). Every Control Centre action, leave approval, correction approval, and report approval is logged.

## 10. Knowledge base

Admins can:
- Read all knowledge sources (including admin-only sources)
- Create and manage knowledge sources (text, URL, FAQ, file upload)
- Set audience/role visibility on sources

## 11. What Admins cannot do

- Change their own role
- Promote a staff member to Admin or Director (staff can only be assigned the `staff` role)
- Access another organisation's data (RLS enforces organisation scoping)
- Use production credentials stored in `.env` (these are server-side only and never exposed to the frontend)

## 12. Demo mode notes

In demo mode (`VITE_DEMO_MODE=true`), sign in with `admin@iriad.example` / `admin123`. The session is stored in `localStorage` and no Supabase connection is used. Demo data never mixes with production data, provided the demo `.env` is not deployed to production.

## 13. Support

If you encounter an error, check the Audit Logs and Automation Control Centre for recent failures. Automation errors are also sent to the configured admin email (when n8n and Gmail are configured).
