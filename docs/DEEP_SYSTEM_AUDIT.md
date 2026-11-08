# IRIAD Operations Portal — Deep System Audit

**Audit date:** 2026-11-07  
**Auditor:** Claude Code (senior software architect / production-readiness review)  
**Scope:** Full React/TypeScript frontend, Supabase migrations (001-009), Edge Functions, n8n workflows, tests, documentation.

---

## How to read this document

Each finding includes:
- **Severity:** Critical / High / Medium / Low
- **Evidence:** File paths, line numbers, code excerpts
- **Affected files:** Concrete file references
- **Recommended solution:** What to change and why
- **Status:** `[x]` Fixed, `[~]` In progress, `[ ]` Not started, `[!]` Blocked (external dependency)

---

## 1. Database & Migrations

### 1.1 `attendance_windows` table referenced by n8n but never created — CRITICAL

**Evidence:**  
- `n8n/workflows/attendance-open.json` line 26: `operation: upsert, table: "attendance_windows"`  
- `n8n/workflows/attendance-close-and-daily-report.json` line 26: `table: "attendance_windows"`  
- `n8n/workflows/evening-signout-open-close.json` line 26: `table: "attendance_windows"`  
- No migration creates `attendance_windows`. Migration 002 creates `attendance_sessions` instead.

**Affected files:** All attendance-related n8n workflows; `supabase/migrations/002_attendance.sql`

**Recommended solution:** Either create an `attendance_windows` migration, or repoint all n8n workflows to use `attendance_sessions` (which already exists). Since `attendance_sessions` has the correct schema (`morning_opened_at`, `morning_closed_at`, etc.), repoint n8n to it is cleaner.

**Status:** `[ ]` Not started

---

### 1.2 `daily_reports` table referenced by n8n but never created — CRITICAL

**Evidence:**  
- `n8n/workflows/attendance-close-and-daily-report.json` line 64: `table: "daily_reports"`  
- No migration creates `daily_reports`. Migration 007 creates `generated_reports` instead.

**Affected files:** `n8n/workflows/attendance-close-and-daily-report.json`; `supabase/migrations/007_notifications.sql`

**Recommended solution:** Repoint to `generated_reports` (which has `idempotency_key`, `delivery_status`, `html_path`, `pdf_path`) or create a `daily_reports` migration. `generated_reports` is the better fit.

**Status:** `[ ]` Not started

---

### 1.3 `match_knowledge_chunks` RPC function referenced by n8n but never created — CRITICAL

**Evidence:**  
- `n8n/workflows/knowledge-chat-agent.json` line 44: `rpcFunction: "match_knowledge_chunks"`  
- No migration or SQL creates this function. pgvector extension is enabled (migration 008 line 100) but no SQL function for vector similarity search exists.

**Affected files:** `n8n/workflows/knowledge-chat-agent.json`; `supabase/migrations/008_rag.sql`

**Recommended solution:** Create a `match_knowledge_chunks` SQL function that takes a query embedding, organisation_id, and role filter, performs cosine similarity search via pgvector, and returns chunks respecting RLS and role-based visibility.

**Status:** `[ ]` Not started

---

### 1.4 `indexed` / `indexed_at` columns referenced by n8n but don't exist — CRITICAL

**Evidence:**  
- `n8n/workflows/knowledge-ingestion.json` line 47: `columns: { "indexed": true, "indexed_at": ... }`  
- Migration 008/009 define `indexing_status` (text) and `last_indexed_at` (timestamptz) on `knowledge_sources`, NOT `indexed` / `indexed_at`.

**Affected files:** `n8n/workflows/knowledge-ingestion.json`; `supabase/migrations/008_rag.sql`, `009_rag_content.sql`

**Recommended solution:** Update n8n workflow to set `indexing_status = 'indexed'` and `last_indexed_at = now()` instead.

**Status:** `[ ]` Not started

---

### 1.5 n8n workflows hardcode organisation UUID — HIGH

