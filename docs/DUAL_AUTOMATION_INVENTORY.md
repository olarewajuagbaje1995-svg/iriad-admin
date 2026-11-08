# IRIAD — Dual Automation Engine: Automation Inventory

**Phase 1 deliverable** (per the Dual Automation Engine brief, §11 Phase 1).
**Status:** Inspection only — no application, database, migration, workflow, or production data has been changed by this document.

This inventory records the existing IRIAD Operations Portal automation as it stands today, so the dual-engine architecture (Phase 2) can be designed against the real system rather than assumptions.

---

## 1. Application overview

| Item | Detail |
|------|--------|
| Product | IRIAD Operations Portal |
| Organisation | Initiative for Research, Innovation, and Advocacy in Development (IRIAD) |
| Frontend | React 18 + TypeScript + Vite 5 + Tailwind CSS (`src/`) |
| Backend / BaaS | Supabase: Auth, PostgreSQL, Realtime, Storage |
| Migrations | `supabase/migrations/001`–`010.sql` (+ `supabase/seed.sql`, labelled demo data) |
| Workflows | n8n: `n8n/IRIAD_MASTER_WORKFLOW.json`, `n8n/IRIAD_ERROR_HANDLER.json`, 11 archived legacy files in `n8n/workflows/archived/` |
| Edge Functions | `supabase/functions/attendance-checkin/index.ts` (server-side check-in window enforcement) |
| Orchestrator today | n8n only. No native backup engine, no central job registry, no Supabase Cron jobs. |
| Roles (frontend) | `staff` | `director` | `admin` (`src/config/brand.ts`, `src/lib/permissions.ts`) |
| Roles (database) | `super_admin`, `staff_admin`, `ceo`, `staff` (migration 001 check constraint) |
| Tenant scoping | Every org-scoped table carries `organisation_id`; RLS enabled on all tables (~101 policies) |
| Organisational timezone | `Africa/Lagos` (organisations.timezone, seed, attendance policy) |
| Seed organisation | `00000000-0000-0000-0000-000000000001` — IRIAD, slug `iriad` |

Navigation exists for staff / director / admin; staff navigation contains no infrastructure controls (see `src/config/brand.ts` `NAVIGATION`). Role helpers: `isAdmin`, `isDirector`, `isAdminOrDirector`, `canManage`, `canManageKnowledgeBase`, `canViewOrgWide`.

Demo accounts (demo mode via `VITE_DEMO_MODE`): `admin@iriad.example`, `director@iriad.example`, `staff@iriad.example`.

---

## 2. Existing n8n automation inventory

### 2.1 Master workflow — `n8n/IRIAD_MASTER_WORKFLOW.json`

- 92 nodes, 62 connections, all static validation checks passed (294 PASS, 0 FAIL, 0 WARN — see `n8n/WORKFLOW_AUDIT.md`).
- Imported inactive (`"active": false`); must not be activated without live credentials and user authorisation.
- 8 independent sections, each with its own trigger node — a failure in one section does not cascade.
- Timezone: `Africa/Lagos` on all schedule triggers.
- No hardcoded secrets or organisation UUID; all via `$env.*` (`N8N_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NVIDIA_API_KEY`, `ADMIN_EMAIL`, `IRIAD_ORGANISATION_ID`, `SUPABASE_URL`).
- Supabase accessed via HTTP Request REST calls using the service role key (97 HTTP Request nodes, 0 Supabase nodes).
- Error handling delegated to `n8n/IRIAD_ERROR_HANDLER.json` via `settings.errorWorkflowId = "iriad-error-handler"`.
- 3 webhook endpoints, each validated with `x-webhook-secret` header: `/webhook/announcement`, `/webhook/knowledge-ingest`, `/webhook/knowledge-chat`.
- Email delivery: native n8n Gmail nodes (13 in master + 1 in error handler); Resend fully removed from the project.

