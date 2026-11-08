# IRIAD Operations Portal — System Architecture

**Product:** IRIAD Operations Portal  
**Organisation:** Initiative for Research, Innovation, and Advocacy in Development (IRIAD)  
**Repository:** `C:\dev\IRIAD`  
**Commit:** `289114c`  
**Date:** 2026-11-08  
**Prepared by:** Claude Code

---

## 1. Purpose

An internal operations platform for IRIAD staff to manage attendance, tasks, reports, projects, documents, announcements, chat, and a knowledge-base assistant. It is organisation-scoped (multi-tenant by `organisation_id`) with role-based access control (RBAC) enforced by Supabase Row Level Security (RLS).

---

## 2. Architecture diagram

```
browser (React SPA)
   │ HTTPS
   ▼
Supabase (PostgreSQL + Auth + Realtime + Storage)
   ├─ RLS policies on every table (organisation_id tenant scoping)
   ├─ Realtime channels for chat & notifications
   └─ signed URLs for private document downloads
   │ webhooks / HTTP
   ▼
n8n (scheduled + webhook workflows; AI Agent for RAG chat)
   │ NVIDIA API (embeddings + LLM)
   ▼
NVIDIA NIM

Native backup engine (Edge Functions):
  automation-health-check, automation-dispatcher,
  automation-attendance-*, automation-staff-checkin/checkout,
  automation-*-report, automation-*-notifications, automation-*-chat,
  automation-knowledge-ingestion, automation-error-alert,
  automation-missed-schedule-recovery, automation-lease-reaper,
  automation-uncertain-reconciliation, automation-n8n-*
```

## 3. Tech stack

| Layer | Choice |
|-------|--------|
| Framework | React 18 + TypeScript + Vite 5 |
| Styling | Tailwind CSS + design system (`src/styles/theme.css`) |
| Routing | React Router 6 |
| Forms | react-hook-form + zod |
| Backend / BaaS | Supabase (Auth, PostgreSQL, Realtime, Storage) |
| Vector / RAG | pgvector (`vector(1536)`) on `knowledge_chunks` |
| Charts | recharts |
| Icons | lucide-react |
| AI provider | NVIDIA NIM via n8n AI Agent node |
| Workflows | n8n (master workflow + error handler) |
| Edge Functions | Deno + `@supabase/supabase-js` (25 functions) |
| Tests | vitest |

---

## 4. Core domains

| Domain | Description |
|--------|-------------|
| Authentication & profiles | Supabase Auth; `profiles` linked to `auth.users`; roles `staff`/`director`/`admin` (frontend), `super_admin`/`staff_admin`/`ceo`/`staff` (database, pending alignment) |
| Attendance | Morning check-in window (8–9 AM Africa/Lagos, Mon–Fri), admin-controlled evening sign-out (17:00–18:05), DB-enforced windows, unique staff+date constraint |
| Tasks & projects | CRUD, status history (`task_updates`), project members, milestones, custom tables, deliverables, reviews |
| Reports | Weekly/monthly drafts and submits, review workflow, management reports; deadlines in `report_schedules` / `system_settings` |
| Communication | Chat rooms/membership/messages (Realtime), announcements, in-app notifications |
| Documents | Private Storage bucket `documents`, 10 MB limit, signed URL download, delete |
| Knowledge base / RAG | Collections, sources, chunks with pgvector embeddings, ingestion jobs, chatbot conversations/messages/feedback |
| Email reports | Daily 9 AM snapshot, weekly/monthly management emails via n8n Gmail nodes |

---

## 5. Roles and permissions

Three frontend roles, defined in `src/config/brand.ts` (`Role = 'admin' | 'director' | 'staff'`) and `src/lib/permissions.ts`:

| Role | Rank | Description |
|------|------|-------------|
| `staff` | 1 | Individual contributor; personal dashboard only; own data |
| `director` | 2 | Organisation-wide oversight; same data view as admin |
| `admin` | 3 | Full organisation management; staff CRUD, account settings |

Helper functions (`src/lib/permissions.ts`): `isAdmin`, `isDirector`, `isAdminOrDirector`, `canManage` (admin/director can manage staff only), `canManageKnowledgeBase`, `canViewOrgWide`, `getOrgId`, `roleRank`.

Demo accounts (demo mode via `VITE_DEMO_MODE=true`): `admin@iriad.example`, `director@iriad.example`, `staff@iriad.example`.

**Database role mismatch (planned fix):** Migration 001 check constraint allows `super_admin`, `staff_admin`, `ceo`, `staff`; frontend uses `admin`, `director`, `staff`. A planned role-alignment migration (`011_role_alignment`) maps `super_admin`/`staff_admin` → `admin`, `ceo` → `director`. Not yet applied. Several automation Edge Functions still reference `super_admin`/`staff_admin` directly.

---

## 6. Authentication

### 6.1 Real (production) mode — `VITE_DEMO_MODE=false` or unset

- Supabase Auth (`src/hooks/useAuth.ts`)
- `signInWithPassword` email/password
- Session persisted via Supabase client (cookie/localStorage)
- `ProtectedRoute` redirects unauthenticated users to `/login`
- Profile loaded from `profiles` table by `auth.uid()`

