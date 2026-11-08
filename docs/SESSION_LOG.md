# IRIAD Operations Portal — Session Log

Chronological log of work performed. Updated at the end of each work session.

## 2026-11-07 — Full implementation phase

- Read READ.ME implementation brief (683 KB) in full.
- Inspected official IRIAD site (https://iriadng.org/): logo, colours (#0274be primary, #21759b secondary), font Montserrat, navigation structure.
- Downloaded official logo to `public/brand/iriad-logo.jpg` (original JPG, 153×51).
- Created `docs/IMPLEMENTATION_PLAN.md`, `docs/BUILD_STATUS.md`, `.env.example` (placeholders only), `.gitignore`.
- Fixed `.env.example`: moved NVIDIA_API_KEY to placeholder (real key belongs in gitignored `.env`).
- Scaffolded React/TypeScript/Vite/Tailwind project (package.json, vite.config.ts, tsconfig, tailwind/postcss, index.html).
- Created brand config (`src/config/brand.ts`), theme CSS (`src/styles/theme.css`), Supabase client (`src/lib/supabase.ts`), dates/permissions utils, vite-env.d.ts.
- Created auth (LoginPage), protected routes, AppLayout shell, DashboardPage shell.
- TypeScript checks pass; production build succeeds (dist/ ~496 KB JS).
- Created full `src/types/database.ts` covering all 52 tables from READ.ME §18.
- Created Supabase migrations `supabase/migrations/001–009.sql`: organisations, profiles, departments, members, settings, activity logs, attendance (policy, calendar, sessions, records, corrections, leave), tasks/projects (tasks, assignees, updates, projects, members, milestones, custom tables/columns/rows, deliverables, reviews), reports (periods, weekly, monthly, reviews, schedules), communication (chat rooms/members/messages/attachments/reactions/reads, announcements/comments/reads), documents/calendar, notifications/email recipients/generated reports/email logs/automation runs, RAG (collections, sources, chunks, ingestion jobs, chatbot conversations/messages/feedback). All tenant-scoped; RLS enabled on every table (~101 policies). Migration 009 added `content` column to knowledge_sources. Migration 006 added documents Storage bucket.
- Created hooks: useAuth, useAttendance, useTasks, useReports (all call Supabase).
- Created feature pages: Attendance (check-in/check-out), Tasks, Reports (weekly+monthly), Chat (realtime rooms + attachments/reactions/read receipts), Announcements, Documents (upload + signed URL download), Calendar, Knowledge Base (ingestion UI + file upload), Chatbot (n8n webhook via env var).
- Created admin pages: Staff management, Attendance Control, Approval Centre (report reviews).
- Created AttendanceCorrectionsPage (request corrections + admin approve/reject with audit).
- Enhanced LeavePage (admin approval section for pending leave requests).
- Created ProjectTableBuilderPage (custom tables, columns, rows with inline editing).
- Created Edge Function `supabase/functions/attendance-checkin/index.ts` for server-side check-in window enforcement (8–9 AM Africa/Lagos).
- Wired all routes in AppRoutes.tsx (added attendance-corrections route).
- TypeScript checks pass; production build succeeds.

- Created `supabase/seed.sql` — labelled demo data (organisation, departments, attendance policy, system settings, reporting periods, email recipients).
- Generated 11 n8n workflow JSON files under `n8n/workflows/` (attendance-open, attendance-close-and-daily-report, evening-signout-open-close, attendance-reminders, task-reminders, weekly-management-report, monthly-management-report, announcement-email-notification, chat-notifications, knowledge-ingestion, knowledge-chat-agent); all validated as well-formed JSON.
- Added `vitest.config.ts` with `@/` alias.
- Wrote initial unit tests: `src/lib/dates.test.ts` and `src/lib/permissions.test.ts` — 14 tests passing.
- TypeScript check (`tsc --noEmit`) clean; production build succeeds (~507 KB JS).
- Wrote docs: SYSTEM_OVERVIEW.md, DATABASE_GUIDE.md, SECURITY_GUIDE.md, N8N_SETUP.md, RAG_GUIDE.md, USER_GUIDE.md.
- Updated BUILD_STATUS.md, TEST_REPORT.md, KNOWN_ISSUES.md.

- 2026-11-07 (continued):
  - Enhanced LeavePage with admin approve/reject for pending leave requests.
  - Created AttendanceCorrectionsPage with staff request + admin approve/reject + audit history.
  - Created ProjectTableBuilderPage for custom project tables (columns, rows, inline editing).
  - Enhanced ChatPage with file attachments, emoji reactions, read receipts.
  - Enhanced ReportsPage with weekly/monthly toggle.
  - Rewrote DashboardPage with real stats loading from Supabase.
  - Rewrote CeoDashboardPage with recharts charts (attendance trend, leave by type).
  - Rewrote KnowledgeBasePage with file upload (PDF/DOCX/TXT/MD/CSV) + text/url/faq sources.
  - Updated ChatbotPage to use `VITE_CHATBOT_WEBHOOK_URL` env var for n8n webhook.
  - Updated useAttendance hook to call Edge Function for server-side check-in enforcement with direct-insert fallback.
  - Updated useReports hook to support weekly and monthly report types.
  - Created Edge Function `supabase/functions/attendance-checkin/index.ts`.
  - Created `n8n/README.md` with workflow import/setup/verification instructions.
  - Created `DEPLOYMENT.md` with local setup/deployment instructions.
  - Wrote 4 new integration test files (mocked Supabase, no live credentials needed):
    - `src/lib/attendance-boundary.test.ts` (8 tests)
    - `src/features/attendance/duplicate-prevention.test.ts` (6 tests)
    - `src/features/chat/chat.integration.test.ts` (6 tests)
    - `src/features/knowledge-base/rag-access.test.ts` (9 tests)
  - TypeScript check (`tsc --noEmit`) clean; production build succeeds (~939 KB JS); all 43 tests passing across 6 files.
  - Updated BUILD_STATUS.md, SESSION_LOG.md, TEST_REPORT.md, KNOWN_ISSUES.md.

- 2026-11-07 (implementation continued):
  - Completed ReportsPage search/filter: added search input field + filter logic on activities/tasks/period.
  - Applied react-hook-form + zod validation to KnowledgeBasePage ingestion form (knowledgeSourceSchema).
  - Applied react-hook-form + zod validation to LeavePage (leaveRequestSchema) and AttendanceCorrectionsPage (attendanceCorrectionSchema).
  - Fixed `src/lib/validation.ts` invalid `#` comment on line 6 → `//`.
  - Removed unused imports/variables: ReportsPage (`Clock`, `formatLagos`), AppLayout (`loading`).
  - Created `src/lib/pdf.ts` — dependency-free print-to-PDF report generator with styled HTML output.
  - Integrated PDF download button into ReportsPage report items.
  - Added search to ChatPage rooms list (Search icon + input + name filter).
  - TypeScript check (`tsc --noEmit`) clean; production build succeeds (~1,042 KB JS); all 43 tests passing across 6 files.
  - Updated BUILD_STATUS.md, SESSION_LOG.md.

- 2026-11-07 (CRITICAL UPDATE — Resend removal, Gmail integration, master workflow rebuild):
  - Removed Resend completely from .env.example, n8n/ENVIRONMENT_VARIABLES.md, n8n/IRIAD_MASTER_WORKFLOW.json, docs/KNOWN_ISSUES.md, docs/DEEP_SYSTEM_AUDIT.md, DEPLOYMENT.md, n8n/README.md, docs/N8N_SETUP.md, docs/SECURITY_GUIDE.md
  - Added three webhook URL env vars to .env.example: VITE_N8N_ANNOUNCEMENT_WEBHOOK_URL, VITE_N8N_KNOWLEDGE_INGEST_WEBHOOK_URL, VITE_N8N_KNOWLEDGE_CHAT_WEBHOOK_URL (pointing to hf.space n8n instance)
  - Updated frontend: KnowledgeBasePage.tsx (VITE_N8N_KNOWLEDGE_INGEST_WEBHOOK_URL), ChatbotPage.tsx (VITE_N8N_KNOWLEDGE_CHAT_WEBHOOK_URL), AnnouncementsPage.tsx (added announcement creation form POSTing to VITE_N8N_ANNOUNCEMENT_WEBHOOK_URL)
  - Rebuilt n8n/IRIAD_MASTER_WORKFLOW.json: replaced "Resend or SMTP" with "Gmail (native n8n Gmail node)", added 9 Gmail nodes (attendance reminder, check-out alert, task overdue, event reminder, announcement, weekly report, monthly report, knowledge failure, system error alert to olarewajuagbaje@gmail.com), added ADMIN_EMAIL env var, all three webhook paths with secret validation
  - Created n8n/IRIAD_ERROR_HANDLER.json: webhook-triggered error handler with Gmail alert to olarewajuagbaje@gmail.com, Supabase logging, in-app notification
  - Archived 11 legacy workflow files to n8n/workflows/archived/
  - Updated n8n/MASTER_WORKFLOW_GUIDE.md (Gmail credential, ADMIN_EMAIL env var, archived workflows, Gmail troubleshooting)
  - Updated n8n/MASTER_WORKFLOW_TESTS.md (gmail node type, T9a Gmail test, T18 error handler test, node count 92)
  - Created docs/N8N_INTEGRATION_AUDIT.md (full audit: JSON validity, Resend removal, Gmail delivery, webhook paths, env vars, no workflow-transfer nodes, error handler, section independence, frontend integration)
  - TypeScript check: PASS (zero errors)
  - Tests: 43 passing
  - Production build: PASS (~1,045 KB JS)

- 2026-11-08 — Dual automation engine design
  - Inspected full repository: React/Vite frontend, Supabase migrations 001–010 + seed.sql, n8n master workflow + error handler + 11 archived legacy workflows, Edge Function attendance-checkin
  - Created `docs/DUAL_AUTOMATION_INVENTORY.md` (Phase 1): existing automation inventory, 16 business operations mapped, DB objects, schedules, credentials, gaps vs dual-engine brief
  - Created `docs/DUAL_AUTOMATION_ARCHITECTURE.md` (Phase 2): central job registry schema, job state machine, atomic claiming with leases, failover scenarios A–E, effectively-once idempotency strategy, native backup Edge Functions, Supabase Cron schedule, security model, Control Centre UI plan, conflicts/open questions
  - No schema or code changes made yet; Phase 3 (migration 011) pending review

- 2026-11-08 — Pre-Phase 3 resolutions (user-reviewed architecture; six issues resolved)
  - DATABASE ROLE ALIGNMENT: planned migration maps DB roles to the agreed three-role structure — `super_admin`/`staff_admin` → `admin`, `ceo` → `director`, `staff` unchanged; check constraints tightened to `('admin','director','staff')`; RLS policies referencing `super_admin`/`staff_admin` rewritten to `admin`/`director`; no accounts or history deleted; no hidden super-admin/CEO privileges; permission implications documented (`docs/DUAL_AUTOMATION_ARCHITECTURE.md` §12.1, §16).
  - PG_CRON: cannot be verified offline (no live credentials in repo). Verification SQL (`pg_available_extensions` for pg_cron/pg_net) and an independent fallback scheduler documented — Vercel Cron or GitHub Actions invoking Edge Function URLs directly with the service-role key (no n8n, no browser session) (§9, §16).
  - ENVIRONMENT FILE CLEANUP: `.env.example` now contains placeholders only (`NVIDIA_API_KEY=REPLACE_WITH_NVIDIA_API_KEY`); `.env` confirmed gitignored (`.gitignore`); no secrets in frontend bundles (VITE_* only) or n8n workflow exports ($env.* only).
  - ATTENDANCE POLICY: 09:00 Africa/Lagos, Mon–Fri, is the authoritative closing time (`attendance_policy.morning_close_time`); the 15-minute grace period applies only to the closing boundary (late check-in tolerance / `is_late`), does not extend the 08:00 opening window, and check-ins after 09:00 are recorded as late.
  - FAILOVER SAFETY: documented how the central registry, atomic claiming (`FOR UPDATE SKIP LOCKED`), execution leases, shared idempotency records, and uncertain-execution reconciliation prevent duplicate business operations, with explicit handling for email delivery that may have succeeded despite an HTTP timeout (§15).
  - PHASE 3 PLAN: migration implementation plan with ordering (011 role alignment → 012 automation engine foundation), DDL outlines, rollback considerations (pg_dump snapshot, staging test, non-reversible role mapping), and pre-apply checklist (§16).
  - Updated `docs/DUAL_AUTOMATION_INVENTORY.md` (§5, §6, §10 observations resolved), `docs/DUAL_AUTOMATION_ARCHITECTURE.md` (§9, §10, §12, §13, §15, §16; DDL role references updated to admin/director).
  - No schema or code changes made yet; no production data modified; no n8n workflows activated.

Next tasks:
- Present the six resolutions + Phase 3 migration plan for review and approval (this session).
- On approval: create `supabase/migrations/011_role_alignment.sql` and `012_automation_engine.sql`; apply only to a staging/test target first, never production without explicit authorisation.
- Create real `.env` (Supabase keys + NVIDIA_API_KEY + ADMIN_EMAIL); load `supabase/seed.sql` (create real Auth users first).
- Import n8n master workflow + error handler into n8n and connect credentials (Supabase, NVIDIA, Gmail) — activation requires explicit user authorisation.
- Run live RLS/permission tests (attendance boundary, duplicate prevention, chat membership, RAG access).
- Deploy Edge Function: `supabase functions deploy attendance-checkin`.