| Section | Trigger(s) (Africa/Lagos) | Primary business action | Key DB objects touched |
|---------|---------------------------|-------------------------|------------------------|
| 1 — Attendance Automation | 08:00 open check-in (Mon–Fri); 09:00 close check-in + daily report (Mon–Fri); 17:00 open sign-out; 18:05 close sign-out (every-5-min sign-out window branch) | Open/close check-in & sign-out windows, remind missing check-ins/sign-outs, daily attendance snapshot | `attendance_sessions`, `attendance`, `notifications`, `generated_reports`, `email_logs`, `automation_runs`, `profiles`, `working_calendar`, `attendance_policy` |
| 2 — Daily Notifications & Reminders | 09:00 Mon–Fri | Overdue task reminders, upcoming event reminders | `tasks`, `task_assignees`, `calendar_events`, `notifications`, `profiles` |
| 3 — Weekly & Monthly Reports | Friday 16:00 weekly; last day of month 17:00 monthly | Generate weekly/monthly reports with idempotency key, notify | `weekly_reports`, `monthly_reports`, `reporting_periods`, `generated_reports`, `notifications`, `email_logs` |
| 4 — Management Reporting | Daily 19:00 Mon–Fri; Monday 09:00 weekly; 1st of month 09:00 monthly | Daily/weekly/monthly management summary reports (idempotency key) | `generated_reports`, `notifications`, `email_logs` |
| 5 — Announcements & Communication | Webhook `POST /webhook/announcement` (secret-validated); 10:00 Mon–Fri acknowledgement reminders | Create announcement, notify active staff, acknowledgement reminders | `announcements`, `announcement_reads`, `notifications`, `profiles`, `email_report_recipients` |
| 6 — Document & Knowledge Processing | Webhook `POST /webhook/knowledge-ingest` (secret-validated) | Register source, extract text, embeddings (NVIDIA), store chunks, mark indexed | `knowledge_sources`, `knowledge_chunks`, `knowledge_ingestion_jobs` |
| 7 — AI Assistant & RAG | Webhook `POST /webhook/knowledge-chat` (secret-validated) | Profile → history → vector search (`match_knowledge_chunks` RPC) → NVIDIA reply → save with citations | `knowledge_chunks`, `knowledge_sources`, `chatbot_conversations`, `chatbot_messages`, `profiles` |
| 8 — Error Handling & Monitoring | Delegated to `IRIAD Error Handler` workflow (`n8n-nodes-base.errorTrigger`) | Log failures to `automation_runs`, Gmail alert to `olarewajuagbaje@gmail.com`, in-app notification, execution-ID deduplication | `automation_runs`, `notifications` |

### 2.2 Error handler — `n8n/IRIAD_ERROR_HANDLER.json`

8 nodes: Error Trigger → Extract Error Data → Check Duplicate Execution (IF) → [no-op skip] OR [Log to `automation_runs` → Notify admin in-app (`notifications`) → Gmail alert]. Deduplicates by execution ID. No hardcoded secrets.

### 2.3 Archived legacy workflows (preserved, not deleted)

`n8n/workflows/archived/`: `attendance-open`, `attendance-close-and-daily-report`, `evening-signout-open-close`, `attendance-reminders`, `task-reminders`, `weekly-management-report`, `monthly-management-report`, `announcement-email-notification`, `chat-notifications`, `knowledge-ingestion`, `knowledge-chat-agent`. All consolidated into the master workflow sections above (see `n8n/MASTER_WORKFLOW_GUIDE.md` §Relationship to Legacy Workflows).

### 2.4 Frontend → n8n integration points

| Frontend page | Webhook URL env var | Payload | Auth |
|---------------|---------------------|---------|------|
| `KnowledgeBasePage.tsx` | `VITE_N8N_KNOWLEDGE_INGEST_WEBHOOK_URL` | `{ source_id }` | — (n8n validates `x-webhook-secret`) |
| `ChatbotPage.tsx` | `VITE_N8N_KNOWLEDGE_CHAT_WEBHOOK_URL` | `{ question, conversation_id, profile_id }` | Bearer token |
| `AnnouncementsPage.tsx` | `VITE_N8N_ANNOUNCEMENT_WEBHOOK_URL` | `{ title, body, category, created_by }` | Bearer token |

