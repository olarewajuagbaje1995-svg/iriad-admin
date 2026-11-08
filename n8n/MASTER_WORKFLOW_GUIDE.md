# IRIAD Master Workflow — Guide

This document describes the **IRIAD Master Workflow** (`n8n/IRIAD_MASTER_WORKFLOW.json`), the single consolidated n8n workflow that replaces the previous collection of 11 separate workflow files.

## Overview

The master workflow consolidates all automation into **8 independent sections**, each with its own trigger branch. A failure in one section cannot break another because each section starts from its own trigger node.

### Section 1 — Attendance Automation
| Trigger | Time (Africa/Lagos) | Days | Action |
|---------|---------------------|------|--------|
| Open check-in | 08:00 | Mon–Fri | Upsert `attendance_sessions`, notify staff check-in is open |
| Close check-in | 09:05 | Mon–Fri | Close session, fetch today's attendance, remind staff who haven't checked in |
| Open sign-out | 17:00 | Mon–Fri | Upsert `attendance_sessions` sign-out window |
| Close sign-out | 18:05 | Mon–Fri | Close session, detect incomplete records (checked in but not out), alert staff |

### Section 2 — Daily Notifications & Reminders
| Trigger | Time (Africa/Lagos) | Days | Action |
|---------|---------------------|------|--------|
| Daily reminders | 09:00 | Mon–Fri | Fetch overdue tasks → send reminders; fetch upcoming events → send reminders |

### Section 3 — Weekly & Monthly Reports
| Trigger | Time (Africa/Lagos) | Schedule | Action |
|---------|---------------------|----------|--------|
| Weekly report | 16:00 | Fridays | Fetch weekly reports → create `generated_reports` record (idempotency key) → notify |
| Monthly report | 17:00 | Last day of month | Fetch monthly reports → create `generated_reports` record (idempotency key) → notify |

### Section 4 — Management Reporting
| Trigger | Time (Africa/Lagos) | Schedule | Action |
|---------|---------------------|----------|--------|
| Daily summary | 19:00 | Mon–Fri | Create daily `generated_reports` record (idempotency key) |
| Weekly summary | 09:00 | Mondays | Create weekly `generated_reports` record (idempotency key) |
| Monthly summary | 09:00 | 1st of month | Create monthly `generated_reports` record (idempotency key) |

### Section 5 — Announcements & Communication
| Trigger | Path | Action |
|---------|------|--------|
| Announcement webhook | `POST /webhook/announcement` | Validate secret → create announcement → fetch active staff → notify each |
| Ack reminders | 10:00, Mon–Fri | Fetch published announcements → (acknowledgement reminder logic) |

### Section 6 — Document & Knowledge Processing
| Trigger | Path | Action |
|---------|------|--------|
| Knowledge ingest webhook | `POST /webhook/knowledge-ingest` | Validate secret → fetch source → extract text (file) → generate embeddings (NVIDIA) → store chunks → mark indexed |

### Section 7 — AI Assistant & RAG
| Trigger | Path | Action |
|---------|------|--------|
| Knowledge chat webhook | `POST /webhook/knowledge-chat` | Validate secret → get user profile → load history → generate query embedding → vector search (role-filtered `match_knowledge_chunks` RPC) → NVIDIA AI response → save reply with citations |

### Section 8 — Error Handling & Monitoring
Integrated throughout: every failure branch logs to `automation_runs` and notifies administrators via `notifications`.

## Design Principles

- **No hardcoded secrets**: Organisation ID, webhook secret, Supabase keys, and NVIDIA key are all referenced via n8n environment variables (`$env.VARIABLE_NAME`).
- **No hardcoded organisation UUID**: Use `$env.IRIAD_ORGANISATION_ID` instead of a literal UUID.
- **Idempotency**: Report generation uses `idempotency_key` (e.g. `weekly-2026-W45-<org-id>`) to prevent duplicate reports.
- **Role-filtered RAG**: Vector search calls `match_knowledge_chunks` RPC which enforces RLS and role-based visibility.
- **Independent branches**: Each section has its own schedule/webhook trigger; one section's failure does not cascade.

## Prerequisites

- n8n installed and running (self-hosted, n8n cloud, or Docker)
- Supabase project with IRIAD schema migrated (migrations `001`–`009`, plus the `match_knowledge_chunks` RPC function migration)
- NVIDIA API key for embeddings and LLM
- Supabase service role key (server-side only)

## Importing the Master Workflow

1. Open n8n and go to **Workflows**.
2. Click **Import from file** → select `n8n/IRIAD_MASTER_WORKFLOW.json`.
3. The workflow appears inactive by default.
4. For each **Supabase** node, select/create the **IRIAD Supabase** credential (service role key).
5. For each **HTTP Request** node calling NVIDIA, select/create the **NVIDIA API** credential.
6. Confirm every **Schedule Trigger** has timezone **Africa/Lagos**.
7. Click **Save**, then toggle the workflow **Active**.

## Required n8n Credentials

| Credential | Used by | Key field |
|------------|---------|-----------|
| `IRIAD Supabase` | All Supabase nodes | API Key = `SUPABASE_SERVICE_ROLE_KEY` |
| `NVIDIA API` | Embeddings + LLM HTTP Request nodes | API Key = `NVIDIA_API_KEY` |
| `Gmail` | All email delivery nodes | OAuth2 credential for Gmail sending |

## Required Environment Variables

Set these in n8n (**Settings → Environment Variables**) or in your n8n `.env`:

