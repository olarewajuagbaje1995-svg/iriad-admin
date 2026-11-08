# IRIAD Operations Portal — Final Project Handover

**Product:** IRIAD Operations Portal  
**Organisation:** Initiative for Research, Innovation, and Advocacy in Development (IRIAD)  
**Repository:** `C:\dev\IRIAD` (local, git)  
**Current branch:** `master`  
**Current commit:** `289114c` — `feat: complete Phase 1-6 of IRIAD Dual Automation Engine`  
**Git status:** clean — nothing to commit  
**Remote:** none configured (no GitHub remote)  
**Handover date:** 2026-11-08  
**Prepared by:** Claude Code (senior software architect / production-readiness review)

---

## 1. What was built

The IRIAD Operations Portal is an internal operations platform for IRIAD staff to manage attendance, tasks, reports, projects, documents, announcements, chat, and a knowledge-base assistant. It is organisation-scoped (multi-tenant by `organisation_id`) with role-based access control (RBAC) enforced by Supabase Row Level Security (RLS).

### Build status by phase

| Phase | Deliverable | Status |
|-------|-------------|--------|
| Phase 0 — Repository & brand inspection | Scaffold, brand tokens, `.env.example`, `.gitignore`, implementation plan | Complete |
| Phase 1 — Foundation | React/TS/Vite/Tailwind app, Supabase client, auth + protected routes, layout, dashboard, migrations 001–009 with RLS, Edge Function `attendance-checkin` | Complete |
| Phase 2 — Attendance & staff operations | Attendance page, tasks, weekly/monthly reports, leave requests, attendance corrections, seed data | Complete |
| Phase 3 — Communication | Chat (realtime), attachments, reactions, announcements, notifications | Complete |
| Phase 4 — Projects & files | Projects, custom table builder, documents (signed URLs), calendar, CEO dashboard | Complete |
| Phase 5 — RAG & AI assistant | Knowledge Base, source ingestion UI, chatbot, RAG role filtering | Complete (UI); live pipeline requires n8n + NVIDIA key |
| Phase 6 — Management reporting | Weekly/monthly reports, approval centre | Complete (UI) |
| Phase 7 — QA & deployment readiness | TypeScript check PASS, build PASS, 43 vitest tests PASS, n8n master workflow + error handler, DEPLOYMENT.md | Complete (live DB tests blocked on credentials) |
| Phase 8 — n8n consolidation & Resend removal | Resend fully removed, master workflow rebuilt with Gmail nodes, 3 webhooks, error handler, 11 legacy workflows archived | Complete |
| Dual Automation Phase 1 — Inventory | `docs/DUAL_AUTOMATION_INVENTORY.md` — 16 business operations mapped | Complete |
| Dual Automation Phase 2 — Architecture | `docs/DUAL_AUTOMATION_ARCHITECTURE.md` — dual-engine design, migration 011/012 plan | Complete (design only) |

### What is NOT yet implemented (by design, pending approval)

- Migration `011_role_alignment.sql` (align DB roles `super_admin`/`staff_admin`/`ceo` → `admin`/`director`) — planned, not applied
- Migration `012_automation_engine.sql` (central job registry, engine health, idempotency, recoveries, config, `claim_automation_job()`) — planned, not applied
- Supabase Cron / pg_cron schedules — not configured (pg_cron availability not confirmed on live project)
- Automation Control Centre UI page exists in routes but is not wired to live automation tables (migration 012 not applied)
- Live n8n workflows are not imported or activated (no n8n credentials configured)
- Live Supabase connection is not configured (no real `.env` credentials; migrations not applied to project `rvjpdfudghwqcxldrkri`)

---

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| Framework | React 18 + TypeScript + Vite 5 |
| Styling | Tailwind CSS + design system (`src/styles/theme.css`) |
| Routing | React Router 6 (`src/routes/AppRoutes.tsx`) |
| Forms | react-hook-form + zod (applied to ReportsPage, KnowledgeBasePage, LeavePage, AttendanceCorrectionsPage) |
| Backend / BaaS | Supabase (Auth, PostgreSQL, Realtime, Storage) |
| Vector / RAG | pgvector (`vector(1536)`) on `knowledge_chunks` |
| Charts | recharts |
| Icons | lucide-react |
| AI provider | NVIDIA NIM (`NVIDIA_API_KEY`) via n8n AI Agent node |
| Workflows | n8n (master workflow + error handler + 11 archived legacy files) |
| Tests | vitest (43 tests) |
| Edge Functions | Deno + `@supabase/supabase-js` (25 functions) |

