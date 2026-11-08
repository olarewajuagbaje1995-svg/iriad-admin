# IRIAD Operations Portal — Implementation Plan

**Product:** IRIAD Operations Portal  
**Organisation:** Initiative for Research, Innovation, and Advocacy in Development (IRIAD)  
**Supabase project:** `rvjpdfudghwqcxldrkri` — https://rvjpdfudghwqcxldrkri.supabase.co  
**Source brief:** READ.ME (Sections 1–23)

## Phase 0 — Repository and brand inspection — COMPLETE

- [x] Inspect repository — only READ.ME present; no existing app, not yet a git repository
- [x] Inspect official IRIAD site (https://iriadng.org/) — logo, colours, typography, navigation
- [x] Download official logo to `public/brand/iriad-logo.jpg` (original JPG, 153×51)
- [x] Record brand tokens: primary #0274be, secondary #21759b, font Montserrat, light theme
- [x] Confirm Supabase project URL/reference — `rvjpdfudghwqcxldrkri` (from READ.ME §1)
- [x] Create `.env.example` with placeholders only (no real secrets)
- [x] Create `.gitignore` (env, node_modules, dist, OS files)
- [x] Produce this implementation plan (`docs/IMPLEMENTATION_PLAN.md`)
- [x] Create `docs/BUILD_STATUS.md` (completed / in-progress / blocked / untested)

**Risks:** Supabase secret key was previously exposed in conversation — treat as compromised; rotate before use. Never commit real secrets. No existing repository to preserve, so greenfield build is safe.

**Risks:** Supabase secret key was previously exposed in conversation — treat as compromised; rotate before use. Never commit real secrets. No existing repository to preserve, so greenfield build is safe.

## Phase 1 — Foundation — COMPLETE

- [x] Set up React/TypeScript/Vite/Tailwind project (package.json, vite.config.ts, tsconfig, tailwind, postcss)
- [x] Add branding and responsive design system (`src/styles/theme.css`, `src/config/brand.ts`, `public/brand/iriad-logo.jpg`)
- [x] Supabase client configuration (`src/lib/supabase.ts`) + `vite-env.d.ts`
- [x] Authentication and protected routes (`src/features/auth/LoginPage.tsx`, `src/routes/ProtectedRoute.tsx`, `src/routes/AppRoutes.tsx`)
- [x] Layout shell (`src/components/layout/AppLayout.tsx`)
- [x] Dashboard shell (`src/features/dashboard/DashboardPage.tsx`)
- [x] Utility libs (`src/lib/dates.ts`, `src/lib/permissions.ts`)
- [x] TypeScript checks pass; production build succeeds
- [ ] Organisation, profile and role tables; RLS policies (migrations) — next

## Phase 2 — Attendance and staff operations

- Morning check-in with automatic 9:00 AM closure (Africa/Lagos), DB-enforced windows
- Admin-controlled evening sign-out open/close
- Attendance corrections, leave, remote work, field work
- Tasks and task updates (status history)
- Weekly/monthly reports and review workflow

## Phase 3 — Communication

- Multiple group chat rooms, membership and moderation
- Supabase Realtime messaging, attachments, reactions, read status
- Announcements and feedback (separate from chat)
- In-app notifications and email triggers

## Phase 4 — Projects and files

- Project management, custom project table builder
- Deliverables and reviews
- Private document management (signed URLs)
- Calendar and events

## Phase 5 — RAG and AI assistant

- Admin knowledge-base management (upload, text, URL, FAQ)
- Text extraction, chunking, embeddings; Supabase pgvector
- Staff chatbot backed by real n8n AI Agent node
- Source citations, access filtering, feedback

## Phase 6 — Management reporting

- Daily 9:00 AM email snapshot (after attendance closure)
- Weekly and monthly management email reports
- Optional end-of-day report
- PDF archive and email delivery logs
- CEO dashboard and analytics

## Phase 7 — QA and deployment readiness

- Test RLS with different users/roles; organisation isolation
- Attendance boundary conditions; duplicate prevention; idempotency
- Chat room membership; RAG access restrictions; prompt injection resistance
- n8n imports and execution with test credentials
- Email failure/retry behaviour
- Mobile layouts and accessibility
- Document deployment and backup/restore

## Acceptance criteria (READ.ME §22)

Authentication/access, attendance, communication, reports, RAG chatbot, and dashboard criteria as listed in READ.ME §22 must all be demonstrable before the build is complete.

## Notes

- Build in small, testable phases; keep the app runnable after each phase.
- Use migrations for all database changes; every org-scoped table needs RLS enabled and tested.
- Label all demo/seed data; never commit credentials or real staff data.
- Do not claim email, LLM, embeddings, n8n or external integrations are operational until credentials are configured and an end-to-end test passes.
- Maintain `docs/BUILD_STATUS.md`; report files created/changed, migrations, tests, setup still required, and next phase at the end of each phase.
