# IRIAD Operations Portal — Staff User Guide

**Product:** IRIAD Operations Portal  
**Role:** Staff  
**Audience:** Individual contributors (personal dashboard, own data)  
**Date:** 2026-11-08  
**Prepared by:** Claude Code

---

## 1. About the Staff role

The Staff role is for individual contributors. Staff see a personal dashboard and can only access their own data — their own attendance, tasks, reports, chat, documents, and account settings. Staff cannot view other staff members' data, cannot approve leave or corrections, and cannot access administrative pages.

- **Rank:** 1 (lowest of the three roles: staff < director < admin)
- **Demo account:** `staff@iriad.example` / `staff123` (demo mode only)
- **Dashboard:** Staff Dashboard (personal view)

## 2. What you can do (Staff)

| Feature | Staff can |
|---------|-----------|
| Personal dashboard | ✅ View own attendance, tasks, reports |
| View own attendance / leave | ✅ |
| Check in / check out | ✅ During the 08:00–09:00 (check-in) and 17:00–18:05 (sign-out) windows |
| Request leave | ✅ Submit leave requests for admin approval |
| Request attendance corrections | ✅ Submit correction requests for admin review |
| Create and manage own tasks | ✅ |
| View projects you're a member of | ✅ |
| Submit weekly / monthly reports | ✅ |
| View own reports | ✅ |
| Chat rooms (you're a member of) | ✅ Read and send |
| Announcements | ✅ Read and acknowledge |
| Knowledge Assistant | ✅ Ask questions (when configured) |
| Documents | ✅ Upload and download own documents |
| Calendar | ✅ View |
| Notifications | ✅ View and mark as read |
| Account settings (own profile) | ✅ |
| Change own password/email/avatar | ✅ |
| Change own role | ❌ No one can change their own role |
| View org-wide data | ❌ |
| Approve leave/corrections | ❌ |
| Manage staff accounts | ❌ |
| Access admin pages | ❌ |

## 3. Staff navigation

From the sidebar, Staff have access to:

- Dashboard — your personal overview
- Attendance — check in and check out
- My Tasks — your tasks
- My Projects — projects you're a member of
- Weekly Reports / Monthly Reports — your reports
- Chat Rooms — rooms you're a member of
- Announcements — org announcements
- Knowledge Assistant — AI knowledge chat
- Documents — your documents
- Calendar — events
- Notifications — your notifications
- Account Settings — your profile

Staff do **not** see: Staff, Attendance Control, Approval Centre, Automation Control Centre, Audit Logs, System Settings, or any infrastructure controls.

## 4. Attendance — check in and check out

### Check-in
The check-in window is **08:00–09:00 Africa/Lagos, Monday to Friday**.

1. Go to the **Attendance** page.
2. During the check-in window, click **Check in**.
3. Your check-in is recorded for the current work day.
4. If you check in after 09:00, it is recorded as **late**.

A 15-minute grace period applies to the closing boundary only (late tolerance). It does not extend the 08:00 opening time, and check-in is not available after 09:00.

### Check-out / sign-out
The sign-out window is **17:00–18:05 Africa/Lagos**.

1. Go to the **Attendance** page.
2. During the sign-out window, click **Check out**.
3. Your check-out is recorded for the current work day.

You can only check in / check out once per day (one attendance record per staff member per date, enforced by the database).

> **Note:** The attendance check-in Edge Function has a known timezone bug (it evaluates the window in server-local time rather than Africa/Lagos). This must be fixed before production use. See `docs/IRIAD_FINAL_TEST_REPORT.md`.

## 5. Leave requests

1. Go to **Attendance** (or the Leave page) and submit a leave request (leave type, start date, end date, reason).
2. An Admin or Director reviews and approves or rejects your request.
3. You receive a notification when your leave request is approved or rejected.
4. Approved leave is reflected in your attendance record.

## 6. Attendance corrections

If your attendance record is wrong (for example, you forgot to check in):
1. Submit an attendance correction request (describe the correction and reason).
2. An Admin reviews and approves or rejects it.
3. You receive a notification of the outcome.
4. Approved corrections update your attendance record with an audit trail.

## 7. Tasks

1. Go to **My Tasks** to view your assigned tasks.
2. View task title, description, due date, and status.
3. Update task status as you progress.
4. You receive notifications when a task is assigned to you or when a deadline is approaching/overdue.

## 8. Projects

1. Go to **My Projects** to view projects you're a member of.
2. View project status, milestones, and deliverables.
3. You receive notifications when a project is updated or a milestone is due.

## 9. Weekly and monthly reports

1. Go to **Weekly Reports** or **Monthly Reports**.
2. Draft your report for the current period.
3. Submit it for review.
4. An Admin or Director reviews it and approves it or requests revisions.
5. You receive a notification of the review outcome.

## 10. Chat

1. Go to **Chat Rooms** to see rooms you're a member of.
2. Open a room to read and send messages.
3. You can attach files and react to messages.
4. Messages are delivered in real time (Supabase Realtime).

## 11. Announcements

1. Go to **Announcements** to see organisation-wide announcements.
2. Read announcements relevant to you.
3. Acknowledge announcements you've read.

## 12. Knowledge Assistant

1. Go to **Knowledge Assistant** to ask questions about the organisation's knowledge base.
2. The assistant searches knowledge sources and replies with answers (with citations when available).
3. The knowledge assistant requires n8n and the NVIDIA API to be configured. If not configured, you'll see a "not configured" message.

## 13. Documents

1. Go to **Documents** to view and upload documents.
2. Upload files (up to 10 MB).
3. Download documents via secure signed URLs.
4. Delete your own documents.

## 14. Notifications

1. Go to **Notifications** to see your notifications.
2. Notifications cover attendance, leave, corrections, tasks, reports, announcements, documents, and projects.
3. Mark notifications as read.

## 15. Account settings

1. Go to **Account Settings** to manage your profile.
2. Update your name, email, phone, or avatar.
3. Change your password.

## 16. What Staff cannot do

- View other staff members' attendance, tasks, or reports (RLS enforces your-organisation, your-records only)
- Approve or reject leave or attendance corrections
- Manage staff accounts or roles
- Open or close attendance sessions (admin-controlled)
- Access the Admin or Director dashboard pages
- Access the Automation Control Centre, Audit Logs, or System Settings
- Change your own role

## 17. Demo mode notes

In demo mode (`VITE_DEMO_MODE=true`), sign in with `staff@iriad.example` / `staff123`. The session is stored in `localStorage` and no Supabase connection is used. Demo data never mixes with production data, provided the demo `.env` is not deployed to production.

## 18. Support

If you believe your attendance or task data is incorrect, submit an attendance correction or contact an Admin. Automation errors are reported to admins via the Automation Control Centre (you will not see infrastructure pages).
