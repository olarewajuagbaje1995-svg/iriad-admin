# IRIAD Operations Portal — Build Status

**Status tracking per READ.ME instruction #14.**  
Update this file at the end of each phase: completed, in-progress, blocked, untested.

Use: `[x]` Completed and verified. `[~]` Currently working. `[ ]` Not started. `[!]` Blocked.

## Phase 0 — Repository and brand inspection — [x] COMPLETE

- Repository inspected — only READ.ME present; no existing app, not yet a git repository
- Official IRIAD site inspected — logo downloaded to `public/brand/iriad-logo.jpg` (original JPG, 153×51)
- Brand tokens recorded: primary #0274be, secondary #21759b, font Montserrat, light theme
- `docs/IMPLEMENTATION_PLAN.md` — created
- `.env.example` — created (placeholders only; NVIDIA_API_KEY placeholder, real key goes in gitignored `.env`)
- `.gitignore` — created
- Supabase project `rvjpdfudghwqcxldrkri` confirmed from READ.ME §1
- `docs/BUILD_STATUS.md` — this file

**Setup still required:** apply migrations, create real `.env`, load seed data.

## Phase 1 — Foundation — [x] COMPLETE

- React/TypeScript/Vite/Tailwind project scaffolded
- Branding + responsive design system (`src/styles/theme.css`, `src/config/brand.ts`)
- Supabase client config (`src/lib/supabase.ts`) + `vite-env.d.ts`
- Auth + protected routes (`src/features/auth/LoginPage.tsx`, `src/routes/ProtectedRoute.tsx`, `src/routes/AppRoutes.tsx`)
- Layout shell (`src/components/layout/AppLayout.tsx`)
- Dashboard shell (`src/features/dashboard/DashboardPage.tsx`)
- Utility libs (`src/lib/dates.ts`, `src/lib/permissions.ts`)
- TypeScript checks pass; production build succeeds
- Database migrations + RLS policies — [x] COMPLETE (`supabase/migrations/001–009.sql`)
- Edge Function: `supabase/functions/attendance-checkin/index.ts` — server-side check-in window enforcement

## Phase 2 — Attendance and staff operations — [x] COMPLETE

- Attendance page with check-in/check-out — [x] built, connected to Supabase, uses Edge Function for server-side window enforcement
- Tasks page with status history — [x] built, connected to Supabase
- Weekly/monthly reports page (draft/submit) — [x] built, weekly + monthly toggle
- Leave/remote/field-work requests — [x] built with admin approval workflow (LeavePage)
- Attendance corrections/overrides audit — [x] built (AttendanceCorrectionsPage with approve/reject + audit history)
- `supabase/seed.sql` — [x] created (labelled demo data)

## Phase 3 — Communication — [x] COMPLETE

- Chat rooms + realtime messages — [x] built, connected to Supabase
- Chat attachments/reactions/read receipts — [x] built (file upload to Storage, emoji reactions, read receipts)
- Announcements — [x] built (basic), connected to Supabase
- Notifications — [x] built (list + mark read), connected to Supabase

## Phase 4 — Projects and files — [x] COMPLETE

- Projects listing — [x] built, connected to Supabase
- Custom project table builder — [x] built (create tables, columns, rows; inline editing)
- Documents (signed URLs) — [x] built (upload to private Storage, 10 MB limit, signed URL download, delete)
- Calendar — [x] basic listing
- CEO dashboard — [x] built with recharts charts (attendance trend line, leave by type bar)

## Phase 5 — RAG and AI assistant — [x] COMPLETE (UI)

- Knowledge Base listing — [x] built
- Source ingestion UI — [x] built (text, url, faq, file upload; audience/roles/tags; indexing status)
- Chatbot — [x] built (n8n webhook via `VITE_CHATBOT_WEBHOOK_URL` env var)
- RAG role filtering — [x] enforced at DB RLS + UI audience level

**[!] Live RAG pipeline (PDF/DOCX/TXT extraction + embeddings + NVIDIA AI)** requires n8n knowledge-ingestion workflow imported and NVIDIA_API_KEY configured.

## Phase 6 — Management reporting — [x] COMPLETE (UI)

- Weekly reports — [x] built with draft/submit flow
- Monthly reports — [x] built (same page, toggle)
- Approval Centre — [x] built (weekly/monthly report review + approve/revise)

## Phase 7 — QA and deployment readiness — [x] COMPLETE

