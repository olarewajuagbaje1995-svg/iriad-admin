# IRIAD Operations Portal — System Overview

**Product:** IRIAD Operations Portal  
**Organisation:** Initiative for Research, Innovation, and Advocacy in Development (IRIAD)  
**Source brief:** READ.ME (Sections 1–23)  
**Status:** Build complete (scaffold + data layer + feature UIs); live Supabase connection and n8n integration pending credentials.

## 1. Purpose

An internal operations platform for IRIAD staff to manage attendance, tasks, reports, projects, documents, announcements, chat, and a knowledge-base assistant — all organisation-scoped (multi-tenant by `organisation_id`) with role-based access control (RBAC) enforced by Supabase Row Level Security (RLS).

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| Framework | React 18 + TypeScript + Vite 5 |
| Styling | Tailwind CSS + custom design system (`src/styles/theme.css`) |
| Routing | React Router 6 |
| Forms | react-hook-form + zod |
| Backend / BaaS | Supabase (Auth, Database, Realtime, Storage) |
| Vector / RAG | pgvector (`vector(1536)`) on `knowledge_chunks` |
| Charts | recharts |
| Icons | lucide-react |
| AI provider | NVIDIA NIM (`NVIDIA_API_KEY`) via n8n AI Agent node |
| Workflows | n8n (12 workflow JSON files under `n8n/workflows/`) |
| Tests | vitest |

## 3. Architecture

```
browser (React SPA)
   │ HTTPS
   ▼
Supabase (Postgres + Auth + Realtime + Storage)
   ├─ RLS policies on every table (organisation_id tenant scoping)
   ├─ Realtime channels for chat & notifications
   └─ signed URLs for private document downloads
   │ webhooks / HTTP
   ▼
n8n (scheduled + webhook workflows; AI Agent for RAG chat)
   │ NVIDIA API (embeddings + LLM)
   ▼
NVIDIA NIM
```

## 4. Core domains

- **Authentication & profiles** — Supabase Auth; `profiles` linked to `auth.users`; roles: `super_admin`, `staff_admin`, `ceo`, `staff`.
- **Attendance** — morning check-in window (8–9 AM Africa/Lagos, Mon–Fri), admin-controlled evening sign-out, DB-enforced windows, unique staff+date constraint.
- **Tasks & projects** — CRUD, status history (`task_updates`), project members, milestones, custom tables, deliverables, reviews.
- **Reports** — weekly/monthly drafts and submissions, review workflow, management reports.
- **Communication** — chat rooms/membership/messages (Realtime), announcements, in-app notifications.
- **Documents** — private Storage buckets, signed URL downloads.
- **Knowledge base / RAG** — collections, sources, chunks with pgvector embeddings, ingestion jobs, chatbot conversations/messages/feedback.
- **Email reports** — daily 9 AM snapshot, weekly/monthly management emails via n8n.

## 5. Roles & permissions

| Role | Can |
|------|-----|
| `super_admin` | Full access; manage any role/org |
| `staff_admin` | Manage staff; attendance control; approvals |
| `ceo` | Executive dashboard; reports; read-all |
| `staff` | Own attendance, tasks, reports, chat |

See `src/lib/permissions.ts` (`roleRank`, `canManage`, `isAdmin`, `isCeoOrAdmin`, `getOrgId`) and `src/config/brand.ts` (`ROLES`, `NAVIGATION`).

## 6. Key files

- `src/main.tsx` — app entry (RouterProvider)
- `src/routes/AppRoutes.tsx` — routes + ProtectedRoute
- `src/components/layout/AppLayout.tsx` — sidebar + topbar shell
- `src/lib/supabase.ts` — Supabase client + `Profile`, `Organisation` types
- `src/types/database.ts` — full Database type (52 tables)
- `src/lib/dates.ts` — Lagos timezone helpers
- `src/lib/permissions.ts` — RBAC helpers
- `src/hooks/useAuth.ts, useAttendance.ts, useTasks.ts, useReports.ts, useNotifications.ts`
- `supabase/migrations/001–008.sql` — schema + RLS (~101 policies)
- `supabase/seed.sql` — labelled demo data
- `n8n/workflows/*.json` — 11 n8n workflow definitions

## 7. Security principles

- No real secrets in `.env.example` (placeholders only); real keys in local, gitignored `.env`.
- RLS enabled on every table; tenant-scoped by `organisation_id`.
- Never hardcode credentials, API keys, or real staff data.

## 8. What still needs live configuration

1. Create `.env` with real `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `NVIDIA_API_KEY`, `N8N_BASE_URL`.
2. Apply migrations `supabase/migrations/001–008.sql` to Supabase project `rvjpdfudghwqcxldrkri`.
3. Load `supabase/seed.sql` (demo data) — create real Auth users first.
4. Import n8n workflow JSONs into n8n and connect credentials.
5. Run vitest + Phase 7 RLS/permission tests against live Supabase.

## 9. Acceptance criteria (READ.ME §22)

Authentication/access, attendance, communication, reports, RAG chatbot, and dashboard criteria must all be demonstrable before the build is complete.