---

## 3. Roles and permissions

Three frontend roles: `staff` (rank 1), `director` (rank 2), `admin` (rank 3), defined in `src/config/brand.ts` and `src/lib/permissions.ts`.

| Role | Can |
|------|-----|
| `staff` | Own attendance, tasks, reports, chat, documents, personal dashboard |
| `director` | Organisation-wide oversight; approve leave; view reports; audit logs |
| `admin` | Full organisation management; staff CRUD; attendance control; approval centre; system settings |

Demo accounts (demo mode via `VITE_DEMO_MODE=true`): `admin@iriad.example`, `director@iriad.example`, `staff@iriad.example`.

Database roles (migration 001 check constraint): `super_admin`, `staff_admin`, `ceo`, `staff`. A planned role-alignment migration maps `super_admin`/`staff_admin` → `admin`, `ceo` → `director`. This mapping is **not yet applied**.

---

## 4. Database

Migrations `supabase/migrations/001`–`010.sql` create 52 tables plus RLS (~101 policies), pgvector extension, and the `match_knowledge_chunks` RPC placeholder (referenced by n8n but not yet created — see Deep System Audit finding 1.3).

Migration 006 creates the `documents` Storage bucket. Seed data is in `supabase/seed.sql` (labelled demo data).

Planned migrations (not yet created as files): `011_role_alignment.sql` and `012_automation_engine.sql` per `docs/DUAL_AUTOMATION_ARCHITECTURE.md` §16.

---

## 5. Edge Functions (25 total)

All live in `supabase/functions/`. Each is a Deno HTTP handler using the Supabase service-role key (server-side only).

| Function | Purpose |
|----------|---------|
| `attendance-checkin` | User-facing check-in (verifies JWT, enforces 08:00–09:00 Lagos window) |
| `automation-health-check` | Pings n8n health; trips failover after threshold |
| `automation-dispatcher` | Claims jobs via `claim_automation_job()`; routes to n8n or native backup |
| `automation-attendance-open` / `-close` | Open/close attendance sessions |
| `automation-staff-checkin` / `-checkout` | Staff check-in/check-out (17:00–18:05 sign-out) |
| `automation-daily-attendance-report` | Daily attendance snapshot |
| `automation-weekly-report` / `-monthly-report` | Weekly/monthly report reminders |
| `automation-leave-notifications` | Pending leave-request alerts |
| `automation-correction-notifications` | Pending attendance-correction alerts |
| `automation-task-reminders` | Task assignment + deadline reminders |
| `automation-announcement-notification` | Announcement notifications |
| `automation-document-notifications` | Document upload notifications |
| `automation-project-notifications` | Project/milestone notifications |
| `automation-knowledge-chat` | Knowledge-chat fallback (placeholder) |
| `automation-knowledge-ingestion` | Knowledge ingestion tracking |
| `automation-error-alert` | Automation error alerting |
| `automation-missed-schedule-recovery` | Missed schedule recovery |
| `automation-lease-reaper` | Expired lease → Uncertain |
| `automation-uncertain-reconciliation` | Uncertain job reconciliation |
| `automation-n8n-register` / `-callback` / `-acknowledge` | n8n job registration, completion callback, acknowledgement |

### Review findings (all 25 functions reviewed individually)

- **Authentication:** `attendance-checkin` verifies the user JWT (`auth.getUser`) and forwards the user's Authorization header so RLS applies. The 24 `automation-*` functions are cron/dispatcher-invoked infrastructure; they use the service-role key directly and do not perform per-user auth (by design — they are not user-facing endpoints).
- **Authorization:** `automation-*` functions bypass RLS via the service-role key (trusted server code). `attendance-checkin` enforces organisation scoping via the authenticated user's profile.
- **Error handling:** All functions wrap logic in try/catch and return JSON error responses with appropriate HTTP status codes (400/401/404/409/500).
- **Logging:** All functions log errors to `console.error`. Most `automation-*` functions write to `automation_runs`. `attendance-checkin` does **not** write to `automation_runs` or `activity_logs` (Deep System Audit finding 2.6).
- **Database access:** All functions read/write Supabase tables via the service-role client. The `automation-*` functions reference tables from planned migration 012 (`automation_jobs`, `automation_idempotency`, `automation_executions`, `automation_engines`) which do not exist until migration 012 is applied.
- **Idempotency:** All `automation-*` functions guard on `automation_idempotency[idempotency_key]` before performing business effects.
- **Timezone bug (Critical):** Several automation Edge Functions use UTC `new Date()` / `getUTCDay()` / `toISOString().slice(0,10)` instead of Africa/Lagos for workday checks, attendance windows (08:00–09:00, 17:00–18:05), and report dates. `attendance-checkin` shadows its own `nowLagos()` helper with `const nowLagos = new Date()` at line 91, so the check-in window is evaluated in server-local (likely UTC) time, not Lagos. This shifts the effective check-in window by one hour at 08:00 UTC.

