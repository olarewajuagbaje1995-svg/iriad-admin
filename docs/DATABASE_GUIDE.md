# IRIAD Operations Portal — Database Guide

**Source:** `supabase/migrations/001–008.sql`, `src/types/database.ts`  
**Scope:** 52 tables, all tenant-scoped by `organisation_id`, RLS enabled on every table (~101 policies).

## 1. Design principles

- **Multi-tenancy:** every org-scoped table carries `organisation_id` referencing `organisations.id`; RLS policies restrict rows to the user's organisation.
- **Auth integration:** `profiles.id` references `auth.users.id`; Supabase Auth session drives `auth.uid()`.
- **Audit:** `created_at`/`updated_at` on most tables; `task_updates`, `activity_logs`, `email_logs`, `automation_runs` capture change history.
- **Soft deletes / status:** status enums used where hard delete is inappropriate (attendance status, task status, report status).

## 2. Core table groups

### Organisations & people
- `organisations` — one per tenant (IRIAD is the seed org)
- `departments` — belongs to an organisation
- `profiles` — staff/users; `role` ∈ {staff, staff_admin, ceo, super_admin}; `organisation_id`, `department_id`
- `members` — project/department memberships

### Attendance
- `attendance_policy` — per-org check-in window, working days, grace, reminders
- `attendance_calendar` — workdays/holidays
- `attendance_sessions` — check-in/check-out sessions
- `attendance_records` — daily attendance (unique staff+date)
- `attendance_corrections` — override requests with audit trail
- `leave` — leave/remote/field-work requests

### Tasks & projects
- `projects`, `project_members`, `project_milestones`, `project_deliverables`, `project_reviews`
- `custom_tables`, `custom_columns`, `custom_rows` — custom project table builder
- `tasks`, `task_assignees`, `task_updates` — CRUD + status history

### Reports
- `reporting_periods`, `weekly_reports`, `monthly_reports`, `report_reviews`, `report_schedules`

### Communication
- `chat_rooms`, `chat_room_members`, `chat_messages`, `chat_attachments`, `chat_reactions`, `chat_reads`
- `announcements`, `announcement_comments`, `announcement_reads`
- `notifications`, `email_report_recipients`, `generated_reports`, `email_logs`, `automation_runs`

### Knowledge base / RAG
- `knowledge_collections`, `knowledge_sources`, `knowledge_chunks` (embedding `vector(1536)`)
- `ingestion_jobs`, `chatbot_conversations`, `chatbot_messages`, `chatbot_feedback`

## 3. Row Level Security

RLS is enabled on all 52 tables. Policies enforce:
- Users can read profiles/attendance/tasks/reports only within their `organisation_id`.
- `staff_admin`/`super_admin` can manage staff and org-wide settings.
- Chat messages readable only by room members (`chat_room_members`).
- Knowledge chunks filtered by source/collection access.

## 4. pgvector (RAG)

`knowledge_chunks.embedding` is `vector(1536)` (NVIDIA embedding dimension). Similarity search via the `match_knowledge_chunks` RPC (cosine distance), used by the n8n knowledge-chat-agent workflow.

## 5. Seed data

`supabase/seed.sql` creates the IRIAD organisation, departments, attendance policy, system settings, reporting periods, and email recipients. Real `profiles` require real Supabase Auth users (created via dashboard or auth API) — seed profiles are commented out to avoid referencing non-existent auth users.

## 6. TypeScript types

`src/types/database.ts` generates `Database` with `Row`, `Insert`, `Update` per table. Supabase client is loosely typed (`createClient()` without generic) to avoid `never` issues on `.from('X')`.