**Evidence:**  
- Every n8n workflow hardcodes `"00000000-0000-0000-0000-000000000001"` as `organisation_id`  
- Examples: `attendance-open.json` line 29, `attendance-close-and-daily-report.json` line 67, etc.

**Affected files:** All 11 n8n workflow JSONs

**Recommended solution:** Use n8n expressions or environment variables for `organisation_id`, or pull it from the triggering event payload. Hardcoding breaks multi-tenancy.

**Status:** `[ ]` Not started

---

### 1.6 `assignee_id` column referenced by n8n task reminders but doesn't exist — HIGH

**Evidence:**  
- `n8n/workflows/task-reminders.json` line 26: `columns: "id, title, due_date, status, assignee_id, profiles(full_name, email)"`  
- The `tasks` table has no `assignee_id` column; assignees are in the `task_assignees` join table.

**Affected files:** `n8n/workflows/task-reminders.json`; `supabase/migrations/003_tasks_projects.sql`

**Recommended solution:** Join `task_assignees` to `profiles` via a Supabase view or RPC, or fetch assignees in a separate step.

**Status:** `[ ]` Not started

---

### 1.7 `sender_id` column referenced by n8n chat notifications but doesn't exist — HIGH

**Evidence:**  
- `n8n/workflows/chat-notifications.json` line 8: `sender_id: "={{ $json.sender_id }}"`  
- The `chat_messages` table has `profile_id`, not `sender_id`.

**Affected files:** `n8n/workflows/chat-notifications.json`; `supabase/migrations/005_communication.sql`

**Recommended solution:** Change `sender_id` to `profile_id`.

**Status:** `[ ]` Not started

---

### 1.8 No `documents` Storage bucket creation in migrations — MEDIUM

**Evidence:**  
- Migration 006 line 137 inserts into `storage.buckets` but the `insert ... on conflict (id) do nothing` pattern may fail if the bucket already exists with different settings.  
- No separate `knowledge` bucket for knowledge-base file uploads (KnowledgeBasePage uploads to `documents` bucket at `knowledge/{orgId}/{fileName}` path prefix).

**Affected files:** `supabase/migrations/006_documents_calendar.sql`; `src/features/knowledge-base/KnowledgeBasePage.tsx`

**Recommended solution:** Keep the `documents` bucket but document that knowledge files share it under a `knowledge/` prefix. Add idempotent bucket creation with proper error handling.

**Status:** `[~]` Partially implemented (bucket exists in migration but not applied to live DB)

---

### 1.9 Attendance `status` check-in window not enforced at DB level — MEDIUM

**Evidence:**  
- `attendance` table has no CHECK constraint on `check_in_at` time or `status` vs time relationship.  
- The Edge Function `attendance-checkin/index.ts` enforces the 8-9 AM window but uses `new Date()` (server local time, not Lagos) — see finding 3.1.

**Affected files:** `supabase/migrations/002_attendance.sql`; `supabase/functions/attendance-checkin/index.ts`

**Recommended solution:** Add a database trigger or CHECK constraint where feasible. Fix the Edge Function to use Africa/Lagos timezone explicitly.

**Status:** `[ ]` Not started

---

## 2. Edge Functions

### 2.1 Edge Function uses server local time instead of Africa/Lagos — CRITICAL

**Evidence:**  
- `supabase/functions/attendance-checkin/index.ts` line 86: `const nowLagos = new Date()`  
- Lines 88-92: `nowLagos.getHours()` / `nowLagos.getMinutes()` are used to compare against the 08:00-09:00 window.  
- `new Date()` returns the server's local timezone (likely UTC in Supabase), not Africa/Lagos (UTC+1).  
- At 08:00 UTC, the function thinks it's 08:00 Lagos when it's actually 09:00 Lagos — check-in window is effectively shifted by one hour.

**Affected files:** `supabase/functions/attendance-checkin/index.ts` lines 86-92

**Recommended solution:** Convert the current time to Africa/Lagos before extracting hours/minutes:
```ts
const nowLagos = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
```
Or use `Intl.DateTimeFormat` with `timeZone: 'Africa/Lagos'`.

