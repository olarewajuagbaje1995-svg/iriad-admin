# IRIAD Operations Portal — User Guide

**Audience:** IRIAD staff, staff admins, CEOs, super admins.  
**Status:** UI built; live access requires a configured Supabase instance.

## 1. Signing in

1. Open the portal (Vite dev server or built `dist/`).
2. Enter your email and password on the login page (`/login`).
3. Successful sign-in creates a Supabase session; you're redirected to your role's dashboard.

> Demo login credentials do not exist until a real Supabase Auth user is created and a matching `profiles` row is loaded (see `supabase/seed.sql`).

## 2. Dashboard by role

| Role | Default view |
|------|--------------|
| `staff` | Attendance, tasks, reports, chat |
| `staff_admin` | Staff management, attendance control, approval centre |
| `ceo` | Executive dashboard (org stats) |
| `super_admin` | Full access across organisations |

Use the sidebar to navigate; the topbar shows the date, notifications bell (with unread count), and your profile.

## 3. Attendance

- **Check in:** open Attendance page; click Check In between 08:00–09:00 WAT (Mon–Fri).
- **Check out:** click Check Out during the admin-opened sign-out window (evening).
- The check-in window auto-closes at 09:00; late check-ins trigger a reminder notification.
- Each staff member can check in once per day (unique staff+date constraint).

## 4. Tasks

- Create a task (title, description, assignee, due date, status).
- Update status; every change is recorded in `task_updates` history.
- View your tasks under My Tasks; admins see all tasks.

## 5. Reports

- Draft a weekly report for the current reporting period.
- Submit for review; reviewers can approve or request changes.
- Management receives weekly/monthly reports via email (n8n workflows).

## 6. Chat

- Join or create chat rooms; room membership controls read/send access.
- Messages appear in real time (Supabase Realtime).
- Notifications are created for new messages in rooms you belong to.

## 7. Announcements

- Admins post announcements; all staff receive an in-app notification.
- Announcements are separate from chat.

## 8. Notifications

- Open the Notifications page to see attendance, task, report, chat, and announcement alerts.
- Click a notification to mark it read and (if it has a link) navigate there.
- The topbar bell shows your unread count.

## 9. Documents

- Browse documents; downloads use time-limited signed URLs from private Storage.
- File upload UI is not yet built.

## 10. Knowledge assistant (chatbot)

- Ask a question in the Chatbot page.
- Answers are grounded in your organisation's knowledge base (pgvector + NVIDIA NIM via n8n).
- Requires `NVIDIA_API_KEY` and the `knowledge-chat-agent` n8n workflow to be active.

## 11. Roles summary

- **staff:** own attendance, tasks, reports, chat, notifications.
- **staff_admin:** manage staff, attendance control, approvals.
- **ceo:** executive dashboard, read-all reports.
- **super_admin:** full cross-org administration.

## 12. Need help?

- Contact your staff admin or super admin for access issues.
- For bugs or missing features, see `docs/KNOWN_ISSUES.md`.