---

## 3. Business operations inventory (brief §6, 16 operations)

| # | Business operation | Current implementation | Trigger | Schedule (Lagos) | Idempotency today |
|---|--------------------|------------------------|---------|------------------|-------------------|
| 1 | Attendance opening (~08:00 Mon–Fri) | n8n Section 1 | Schedule | 08:00 Mon–Fri | None (upsert `attendance_sessions` is unique per org+date) |
| 2 | Automatic attendance closure (09:00) | n8n Section 1 close branch + daily snapshot | Schedule | 09:00 Mon–Fri (docs vary 09:00/09:05 — see §11) | None |
| 3 | Staff sign-in / sign-out processing | Edge Function `attendance-checkin` (window 08:00–09:00 + 15-min grace, holiday/workday checks); UI check-in/check-out; n8n sign-out window 17:00–18:05 | HTTP (Edge Function) / schedule | 08:00–09:15 effective check-in | `attendance` unique(org, staff, date) |
| 4 | Daily attendance reporting | n8n Section 1 close branch → `generated_reports` (daily) | Schedule | 09:00 Mon–Fri | `generated_reports.idempotency_key` unique |
| 5 | Weekly reporting + configurable deadline | n8n Sections 3 & 4; `report_schedules`, `reporting_periods.due_date`, `system_settings.report_weekly_deadline` | Schedule | Fri 16:00 / Mon 09:00 | Idempotency key |
| 6 | Monthly reporting + configurable deadline | n8n Sections 3 & 4; `system_settings.report_monthly_deadline` | Schedule | Last day 17:00 / 1st 09:00 | Idempotency key |
| 7 | Leave request notifications & approval events | UI flow: `LeavePage` (request + admin approve/reject); no n8n section; notifications table has no `leave_request` type | UI | — | None |
| 8 | Attendance correction notifications & processing | UI flow: `AttendanceCorrectionsPage` (request + admin approve/reject + audit); no automated n8n notification | UI | — | None |
| 9 | Task assignment notifications | n8n Section 2; notifications type `task_assigned` | Schedule | 09:00 Mon–Fri | None |
| 10 | Task deadline reminders | n8n Section 2 (overdue + upcoming) | Schedule | 09:00 Mon–Fri | None |
| 11 | Announcement notifications | n8n Section 5 webhook + Gmail distribution | Webhook | On demand | None |
| 12 | Document upload & assignment notifications | Partially: `notifications` type `chat_message`; no dedicated document-upload notification flow | UI | — | None |
| 13 | Project & task status notifications | Partially: n8n Section 2 task reminders; `task_updates` status history exists | Schedule | 09:00 Mon–Fri | None |
| 14 | AI knowledge assistant integration | n8n Section 7 webhook → NVIDIA NIM → `match_knowledge_chunks` RPC | Webhook | On demand | None |
| 15 | Knowledge-base ingestion & indexing | n8n Section 6 webhook → NVIDIA embeddings → `knowledge_chunks` | Webhook | On demand | `knowledge_ingestion_jobs` tracks status |
| 16 | Automation error monitoring & admin alerts | n8n Section 8 + Error Handler → `automation_runs`, `notifications`, Gmail to `olarewajuagbaje@gmail.com` | Error trigger | On failure | Error handler dedups by execution ID |

**Gap note:** Operations 7, 8, 12 exist as UI flows today but have no automated notification equivalent in n8n. The native backup engine can implement them without duplicating the existing UI system.

---

## 4. Database objects used by automation