---

## 6. n8n workflows

- `n8n/IRIAD_MASTER_WORKFLOW.json` — 92 nodes, 62 connections, 8 independent sections, all schedule triggers use `Africa/Lagos`, 3 webhooks (`/webhook/announcement`, `/webhook/knowledge-ingest`, `/webhook/knowledge-chat`) with `x-webhook-secret` validation, 9 Gmail nodes for email delivery. Resend fully removed. Imported inactive (`"active": false`).
- `n8n/IRIAD_ERROR_HANDLER.json` — 6 nodes, error trigger → dedup → log to `automation_runs` → Gmail alert → in-app notification.
- `n8n/workflows/archived/` — 11 legacy workflow files preserved, not deleted.

n8n is **not live**: workflows are inactive, no credentials configured, `N8N_BASE_URL` and `N8N_WEBHOOK_SECRET` are placeholders.

---

## 7. Configuration and secrets

- `.env` (local, gitignored): `VITE_DEMO_MODE=true`, placeholder Supabase keys, placeholder `NVIDIA_API_KEY`, empty `N8N_BASE_URL`/`N8N_WEBHOOK_SECRET`.
- `.env.example` (committed): placeholders only, `VITE_DEMO_MODE=false`, no real secrets.
- `.gitignore` excludes `.env`, `.env.local`, `.env.*.local`.
- No secrets in frontend bundles (only `VITE_*` vars). No hardcoded credentials in n8n workflow exports (all use `$env.*`).
- **Security note:** `SUPABASE_SECRET_KEY` was previously exposed in conversation — treat as compromised; rotate in Supabase dashboard before production use (`docs/KNOWN_ISSUES.md`).

---

## 8. Demo vs production separation

Demo mode is controlled entirely by `VITE_DEMO_MODE`:
- `true` → `src/lib/demoAuth.ts` (email/password only, session in `localStorage`, independent of Supabase). Demo accounts: `admin@iriad.example`, `director@iriad.example`, `staff@iriad.example`.
- anything else / unset → real Supabase Auth (`supabase.auth.signInWithPassword`, session cookie).

Demo data (localStorage) and production data (Supabase) are stored in different locations and never mixed, **provided** the local `.env` with `VITE_DEMO_MODE=true` is never deployed to production. `.env` is gitignored and not part of the commit, so this separation holds as long as production deployment uses real environment variables set in the hosting platform (not the local `.env`).

---

## 9. Git and repository status

- Local repository path: `C:\dev\IRIAD`
- Branch: `master` (no `main` branch exists locally)
- Commit: `289114c`
- Status: clean (working tree matches HEAD)
- Remote: none (`git remote -v` returns empty)
- No GitHub history was preserved/overwritten; this is the only local copy.
- No secrets or sensitive files are present in the commit history (`.env` is gitignored; `.env.example` contains placeholders only).

---

## 10. Handover checklist (before production deployment)

- [ ] Create real `.env` with Supabase URL/publishable key, service-role key, `NVIDIA_API_KEY`, `N8N_BASE_URL`, `N8N_WEBHOOK_SECRET`, `ADMIN_EMAIL`
- [ ] Apply migrations `001`–`010` to Supabase project `rvjpdfudghwqcxldrkri`
- [ ] Review and approve migration `011` (role alignment) and `012` (automation engine); apply on staging first
- [ ] Confirm `pg_cron` / `pg_net` availability on the Supabase project, or configure external scheduler (Vercel Cron / GitHub Actions)
- [ ] Load `supabase/seed.sql` (demo data) after creating real Auth users
- [ ] Deploy Edge Functions (`supabase functions deploy`)
- [ ] Import n8n master workflow + error handler into n8n; configure credentials
- [ ] Run live RLS/permission tests against Supabase
- [ ] Rotate the previously-exposed `SUPABASE_SECRET_KEY`
- [ ] Fix the timezone bug in Edge Functions (use `Africa/Lagos` explicitly) before production
- [ ] Do **not** push to GitHub or activate production n8n workflows without separate approval