### 6.2 Demo mode — `VITE_DEMO_MODE=true`

- `src/lib/demoAuth.ts`: email/password only, independent of Supabase
- Session persisted in `localStorage`
- Demo accounts: `admin@iriad.example` / `admin123`, `director@iriad.example` / `director123`, `staff@iriad.example` / `staff123`
- No Supabase connection required

Demo data (`localStorage`) and production data (Supabase) never mix, provided the local `.env` with `VITE_DEMO_MODE=true` is never deployed to production. `.env` is gitignored.

---

## 7. Authorization (RLS and server-side)

### 7.1 Row Level Security

RLS is enabled on every table (~101 policies across migrations 001–010). Every org-scoped table carries `organisation_id`. Policies restrict reads/writes to the authenticated user's own organisation.

Example (migration 001, `profiles`):
- `profiles_select_own`: select within own organisation
- `profiles_manage_admin`: all operations for `super_admin`/`staff_admin` within own organisation

### 7.2 Server-side authorization

- Edge Functions use the Supabase service-role key (`SUPABASE_SECRET_KEY`) — bypasses RLS, trusted server code only.
- `attendance-checkin` (user-facing) verifies the user JWT via `auth.getUser()` and forwards the user's Authorization header so RLS applies. It enforces organisation scoping via the authenticated user's profile.
- The 24 `automation-*` functions are cron/dispatcher-invoked infrastructure; they use the service-role key directly and do **not** perform per-user auth. They must only be reachable via the internal scheduler / service-role key.

### 7.3 Automation tables (planned migration 012)

`automation_engines`, `automation_jobs`, `automation_executions`, `automation_idempotency`, `automation_recoveries`, `automation_config` — RLS enabled, organisation-scoped, manage policies restricted to `admin`/`director` roles. Staff are excluded from infrastructure controls (RLS + route guard + navigation).

---

## 8. Storage and signed URLs

- Migration 006 creates the private `documents` Storage bucket.
- Files uploaded to Supabase Storage; downloads served via signed URLs (time-limited, private).
- 10 MB upload limit.
- Knowledge-base files share the `documents` bucket under a `knowledge/` prefix (no separate `knowledge` bucket).

---

## 9. Automation engines (dual-engine architecture)

### 9.1 n8n — primary engine (permanent, unchanged)

- `n8n/IRIAD_MASTER_WORKFLOW.json`: 92 nodes, 62 connections, 8 independent sections, each with its own trigger (a failure in one section does not cascade).
- All schedule triggers use `Africa/Lagos`.
- 3 webhooks with `x-webhook-secret` validation: `/webhook/announcement`, `/webhook/knowledge-ingest`, `/webhook/knowledge-chat`.
- 9 Gmail nodes for email delivery. Resend fully removed.
- `n8n/IRIAD_ERROR_HANDLER.json`: 6 nodes, error trigger → deduplicate → log to `automation_runs` → Gmail alert → in-app notification.
- Imported inactive (`"active": false`); not activated without live credentials and authorisation.

### 9.2 Native backup engine — Edge Functions (Phase 3)

24 `automation-*` Edge Functions plus `attendance-checkin`. Implements the 16 business operations directly against PostgreSQL when n8n is unhealthy. Each function:
- Uses the service-role key (server-side only)
- Guards on `automation_idempotency[idempotency_key]` (idempotent)
- Wraps logic in try/catch; logs errors to `console.error`
- Most write to `automation_runs`

**Important:** The native backup engine depends on migration 012 tables (`automation_jobs`, `automation_idempotency`, `automation_engines`, `claim_automation_job()`), which are **not yet applied**. The engine cannot run until those migrations are created, reviewed, and applied.

### 9.3 Failover

Health check (`automation-health-check`) pings n8n every minute and updates `automation_engines.status`. After `N8N_FAILURE_THRESHOLD` consecutive failures (default 3), n8n is marked `unhealthy` and the dispatcher routes jobs to the native backup engine (`iriad-native`). When n8n recovers, primary mode resumes for new jobs; completed/uncertain operations are not replayed.

Failover scenarios (from `docs/DUAL_AUTOMATION_ARCHITECTURE.md` §6):
- **A** n8n healthy → jobs dispatched to n8n
- **B** n8n unavailable → failover to native engine
- **C** individual n8n workflow failure → transfer to backup, recovery recorded
- **D** n8n timeout → job marked `Uncertain`, reconciled, no duplicate execution
- **E** n8n recovery → primary resumes for new jobs

---

## 10. Idempotency and duplicate prevention

Both engines share one `idempotency_key` per business operation (e.g. `attendance-open-<org-id>-2026-11-09`, `weekly-report-<org-id>-W45`). Unique constraint on `automation_jobs.idempotency_key` and primary key on `automation_idempotency.idempotency_key` prevent duplicate registration at the database layer.

Atomic job claiming via `claim_automation_job()` uses `FOR UPDATE SKIP LOCKED` so concurrent dispatcher instances claim different jobs. Execution leases (10 minutes) bound how long an engine can hold a job; expired leases → `Uncertain` for reconciliation rather than silent re-dispatch.