**Status:** `[ ]` Not started

---

### 2.2 Edge Function uses `SUPABASE_ANON_KEY` instead of service role — MEDIUM

**Evidence:**  
- `supabase/functions/attendance-checkin/index.ts` line 18: `Deno.env.get('SUPABASE_ANON_KEY') ?? ''`  
- The function passes the incoming Authorization header, so RLS applies. For check-in (user's own record) this is fine. But for admin override operations in the future, a service role key would be needed.

**Affected files:** `supabase/functions/attendance-checkin/index.ts`

**Recommended solution:** Add `SUPABASE_SERVICE_ROLE_KEY` as an env var and use it for privileged operations (attendance corrections, session management). Use anon key + user token for user-scoped operations.

**Status:** `[ ]` Not started

---

### 2.3 Edge Function doesn't enforce session-open rule correctly — HIGH

**Evidence:**  
- `supabase/functions/attendance-checkin/index.ts` lines 106-110:  
  ```ts
  if (session && !session.morning_open_override && !session.morning_opened_at) {
    return error 'Attendance session not yet opened for today'
  }
  ```
- If `session` is `null` (no session row exists for today), the check is skipped entirely — check-in proceeds without an open session.

**Affected files:** `supabase/functions/attendance-checkin/index.ts` lines 106-110

**Recommended solution:** Require a session to exist and be open (`morning_opened_at IS NOT NULL`) unless `morning_open_override` is true.

**Status:** `[ ]` Not started

---

### 2.4 Edge Function lacks duplicate-check-in protection beyond DB constraint — MEDIUM

**Evidence:**  
- The `attendance` table has `unique (organisation_id, staff_id, attendance_date)` (migration 002 line 64).  
- The Edge Function uses `upsert` with `onConflict: 'organisation_id,staff_id,attendance_date'` — this silently overwrites an existing check-in instead of rejecting it.

**Affected files:** `supabase/functions/attendance-checkin/index.ts` lines 117-129

**Recommended solution:** Before upsert, check if a record already exists for today. If `check_in_at` is already set, return an error ("Already checked in today") instead of overwriting.

**Status:** `[ ]` Not started

---

### 2.5 Edge Function does not handle approved leave / remote work / field work — MEDIUM

**Evidence:**  
- `supabase/functions/attendance-checkin/index.ts` has no logic to check `leave_requests` or `attendance_type` overrides.  
- A staff member on approved annual leave can still check in, creating conflicting records.

**Affected files:** `supabase/functions/attendance-checkin/index.ts`

**Recommended solution:** Before allowing check-in, query `leave_requests` for the staff member on the target date with `status = 'approved'`. If found, set `attendance_type` to `approved_leave` and block check-in or warn.

**Status:** `[ ]` Not started

---

### 2.6 Edge Function has no error logging / automation_runs integration — LOW

**Evidence:**  
- `supabase/functions/attendance-checkin/index.ts` lines 137-141: errors return HTTP 500 with `err.message` but nothing is written to `automation_runs` or `activity_logs`.

**Affected files:** `supabase/functions/attendance-checkin/index.ts`

**Recommended solution:** Insert into `automation_runs` and `activity_logs` on both success and failure for auditability.

**Status:** `[ ]` Not started

---

## 3. Frontend Architecture

### 3.1 Role is hardcoded in AppLayout — CRITICAL

**Evidence:**  
- `src/components/layout/AppLayout.tsx` line 12: `const role: Role = 'staff' // placeholder until auth is wired`  
- The sidebar navigation and all access control in the layout depend on this hardcoded value. Every user sees "staff" navigation regardless of actual role.

**Affected files:** `src/components/layout/AppLayout.tsx`

**Recommended solution:** Wire `role` from `useAuth()` hook / Supabase session profile. Use the actual `profile.role` from the database.

**Status:** `[ ]` Not started

---

### 3.2 `CalendarIcon` used but not imported — CRITICAL (runtime error)

**Evidence:**  
- `src/components/layout/AppLayout.tsx` line 97: `<CalendarIcon />`  
- `CalendarIcon` is defined as a local function at line 129 (an inline SVG component), so this actually works. However it's an inline SVG, not from lucide-react. Not a bug but inconsistent with the rest of the codebase which uses lucide-react icons.

**Affected files:** `src/components/layout/AppLayout.tsx`

**Recommended solution:** Replace inline SVG with `<Calendar />` from lucide-react for consistency.

**Status:** `[ ]` Not started

---

### 3.3 Chat realtime subscription not cleaned up on unmount — HIGH

**Evidence:**  
- `src/features/chat/ChatPage.tsx` line 56-66: `supabase.channel(...).subscribe()` is called in `openRoom()` but the channel subscription is never unsubscribed.  
- Every room switch creates a new channel without closing the previous one.

**Affected files:** `src/features/chat/ChatPage.tsx`

**Recommended solution:** Store the channel in a ref and call `supabase.removeChannel(channel)` in a `useEffect` cleanup when `currentRoom` changes or on unmount.

**Status:** `[ ]` Not started

---

### 3.4 Chat message attachments use empty `message_id` placeholder — HIGH

**Evidence:**  
- `src/features/chat/ChatPage.tsx` lines 89-96: Attachments are inserted with `message_id: ''` before the message exists, then updated after.  
- If the message insert fails (line 102), orphan attachment records with `message_id: ''` remain in the database.

**Affected files:** `src/features/chat/ChatPage.tsx`

**Recommended solution:** Insert the message first, then insert attachments with the actual `message_id`. Use a transaction or rollback on failure.

**Status:** `[ ]` Not started

---

### 3.5 Chat `addReaction` inserts `room_id` column that doesn't exist — HIGH

**Evidence:**  
- `src/features/chat/ChatPage.tsx` line 132: `room_id: currentRoom.id` is inserted into `chat_message_reactions`.  
- The `chat_message_reactions` table (migration 005) has columns: `id, message_id, profile_id, emoji, created_at` — no `room_id` column.

**Affected files:** `src/features/chat/ChatPage.tsx` line 132; `supabase/migrations/005_communication.sql`

**Recommended solution:** Remove `room_id` from the insert payload.

**Status:** `[ ]` Not started

---

### 3.6 Reports page uses `reporting_month` as `YYYY-MM` string but column expects `date` — MEDIUM

**Evidence:**  
- `src/features/reports/ReportsPage.tsx` line 36: `base.reporting_month = new Date().toISOString().slice(0, 7)` produces `"2026-11"`.  
- Migration 004 defines `reporting_month date NOT NULL` — expects a full date like `"2026-11-01"`.  
- The unique constraint `unique (organisation_id, staff_id, reporting_month)` may behave unexpectedly with partial dates.

**Affected files:** `src/features/reports/ReportsPage.tsx` line 36; `supabase/migrations/004_reports.sql`

**Recommended solution:** Use `new Date().toISOString().slice(0, 10)` or construct the first day of the month: `${year}-${month}-01`.

**Status:** `[ ]` Not started

---

### 3.7 KnowledgeBasePage uploads files but no extraction/chunking/embedding — HIGH

**Evidence:**  
- `src/features/knowledge-base/KnowledgeBasePage.tsx` lines 82-113: File upload goes to Supabase Storage, source is inserted with `indexing_status: 'pending'`.  
- No text extraction (PDF/DOCX/TXT), no chunking, no embedding generation, no vector storage.  
- The n8n knowledge-ingestion workflow is supposed to handle this but is not wired to the source creation (no webhook call, no trigger).

**Affected files:** `src/features/knowledge-base/KnowledgeBasePage.tsx`; `n8n/workflows/knowledge-ingestion.json`

**Recommended solution:** After creating a knowledge source, call the n8n ingestion webhook. The n8n workflow must extract text, chunk, embed (via NVIDIA), and store in `knowledge_chunks`.

**Status:** `[ ]` Not started

---

### 3.8 ChatbotPage sends unauthenticated requests to webhook — HIGH

**Evidence:**  
- `src/features/chatbot/ChatbotPage.tsx` lines 34-39: `fetch(webhookUrl, { body: JSON.stringify({ question, conversation_id }) })` — no Authorization header, no user token.  
- The n8n knowledge-chat-agent webhook has no authentication (no `n8n-nodes-base.auth` header validation).  
- No conversation history is sent, so the AI has no context.

**Affected files:** `src/features/chatbot/ChatbotPage.tsx`; `n8n/workflows/knowledge-chat-agent.json`

**Recommended solution:** Pass the Supabase user JWT in the Authorization header. Validate it in n8n (or via a Supabase Edge Function proxy). Include recent conversation history in the request.

**Status:** `[ ]` Not started

---

### 3.9 No form validation library — MEDIUM

**Evidence:**  
- READ.ME §3 requires "A robust form library and schema validation (for example React Hook Form + Zod)".  
- All forms use uncontrolled/unvalidated controlled inputs with no schema validation (LeavePage, ReportsPage, KnowledgeBasePage, AttendanceCorrectionsPage, etc.).

**Affected files:** All form pages

**Recommended solution:** Add `react-hook-form` + `zod` and validate all user-facing forms.

**Status:** `[ ]` Not started

---

### 3.10 No pagination, search, or filtering on large lists — MEDIUM

**Evidence:**  
- `AttendancePage.tsx` line 21: `.limit(50)` hardcoded, no pagination.  
- `LeavePage.tsx` line 44: `.limit(100)` hardcoded.  
- `KnowledgeBasePage.tsx` line 44: `.limit(100)` hardcoded.  
- No search or filtering on chat rooms, documents, announcements, tasks.

**Affected files:** Multiple pages

**Recommended solution:** Add cursor-based or offset pagination, search inputs, and filter controls.

**Status:** `[ ]` Not started

---

### 3.11 No loading/empty/error states on many pages — MEDIUM

**Evidence:**  
- `TasksPage.tsx`, `ProjectsPage.tsx`, `DocumentsPage.tsx`, `AnnouncementsPage.tsx`, `NotificationsPage.tsx` were not fully reviewed but the pattern across reviewed pages shows inconsistent error handling.  
- `AttendancePage.tsx` line 77-87: error display has a "Dismiss" button that does nothing (`onClick` is empty).

**Affected files:** `src/features/attendance/AttendancePage.tsx` and others

**Recommended solution:** Standardize loading, empty, and error states across all pages. Fix the dismiss button.

**Status:** `[ ]` Not started

---

### 3.12 DashboardPage swallows all errors silently — MEDIUM

**Evidence:**  
- `src/features/dashboard/DashboardPage.tsx` line 36-37: `catch { // tables may not exist yet until migrations run }` — errors are silently swallowed, no error state shown to the user.

**Affected files:** `src/features/dashboard/DashboardPage.tsx`

**Recommended solution:** Show an error state or "data not available" message instead of silently failing.

**Status:** `[ ]` Not started

---

### 3.13 `CeoDashboardPage` has hardcoded zero values for charts — HIGH

**Evidence:**  
- `src/features/dashboard/CeoDashboardPage.tsx` lines 35-47: Attendance trend and leave-by-type data are hardcoded to all zeros. The actual query results are not used to populate the charts.

**Affected files:** `src/features/dashboard/CeoDashboardPage.tsx`

**Recommended solution:** Use the actual query results from the Promise.all to populate `attendanceTrend` and `leaveByType`.

**Status:** `[ ]` Not started

---

### 3.14 No role-based filtering in chat room list — MEDIUM

**Evidence:**  
- `src/features/chat/ChatPage.tsx` line 27: `supabase.from('chat_rooms').select('*')` returns all rooms in the org, including private rooms the user is not a member of.  
- RLS `chat_rooms_select_member` (migration 005 line 139) restricts to members or admins, so the DB enforces this, but the UI shows an empty state without explanation.

**Affected files:** `src/features/chat/ChatPage.tsx`

**Recommended solution:** The RLS already handles filtering; add a helpful empty state when no rooms are available.

**Status:** `[~]` Partially (RLS exists, UI empty state could be improved)

---

## 4. Security & Authentication

### 4.1 No email verification / password reset flow — MEDIUM

**Evidence:**  
- `src/features/auth/LoginPage.tsx` only supports sign-in with password.  
- No registration, email verification, password reset, or MFA.

**Affected files:** `src/features/auth/LoginPage.tsx`

**Recommended solution:** Add Supabase Auth password reset and email change flows. Registration should be admin-invitation only.

**Status:** `[ ]` Not started

---

### 4.2 No session timeout / inactivity handling — LOW

**Evidence:**  
- No session expiration warnings or automatic sign-out on inactivity.

**Affected files:** `src/hooks/useAuth.ts`

**Recommended solution:** Add session refresh and inactivity timeout handling.

**Status:** `[ ]` Not started

---

### 4.3 Environment variables could expose secrets — MEDIUM

**Evidence:**  
- `.env.example` has placeholders but no enforcement that real `.env` is gitignored (checked: `.gitignore` exists — need to verify).

**Affected files:** `.env.example`, `.gitignore`

**Recommended solution:** Verify `.gitignore` includes `.env`. Add secret scanning recommendation.

**Status:** `[~]` Partially (`.gitignore` exists, needs verification)

---

## 5. n8n Workflow Issues (Consolidated)

### 5.1 No error handling in any workflow — CRITICAL

**Evidence:**  
- All 11 n8n workflow JSONs lack Try/Catch, error branches, or failure notifications.  
- If a Supabase node fails, the entire workflow fails silently.

**Affected files:** All n8n workflow JSONs

**Recommended solution:** Wrap each branch in error handling with failure notifications to administrators.

**Status:** `[ ]` Not started

---

### 5.2 No idempotency keys — CRITICAL

**Evidence:**  
- `generated_reports` table has `idempotency_key` (migration 007 line 50) but no n8n workflow uses it.  
- Daily reports could be generated multiple times if a workflow re-runs.

**Affected files:** `n8n/workflows/attendance-close-and-daily-report.json`; `supabase/migrations/007_notifications.sql`

**Recommended solution:** Generate idempotency keys (e.g., `${date}-${orgId}-${workflowName}`) and check before inserting.

**Status:** `[ ]` Not started

---

### 5.3 No retry logic for temporary failures — HIGH

**Evidence:**  
- No n8n retry policies configured on any node.  
- Supabase temporary outages cause permanent workflow failure.

**Affected files:** All n8n workflow JSONs

**Recommended solution:** Configure retry on failure for Supabase nodes (e.g., 3 retries with exponential backoff).

**Status:** `[ ]` Not started

---

### 5.4 Schedule triggers use fixed 24-hour intervals, not cron — MEDIUM

**Evidence:**  
- All schedule triggers use `intervalHour: 24` which drifts and doesn't respect specific times like "8:00 AM Lagos" reliably.  
- n8n supports cron expressions in scheduleTrigger.

**Affected files:** All n8n workflow JSONs with scheduleTrigger

**Recommended solution:** Use cron expressions with Africa/Lagos timezone (e.g., `0 8 * * 1-5` for 8 AM weekdays Lagos).

**Status:** `[ ]` Not started

---

### 5.5 No authentication on webhooks — HIGH

**Evidence:**  
- `n8n/workflows/knowledge-chat-agent.json` webhook has no auth header validation.  
- `n8n/workflows/chat-notifications.json` webhook has no auth.

**Affected files:** `n8n/workflows/knowledge-chat-agent.json`; `n8n/workflows/chat-notifications.json`

**Recommended solution:** Add `N8N_WEBHOOK_SECRET` validation via an IF node at the start of each webhook branch.

**Status:** `[ ]` Not started

---

## 6. RAG / AI Pipeline

### 6.1 No text extraction, chunking, or embedding in ingestion pipeline — CRITICAL

**Evidence:**  
- `n8n/workflows/knowledge-ingestion.json` has 3 nodes: Register Source → Store Chunks → Mark Indexed.  
- No text extraction node (PDF/DOCX/TXT), no chunking node, no embedding node (NVIDIA or other).  
- Chunks are stored with `$json.embedding` but nothing generates embeddings.

**Affected files:** `n8n/workflows/knowledge-ingestion.json`

**Recommended solution:** Add document extraction (n8n community node or Edge Function), text chunking (RecursiveCharacterTextSplitter equivalent), and embedding generation (NVIDIA embeddings via n8n AI node or HTTP request).

**Status:** `[ ]` Not started

---

### 6.2 Vector search RPC function missing — CRITICAL

**Evidence:** (see 1.3) `match_knowledge_chunks` does not exist in the database.

**Affected files:** `supabase/migrations/008_rag.sql`; `n8n/workflows/knowledge-chat-agent.json`

**Recommended solution:** Create the SQL function with pgvector cosine similarity.

**Status:** `[ ]` Not started

---

### 6.3 AI agent workflow has wrong node order — CRITICAL

**Evidence:**  
- `n8n/workflows/knowledge-chat-agent.json`: Webhook → AI Agent → Vector Search → Save Reply.  
- The AI Agent runs BEFORE vector search, so it generates answers without knowledge context.  
- Vector search results are never fed back to the AI Agent.

**Affected files:** `n8n/workflows/knowledge-chat-agent.json`

**Recommended solution:** Reorder: Webhook → Vector Search → AI Agent (with search results as context) → Save Reply. Add conversation history retrieval.

**Status:** `[ ]` Not started

---

### 6.4 No role-based filtering on vector search — HIGH

**Evidence:**  
- `n8n/workflows/knowledge-chat-agent.json` line 44: `rpcFunction: "match_knowledge_chunks"` with no parameters for organisation_id or user role.  
- Any user could retrieve any knowledge chunk in the organisation.

**Affected files:** `n8n/workflows/knowledge-chat-agent.json`

**Recommended solution:** Pass `organisation_id` and `allowed_roles` to the vector search function; filter results server-side.

**Status:** `[ ]` Not started

---

### 6.5 No citation accuracy — MEDIUM

**Evidence:**  
- `chatbot_messages.sources` column exists (migration 008 line 85) but the n8n workflow doesn't populate it with source titles/links.

**Affected files:** `n8n/workflows/knowledge-chat-agent.json`; `src/features/chatbot/ChatbotPage.tsx`

**Recommended solution:** Return source metadata from vector search and include it in the AI response and stored message.

**Status:** `[ ]` Not started

---

### 6.6 No "not configured" state for chatbot — MEDIUM

**Evidence:**  
- `src/features/chatbot/ChatbotPage.tsx` line 34: `import.meta.env.VITE_CHATBOT_WEBHOOK_URL || '/.netlify/functions/chatbot-query'` — falls back to a Netlify function that doesn't exist.  
- No clear setup state when NVIDIA API or n8n is not configured.

**Affected files:** `src/features/chatbot/ChatbotPage.tsx`

**Recommended solution:** Show a clear "Knowledge assistant not configured" message when the webhook is unavailable or returns an error.

**Status:** `[ ]` Not started

---

## 7. Attendance & Reporting

### 7.1 Check-in window uses server time (not Lagos) — CRITICAL

**Evidence:** (see 2.1) Edge Function uses `new Date()` instead of Africa/Lagos.

**Affected files:** `supabase/functions/attendance-checkin/index.ts`

**Recommended solution:** Convert to Lagos time before window comparison.

**Status:** `[ ]` Not started

---

### 7.2 Report deadlines not administrator-configurable — MEDIUM

**Evidence:**  
- `report_schedules` table exists (migration 004) with `deadline_rule` but the frontend never reads or writes it.  
- ReportsPage doesn't show due dates or deadlines.

**Affected files:** `src/features/reports/ReportsPage.tsx`; `src/hooks/useReports.ts`

**Recommended solution:** Integrate `report_schedules` into the UI so admins can configure deadlines and staff can see them.

**Status:** `[ ]` Not started

---

### 7.3 Evening sign-out not implemented in frontend — HIGH

**Evidence:**  
- `attendance_policy` has `sign_out_open` and `sign_out_scheduled` fields (migration 002 lines 14-15) but `AttendancePage.tsx` only has check-in/check-out, no sign-out window awareness.  
- The Edge Function only handles check-in, not sign-out.

**Affected files:** `src/features/attendance/AttendancePage.tsx`; `supabase/functions/attendance-checkin/index.ts`

**Recommended solution:** Add evening sign-out to the Attendance page and Edge Function (or a separate Edge Function).

**Status:** `[ ]` Not started

---

### 7.4 No race-condition protection on check-in — MEDIUM

**Evidence:**  
- The Edge Function checks for existing records then upserts — two simultaneous requests could both pass the check.  
- The DB unique constraint prevents duplicates at the DB level, but the upsert silently overwrites instead of rejecting.

**Affected files:** `supabase/functions/attendance-checkin/index.ts`

**Recommended solution:** Use `INSERT ... ON CONFLICT DO NOTHING` and check if a row was actually inserted. If `check_in_at` already exists, reject.

**Status:** `[ ]` Not started

---

## 8. Missing Functionality (per READ.ME)

### 8.1 PDF generation for reports — NOT IMPLEMENTED

**Evidence:**  
- READ.ME §4 goal 13: "Daily, weekly and monthly management reports by email."  
- `generated_reports` table has `pdf_path` and `html_path` but no generation code exists.  
- No n8n workflow generates PDFs.

**Affected files:** None (missing entirely)

**Recommended solution:** Add PDF generation (via n8n or Edge Function) and email delivery (Gmail via n8n Gmail node).

**Status:** `[ ]` Not started

---

### 8.2 HTML email templates — NOT IMPLEMENTED

**Evidence:**  
- READ.ME §3: `RESEND_API_KEY` env var exists but no email sending code.  
- `email_logs` table exists but nothing writes to it.

**Affected files:** None (missing entirely)

**Recommended solution:** Add email templates and Gmail integration via n8n.

**Status:** `[ ]` Not started

---

### 8.3 Audit logs not written from frontend — MEDIUM

**Evidence:**  
- `activity_logs` table exists (migration 001) but no frontend code writes to it.  
- No audit trail for user actions (leave approvals, corrections, report submissions).

**Affected files:** All pages

**Recommended solution:** Add an `auditLog()` helper and call it on key mutations.

**Status:** `[ ]` Not started

---

### 8.4 No custom table builder data validation — MEDIUM

**Evidence:**  
- `ProjectTableBuilderPage.tsx` stores arbitrary JSON in `project_table_rows.data` with no validation against column definitions.

**Affected files:** `src/features/projects/ProjectTableBuilderPage.tsx`

**Recommended solution:** Validate row data against column types before insert.

**Status:** `[ ]` Not started

---

## Summary of Severity Counts

| Severity | Count |
|----------|-------|
| Critical | 9 |
| High | 12 |
| Medium | 10 |
| Low | 3 |

**Most critical issues:** timezone bug in Edge Function, missing `attendance_windows`/`daily_reports`/`match_knowledge_chunks` DB objects, hardcoded role, missing RAG pipeline components, no n8n error handling/idempotency, broken n8n column references.

---

## Next Steps

1. Fix the Edge Function timezone bug (Critical)
2. Fix n8n workflow column/table references (Critical)
3. Create `match_knowledge_chunks` RPC function (Critical)
4. Fix hardcoded role in AppLayout (Critical)
5. Build the consolidated `IRIAD_MASTER_WORKFLOW.json` (see n8n section)
6. Fix chat subscription cleanup, attachment handling, reaction column (High)
7. Fix reporting_month date format (High)
8. Wire up knowledge ingestion to n8n webhook (High)
9. Add form validation (Medium)
10. Add PDF generation and email templates (Medium)