Migration 001: `organisations`, `profiles`, `departments`, `organisation_members`, `system_settings`, `activity_logs`.
Migration 002: `attendance_policy`, `working_calendar`, `attendance_sessions`, `attendance`, `attendance_corrections`, `leave_requests`.
Migration 003: `projects`, `project_members`, `project_milestones`, `tasks`, `task_assignees`, `task_updates`, `project_tables`, `project_table_columns`, `project_table_rows`, `project_deliverables`, `project_reviews`.
Migration 004: `reporting_periods`, `weekly_reports`, `monthly_reports`, `report_reviews`, `report_schedules`.
Migration 005: `chat_rooms`, `chat_room_members`, `chat_messages`, `chat_message_attachments`, `chat_message_reactions`, `chat_message_reads`, `announcements`, `announcement_comments`, `announcement_reads`.
Migration 006: `documents`, `document_versions`, `calendar_events`, Storage bucket `documents`.
Migration 007: `notifications`, `email_report_recipients`, `generated_reports` (idempotency key), `email_logs`, `automation_runs` (existing n8n run log — reuse candidate for execution history).
Migration 008–010: `knowledge_collections`, `knowledge_sources`, `knowledge_chunks`, `knowledge_ingestion_jobs`, `chatbot_conversations`, `chatbot_messages`, `chatbot_feedback`, pgvector extension, `match_knowledge_chunks` RPC.

Reuse candidates for the dual-engine design:
- `automation_runs` — n8n run records (workflow_name, trigger, status, input/output/error). Extend role as n8n execution history alongside the new registry.
- `activity_logs` — audit trail for administrative actions (control-centre actions).
- `system_settings` — key/value jsonb per organisation; candidate home for automation configuration keys (failover enabled, preferred engine).
- `notifications`, `email_logs` — alerting and delivery-attempt records.
- `generated_reports.idempotency_key` — existing idempotency pattern to mirror.

---

## 5. Schedules and timezone

All n8n schedule triggers use `Africa/Lagos`. Check-in window 08:00–09:00 per `attendance_policy` (`morning_open_time`/`morning_close_time`), grace period 15 minutes → effective check-in until 09:15. Sign-out window 17:00–18:05. Working days Mon–Fri (`working_days = '{1,2,3,4,5}'`). `working_calendar` holds holidays/closures.

---

## 6. Credentials and integrations (values never exposed)