Before any business effect, the engine checks `automation_idempotency`: if `completed`, the effect is skipped entirely. External operations (email) are recorded in `email_logs` with `provider_message_id` before the provider call; on timeout the job is `Uncertain` (never blindly retried).

---

## 11. The 16 business operations

| # | Business operation | Primary implementation | Backup |
|---|-------------------|------------------------|--------|
| 1 | Attendance opening (~08:00 Mon–Fri) | n8n Section 1 | `automation-attendance-open` |
| 2 | Automatic attendance closure (09:00) | n8n Section 1 close branch | `automation-attendance-close` |
| 3 | Staff check-in / check-out | Edge `attendance-checkin` + n8n sign-out window | `automation-staff-checkin` / `-checkout` |
| 4 | Daily attendance reporting | n8n Section 1 close branch | `automation-daily-attendance-report` |
| 5 | Weekly reporting | n8n Sections 3 & 4 | `automation-weekly-report` |
| 6 | Monthly reporting | n8n Sections 3 & 4 | `automation-monthly-report` |
| 7 | Leave request notifications | UI flow only (no n8n today) | `automation-leave-notifications` |
| 8 | Attendance correction notifications | UI flow only (no n8n today) | `automation-correction-notifications` |
| 9 | Task assignment notifications | n8n Section 2 | `automation-task-reminders` |
| 10 | Task deadline reminders | n8n Section 2 | `automation-task-reminders` |
| 11 | Announcement notifications | n8n Section 5 webhook | `automation-announcement-notification` |
| 12 | Document upload notifications | Partially (UI) | `automation-document-notifications` |
| 13 | Project & task status notifications | Partially (n8n Section 2) | `automation-project-notifications` |
| 14 | AI knowledge assistant | n8n Section 7 webhook → NVIDIA | `automation-knowledge-chat` (fallback) |
| 15 | Knowledge-base ingestion | n8n Section 6 webhook | `automation-knowledge-ingestion` |
| 16 | Automation error monitoring & alerts | n8n Section 8 + Error Handler | `automation-error-alert` |

Operations 7, 8, and 12 exist as UI flows today but have no automated n8n equivalent; the native backup engine implements them as new equivalent operations.

**Count verified:** 16 business operations. This is consistent across `docs/DUAL_AUTOMATION_INVENTORY.md` §3 and the `automation_jobs.business_operation` check constraint in `docs/DUAL_AUTOMATION_ARCHITECTURE.md` §3.1. Any reference to "15" is a section-number reference, not a business-operation count.

---

## 12. Schedules and timezone

All business schedules use `Africa/Lagos`:
- Attendance check-in window: 08:00–09:00, Mon–Fri (`attendance_policy.morning_open_time` / `morning_close_time`)
- 15-minute grace period applies only to the closing boundary (late tolerance); it does not extend the 08:00 opening window
- Sign-out window: 17:00–18:05
- Working days: Mon–Fri (`working_days = '{1,2,3,4,5}'`); `working_calendar` holds holidays
- Weekly report: Friday 16:00; Monthly report: last day of month 17:00

**Known defect:** Several Edge Functions evaluate these windows using UTC `new Date()` / `getUTCDay()` / `toISOString()` instead of converting to Africa/Lagos first. This shifts attendance windows and report dates. Must be fixed before production (see `docs/IRIAD_FINAL_TEST_REPORT.md`).

---

## 13. Data flow (summary)

1. Browser (React SPA) → Supabase via HTTPS (RLS-enforced, organisation-scoped).
2. Supabase Realtime → chat and notification updates pushed to clients.
3. Supabase Storage → signed URLs for private document downloads.
4. n8n (scheduled triggers + webhooks) → executes existing business workflows unchanged; logs to `automation_runs`.
5. n8n → NVIDIA NIM for knowledge embeddings and AI chat.
6. Native backup Edge Functions → direct PostgreSQL execution when n8n is unhealthy; coordinated by `automation-dispatcher` and `automation-health-check`.
7. Frontend → n8n webhooks (announcement, knowledge-ingest, knowledge-chat) with Bearer auth or `x-webhook-secret`.

---

## 14. What happens when n8n becomes unavailable

1. `automation-health-check` ping fails repeatedly → `automation_engines` n8n status = `unhealthy`.
2. `automation-dispatcher` claims due jobs with `current_engine = 'iriad-native'`.
3. Native Edge Functions execute equivalent business operations directly against PostgreSQL (attendance open/close, reports, notifications, etc.).
4. Results recorded; administrators notified via `notifications` (+ fallback email if configured).
5. Jobs dispatched to n8n while it was down are reconciled by `automation-uncertain-reconciliation` when n8n returns: confirmed completed → `Completed`; confirmed failed → `Failed`/retry; inconclusive → native backup may execute only when duplicate business execution is safely prevented (idempotency key free and no business side-effect found).
6. When n8n recovers, primary mode resumes for **new** eligible jobs; completed/uncertain operations are not replayed. Backup execution history is preserved for audit.
