# IRIAD Operations Portal — Security Guide

**Status:** defensive design documented; live credentials and RLS tests pending a configured `.env` and applied migrations.

## 1. Secrets management

- `.env.example` contains **placeholders only** (e.g. `NVIDIA_API_KEY=REPLACE_WITH_NVIDIA_API_KEY`). It is safe to commit.
- Real keys live in a local, gitignored `.env` (never committed):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `NVIDIA_API_KEY`
  - `N8N_BASE_URL`, `N8N_WEBHOOK_SECRET`
  - `RESEND_API_KEY` (email, optional)
- A Supabase secret key was previously exposed in conversation — treat as compromised; **rotate it in the Supabase dashboard before use**.

## 2. Authentication

- Supabase Auth (email/password or magic link) manages `auth.users`.
- `profiles.id` references `auth.users.id`; session drives `auth.uid()` in RLS.
- Protected routes require a Supabase session (`ProtectedRoute`, `useAuth`).
- Demo credentials shown in `LoginPage` UI do not exist until real Auth users + seed profiles are created.

## 3. Row Level Security (RLS)

- RLS enabled on **all 52 tables** (~101 policies).
- Every org-scoped row is filtered by `organisation_id` = user's organisation.
- Cross-organisation reads/writes are rejected by the database, not just the frontend.
- Role-based helpers in `src/lib/permissions.ts`: `roleRank`, `canManage`, `isAdmin`, `isDirector`, `isAdminOrDirector`, `canManageKnowledgeBase`, `canViewOrgWide`, `getOrgId`.

## 4. Data protection

- No real staff/personal data in the repository; all demo data labelled as such (`supabase/seed.sql`).
- Documents stored in **private** Supabase Storage buckets; downloads via **signed URLs** (time-limited).
- Email report recipients configured by admin, not hardcoded in workflows.

## 5. Chat & knowledge access

- Chat messages readable/sendable only by `chat_room_members` (RLS).
- Knowledge chunk retrieval filtered by source/collection access; staff cannot retrieve admin-only chunks.

## 6. Phase 7 security tests to run (against live Supabase)

- [ ] RLS: staff cannot read another organisation's profiles
- [ ] RLS: staff cannot update another staff's attendance record
- [ ] RLS: only admin/director can manage projects/roles
- [ ] Attendance boundary: check-in rejected outside 8:00–9:00 Africa/Lagos (server-side)
- [ ] Duplicate prevention: unique staff+date prevents two check-ins same day
- [ ] Chat room membership: non-member cannot read/send messages (RLS)
- [ ] RAG: staff cannot retrieve admin-only knowledge chunks

## 7. What is NOT yet operational

- Live Supabase connection (no real credentials configured yet)
- n8n instance connected (`N8N_BASE_URL`, `N8N_WEBHOOK_SECRET` placeholders)
- Email/Gmail (`ADMIN_EMAIL`, Gmail credential) not configured
- End-to-end RLS/permission tests not yet run against live DB