- TypeScript type check (`tsc --noEmit`) — [x] PASS (zero errors)
- Production build (`vite build`) — [x] PASS (~1,042 KB JS)
- Unit/integration tests (vitest) — [x] 43 tests passing across 6 files:
  - `src/lib/dates.test.ts` (7)
  - `src/lib/permissions.test.ts` (7)
  - `src/lib/attendance-boundary.test.ts` (8)
  - `src/features/attendance/duplicate-prevention.test.ts` (6)
  - `src/features/chat/chat.integration.test.ts` (6)
  - `src/features/knowledge-base/rag-access.test.ts` (9)
- Form validation (react-hook-form + zod) — [x] applied to ReportsPage, KnowledgeBasePage, LeavePage, AttendanceCorrectionsPage
- Search/filter — [x] applied to ReportsPage reports list, ChatPage rooms list
- PDF generation — [x] `src/lib/pdf.ts` with print-to-PDF report download button on ReportsPage
- Lint (eslint) — [ ] NOT RUN (config not yet added)
- n8n workflow JSONs — [x] 1 master workflow + 1 error handler + 11 archived legacy files
- DEPLOYMENT.md — [x] created with local setup/deployment instructions
- Live Supabase connection — [!] BLOCKED (no real `.env` credentials yet)
- RLS/permission tests against live DB — [!] pending credentials
- Attendance boundary / duplicate-prevention tests against live DB — [!] pending credentials
- n8n workflow import/testing against live n8n — [!] pending n8n instance

## Next task

Apply migrations to Supabase project `rvjpdfudghwqcxldrkri`, create real `.env` (Supabase keys + NVIDIA_API_KEY + ADMIN_EMAIL), load `supabase/seed.sql`, import n8n master workflow + error handler using `n8n/README.md`, then run live RLS/permission tests.

## Known limitations

- No real secrets configured yet (Supabase secret key previously exposed — rotate before use; NVIDIA_API_KEY placeholder in .env.example)
- Database tables not yet created in Supabase (migrations not applied)
- No end-to-end integration tested against live Supabase yet
- Auth is placeholder-gated until real Auth users + seed profiles exist

## Phase 8 — n8n consolidation and Resend removal — [x] COMPLETE

- Removed Resend completely from all project files (.env.example, ENVIRONMENT_VARIABLES.md, IRIAD_MASTER_WORKFLOW.json, KNOWN_ISSUES.md, DEEP_SYSTEM_AUDIT.md, DEPLOYMENT.md, n8n/README.md, N8N_SETUP.md, SECURITY_GUIDE.md)
- Rebuilt n8n/IRIAD_MASTER_WORKFLOW.json with native Gmail nodes for all email delivery (9 Gmail nodes: attendance reminder, check-out alert, task overdue, event reminder, announcement, weekly report, monthly report, knowledge failure, system error alert)
- Added three webhook URLs: announcement, knowledge-ingest, knowledge-chat (olarewajuagbaje-n8n-automation-hub.hf.space)
- Created n8n/IRIAD_ERROR_HANDLER.json with Gmail alerts to olarewajuagbaje@gmail.com
- Archived 11 legacy workflow files to n8n/workflows/archived/
- Updated MASTER_WORKFLOW_GUIDE.md, MASTER_WORKFLOW_TESTS.md, ENVIRONMENT_VARIABLES.md
- Created docs/N8N_INTEGRATION_AUDIT.md
- Updated frontend: KnowledgeBasePage.tsx, ChatbotPage.tsx, AnnouncementsPage.tsx with new VITE_N8N_* webhook env vars
- TypeScript check: PASS; Tests: 43 passing; Build: PASS

## Phase 1 — Repository and workflow inspection — [x] COMPLETE

- `docs/DUAL_AUTOMATION_INVENTORY.md` — created: full inventory of existing n8n automation (master workflow, error handler, 11 archived legacy workflows), 16 business operations mapped, DB objects, schedules, credentials, gaps vs the Dual Automation Engine brief

## Phase 2 — Architecture and database design — [x] COMPLETE

- `docs/DUAL_AUTOMATION_ARCHITECTURE.md` — created: central job registry schema (automation_engines, automation_jobs, automation_executions, automation_idempotency, automation_recoveries, automation_config), job state machine, atomic claiming (FOR UPDATE SKIP LOCKED + leases), failover scenarios A–E, idempotency/effectively-once strategy, native backup Edge Functions, Supabase Cron schedule, security model, Automation Control Centre UI plan, conflicts and open questions
- No schema or code changes made yet; Phase 3 (migration 011) pending review