| Credential/secret | Where it lives | Used by | Exposure rule |
|-------------------|----------------|---------|---------------|
| `SUPABASE_SERVICE_ROLE_KEY` | n8n credentials + `.env` (server-side) | n8n Supabase nodes; Edge Functions | Never frontend, never `VITE_` |
| `NVIDIA_API_KEY` | n8n credentials + `.env` | Knowledge ingestion + chat LLM/embeddings | Server-side only |
| `N8N_WEBHOOK_SECRET` | n8n env | Webhook request verification | Server-side only |
| Gmail OAuth2 | n8n credential UI | Email delivery nodes | n8n-managed, never in code |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` / `.env.example` | Frontend Supabase client | Browser-safe by design |
| `VITE_N8N_*_WEBHOOK_URL` | `.env` / `.env.example` | Frontend webhook calls | Browser-safe URLs only |

Security observation (resolved): `NVIDIA_API_KEY` in `.env.example` is now a placeholder (`REPLACE_WITH_NVIDIA_API_KEY`). `.env` is gitignored (`.gitignore`: `.env`, `.env.local`, `.env.*.local`). No secrets exist in frontend bundles (only `VITE_*` vars) or workflow exports (all n8n nodes use `$env.*` references — confirmed by `docs/N8N_INTEGRATION_AUDIT.md`).

---

## 7. Error handling and alerting today

- `automation_runs` table logs n8n runs (workflow_name, trigger, status, started/completed, input, output, error).
- `IRIAD Error Handler` workflow catches failures routed via `errorWorkflowId`, logs to `automation_runs`, sends Gmail alert to `olarewajuagbaje@gmail.com`, creates in-app `system_error` notification, deduplicates by execution ID.
- Individual master-workflow sections log failures to `automation_runs` and `notifications`.
- No engine health monitoring, no native backup, no failover, no lease or recovery mechanics exist today.

---

## 8. What is missing relative to the Dual Automation brief

| Brief requirement | Current state |
|-------------------|---------------|
| Central job registry (job ID, idempotency key, business operation, workflow ID, acknowledgement, timeout, retry policy, result) | ❌ Absent |
| Job state machine (Pending…Completed…Uncertain…Recovered) | ❌ Absent |
| Atomic job claiming with execution leases + lease expiration | ❌ Absent |
| Idempotency records shared by both engines | ⚠️ Partial (reports only) |
| Independent native backup engine (TypeScript + Edge Functions + Cron) | ❌ Absent |
| Automatic failover n8n → native engine | ❌ Absent |
| Uncertain execution reconciliation after timeouts | ❌ Absent |
| Missed scheduled job recovery | ❌ Absent (n8n schedules only; no DB-driven recovery) |
| Automation Control Centre (engine health, stats, controls, audit) | ❌ Absent |
| Staff exclusion from infrastructure controls | ✅ Navigation-level only; no dedicated infra routes exist yet |
| Supabase Cron / pg_cron schedules | ❌ Not configured |

---

## 9. Preservation commitments (brief §1 / §11)

- All n8n workflow JSON files remain untouched (active master + error handler; archived legacy files preserved).
- No existing table is replaced; new automation tables are added, existing tables extended only where safe.
- Existing business logic (attendance windows, report deadlines, role permissions, RLS) is preserved.
- No production data is modified during development.
- The demo remains functional.
- Credentials are never exposed in frontend code or exported files.

---

## 10. Observations for review before design

1. **Attendance policy (resolved):** `attendance_policy` sets `morning_close_time = '09:00'`, working days Mon–Fri (`working_days = '{1,2,3,4,5}'`). The 15-minute `grace_period_minutes` applies only to the **closing** boundary (late check-in tolerance / `is_late` flag); it does **not** extend the opening window (08:00 unchanged) and does **not** keep check-in "open" past 09:00 — check-ins after 09:00 are recorded as late. 09:00 Africa/Lagos is the authoritative closing time; 09:05 references in `n8n/README.md` and `MASTER_WORKFLOW_GUIDE.md` are superseded by `attendance_policy`.
2. **Role naming mismatch (resolution planned):** frontend `brand.ts`/`permissions.ts`/`demoAuth.ts` use `admin`/`director`/`staff`; migration 001 check constraint allows `super_admin`/`staff_admin`/`ceo`/`staff`. Demo auth maps email prefixes to roles independently. Planned migration: map `super_admin`/`staff_admin` → `admin`, `ceo` → `director`, keep `staff`; tighten check constraints; rewrite RLS policies to `admin`/`director`. No accounts or history deleted; no hidden super-admin or CEO privileges remain. Control-centre authorisation uses `isAdminOrDirector()` plus RLS. See `docs/DUAL_AUTOMATION_ARCHITECTURE.md` §12 and §16.
3. **pg_cron (verification required):** not referenced anywhere in the repo; cannot be verified against the live Supabase project without credentials. Verification steps and an independent scheduling fallback (Vercel Cron / GitHub Actions invoking Edge Functions directly — no n8n, no active browser session) are documented in `docs/DUAL_AUTOMATION_ARCHITECTURE.md` §9 and §16.
4. **n8n is not live:** workflows are inactive and no credentials are configured; failover tests cannot run against live n8n yet (test plan in §8 of the brief relies on later live configuration).
5. **No native notification flows** for leave requests (7), attendance corrections (8), or document uploads (12) exist in n8n today — the backup engine implements these as new equivalent operations, not a parallel system.

Next: `docs/DUAL_AUTOMATION_ARCHITECTURE.md` (Phase 2 design), then review before any schema or code changes.