| Variable | Purpose | Example |
|----------|---------|---------|
| `N8N_BASE_URL` | Base URL for n8n webhooks | `http://localhost:5678` |
| `N8N_WEBHOOK_SECRET` | Shared secret for webhook authentication | `changeme-strong-secret` |
| `IRIAD_ORGANISATION_ID` | IRIAD organisation UUID | `a1b2c3d4-...` |
| `SUPABASE_URL` | Supabase project URL | `https://ref.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) | `eyJ...` |
| `NVIDIA_API_KEY` | NVIDIA NIM API key | `nvapi-...` |
| `ADMIN_EMAIL` | Admin email for system alerts and error notifications | `olarewajuagbaje@gmail.com` |

## Webhook Endpoints

| Endpoint | Method | Section | Auth |
|----------|--------|---------|------|
| `/webhook/announcement` | POST | 5 — Announcements | `x-webhook-secret` header |
| `/webhook/knowledge-ingest` | POST | 6 — Knowledge Processing | `x-webhook-secret` header |
| `/webhook/knowledge-chat` | POST | 7 — AI Assistant & RAG | `x-webhook-secret` header |

Example announcement call:

```bash
curl -X POST "${N8N_BASE_URL}/webhook/announcement" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: ${N8N_WEBHOOK_SECRET}" \
  -d '{"title": "Office closed Friday", "body": "The office will be closed this Friday for a public holiday.", "category": "operations", "created_by": "<user-id>"}'
```

Example knowledge chat call:

```bash
curl -X POST "${N8N_BASE_URL}/webhook/knowledge-chat" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: ${N8N_WEBHOOK_SECRET}" \
  -d '{"question": "What is the IRIAD leave policy?", "conversation_id": "<conv-id>", "profile_id": "<user-id>"}'
```

## Supabase Dependencies

The master workflow relies on these database objects:

| Object | Type | Notes |
|--------|------|-------|
| `attendance_sessions` | Table | Migration `002` |
| `attendance` | Table | Migration `002` |
| `notifications` | Table | Migration `007` |
| `generated_reports` | Table | Migration `007` |
| `weekly_reports` | Table | Migration `004` |
| `monthly_reports` | Table | Migration `004` |
| `tasks` | Table | Migration `003` |
| `calendar_events` | Table | Migration `006` |
| `announcements` | Table | Migration `005` |
| `profiles` | Table | Migration `001` |
| `knowledge_sources` | Table | Migration `008` |
| `knowledge_chunks` | Table | Migration `008` |
| `knowledge_ingestion_jobs` | Table | Migration `008` |
| `chatbot_messages` | Table | Migration `005` |
| `chatbot_conversations` | Table | Migration `005` |
| `automation_runs` | Table | Migration `007` |
| `match_knowledge_chunks` | RPC function | **Must be created** — see Migration 010 below |

## Migration 010 — match_knowledge_chunks RPC

Create this SQL function in Supabase (pgvector cosine similarity):

```sql
create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 10,
  p_organisation_id uuid default null,
  p_allowed_roles text[] default null
)
returns table (
  id uuid,
  source_id uuid,
  content text,
  similarity float,
  metadata jsonb,
  visibility text,
  allowed_roles text[]
)
language plpgsql
as $$
begin
  return query
  select
    kc.id,
    kc.source_id,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity,
    kc.metadata,
    kc.visibility,
    kc.allowed_roles
  from knowledge_chunks kc
  where kc.embedding is not null
    and (p_organisation_id is null or kc.organisation_id = p_organisation_id)
    and (p_allowed_roles is null or kc.allowed_roles && p_allowed_roles)
    and (kc.visibility = 'all_staff' or kc.allowed_roles && p_allowed_roles)
    and (1 - (kc.embedding <=> query_embedding)) > match_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

Enable RLS on `knowledge_chunks` with policies that restrict access by `organisation_id`, `visibility`, and `allowed_roles`.

## Relationship to Legacy Workflows

The master workflow replaces these 11 legacy files (which have been archived to `n8n/workflows/archived/`):

| Legacy file | Consolidated into |
|-------------|-------------------|
| `attendance-open.json` | Section 1 — 08:00 check-in open |
| `attendance-close-and-daily-report.json` | Section 1 — 09:05 check-in close |
| `evening-signout-open-close.json` | Section 1 — 17:00/18:05 sign-out |
| `attendance-reminders.json` | Section 1 — missing check-in reminders |
| `task-reminders.json` | Section 2 — task reminders |
| `weekly-management-report.json` | Section 3 — weekly report |
| `monthly-management-report.json` | Section 3 — monthly report |
| `announcement-email-notification.json` | Section 5 — announcements |
| `chat-notifications.json` | Section 5 — communication |
| `knowledge-ingestion.json` | Section 6 — knowledge processing |
| `knowledge-chat-agent.json` | Section 7 — AI assistant & RAG |

## Troubleshooting

| Problem | Likely cause / fix |
|---------|-------------------|
| Supabase node returns `401` / permission denied | Use the **service role key**, not the anon key. Confirm the credential is selected in the node. |
| Schedule trigger never fires | Confirm the workflow is **Active** and the trigger timezone is **Africa/Lagos**. |
| Webhook returns `404` | Confirm the master workflow is active and the webhook path matches exactly. |
| Knowledge ingestion fails | Confirm `NVIDIA_API_KEY` is set and the `knowledge-extract` Edge Function is deployed. |
| Vector search returns no results | Confirm `match_knowledge_chunks` RPC exists and chunks have embeddings. |
| Duplicate reports | Idempotency keys prevent duplicates; check `generated_reports` for existing keys. |
| Gmail node fails to send | Confirm the **Gmail** OAuth2 credential is selected in each Gmail node. Confirm `ADMIN_EMAIL` env var is set. |
| Email not received by staff | Confirm staff profiles have valid `email` values. Confirm Gmail credential has sending permissions. |
