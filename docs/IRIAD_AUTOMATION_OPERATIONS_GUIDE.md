# IRIAD Operations Portal — Automation Operations Guide

**Product:** IRIAD Operations Portal  
**Audience:** Administrators and operators responsible for the automation engines  
**Date:** 2026-11-08  
**Prepared by:** Claude Code

---

## 1. Overview

IRIAD uses a **dual automation engine** architecture:

- **n8n** is the permanent **primary** automation engine. Existing workflows are preserved unchanged and remain the first choice for executing business operations.
- A **native backup engine** (Supabase Edge Functions + PostgreSQL) runs the equivalent business operations when n8n is unhealthy or unavailable.

The two engines share one central job registry (`automation_jobs`) and one idempotency layer (`automation_idempotency`) so no business operation executes twice, even during failover.

> **Status:** The native backup engine Edge Functions exist in `supabase/functions/automation-*`, but the database tables they depend on (`automation_jobs`, `automation_idempotency`, `automation_engines`, `claim_automation_job()`) come from planned migrations **011** and **012**, which are **not yet applied**. The native engine cannot run against live data until those migrations are created, reviewed, and approved. n8n is also not yet live (workflows inactive, no credentials configured).

---

## 2. How the primary engine (n8n) works

n8n executes the consolidated `IRIAD_MASTER_WORKFLOW.json`:

- **92 nodes, 62 connections, 8 independent sections.** Each section has its own trigger, so a failure in one section does not cascade to the others.
- **All schedule triggers use Africa/Lagos time.**
- **3 webhook endpoints**, each validated with `x-webhook-secret` against `$env.N8N_WEBHOOK_SECRET`:
  - `/webhook/announcement`
  - `/webhook/knowledge-ingest`
  - `/webhook/knowledge-chat`
- **Email delivery:** 9 native n8n Gmail nodes (attendance reminder, check-out alert, task overdue, event reminder, announcement, weekly report, monthly report, knowledge failure, system error alert). Resend has been fully removed.
- **Error handling:** The `IRIAD_ERROR_HANDLER.json` workflow (6 nodes) catches platform-level errors, logs to `automation_runs`, sends a Gmail alert to the admin, and creates an in-app `system_error` notification. It deduplicates by execution ID.
- **Imported inactive** (`"active": false`). Do not activate without live credentials and explicit authorisation.

### n8n sections (8)

| Section | Trigger (Africa/Lagos) | Primary business action |
|---------|------------------------|-------------------------|
| 1 — Attendance Automation | 08:00 open; 09:00 close + daily report; 17:00 sign-out open; 18:05 sign-out close (Mon–Fri) | Open/close check-in & sign-out windows, daily attendance snapshot |
| 2 — Daily Notifications & Reminders | 09:00 Mon–Fri | Overdue task reminders, upcoming event reminders |
| 3 — Weekly & Monthly Reports | Friday 16:00 weekly; last day 17:00 monthly | Weekly/monthly reports with idempotency key, notify |
| 4 — Management Reporting | Daily 19:00 Mon–Fri; Monday 09:00; 1st 09:00 monthly | Daily/weekly/monthly management summary reports |
| 5 — Announcements & Communication | Webhook `/webhook/announcement`; 10:00 Mon–Fri ack reminders | Create announcement, notify staff, acknowledgement reminders |
| 6 — Document & Knowledge Processing | Webhook `/webhook/knowledge-ingest` | Register source, extract text, embeddings, store chunks |
| 7 — AI Assistant & RAG | Webhook `/webhook/knowledge-chat` | Vector search → NVIDIA reply → save with citations |
| 8 — Error Handling & Monitoring | Delegated to Error Handler | Log failures, Gmail alert, in-app notification, execution-ID dedup |

---

## 3. How the native backup engine works

The native backup engine is a set of **24 `automation-*` Edge Functions** plus `automation-health-check`, `automation-dispatcher`, `automation-lease-reaper`, `automation-missed-schedule-recovery`, and `automation-uncertain-reconciliation`. Each implements one or more of the **16 business operations** directly against PostgreSQL.

| Edge Function | Business operation(s) |
|---------------|----------------------|
| automation-health-check | Engine health (pings n8n, trips failover) |
| automation-dispatcher | Job claiming & routing (n8n vs native) |
| automation-attendance-open / -close | Attendance opening & closing (#1, #2) |
| automation-staff-checkin / -checkout | Staff check-in / check-out (#3) |
| automation-daily-attendance-report | Daily attendance reporting (#4) |
| automation-weekly-report / -monthly-report | Weekly & monthly reporting (#5, #6) |
| automation-leave-notifications | Leave request notifications (#7) |
| automation-correction-notifications | Attendance correction notifications (#8) |
| automation-task-reminders | Task assignment & deadline reminders (#9, #10) |
| automation-announcement-notification | Announcement notifications (#11) |
| automation-document-notifications | Document upload notifications (#12) |
| automation-project-notifications | Project & task status notifications (#13) |
| automation-knowledge-chat | AI knowledge assistant fallback (#14) |
| automation-knowledge-ingestion | Knowledge-base ingestion (#15) |
| automation-error-alert | Error monitoring & admin alerts (#16) |
| automation-missed-schedule-recovery | Missed schedule recovery |
| automation-lease-reaper | Expired lease → Uncertain |
| automation-uncertain-reconciliation | Uncertain job reconciliation |
| automation-n8n-register / -callback / -acknowledge | n8n job registration, completion callback, acknowledgement |

Each native function:
- Uses the Supabase service-role key (server-side only, bypasses RLS)
- Guards on `automation_idempotency[idempotency_key]` before performing any business effect (idempotent)
- Wraps logic in try/catch; logs errors to `console.error`
- Writes to `automation_runs` and/or `automation_executions` for audit

### Scheduling the native engine

The native engine is intended to run on a schedule via **Supabase Cron (pg_cron)**:

| Cron job | Schedule | Calls |
|----------|----------|-------|
| automation-health-check | `* * * * *` (every minute) | automation-health-check |
| automation-dispatcher | `* * * * *` (every minute) | automation-dispatcher |
| automation-lease-reaper | `*/15 * * * *` (every 15 min) | automation-lease-reaper |
| automation-missed-schedule-recovery | `0 * * * *` (hourly) | automation-missed-schedule-recovery |

pg_cron invokes Edge Functions via `net.http_request` (requires `pg_net`) with `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.

**Independent fallback:** If pg_cron/pg_net are unavailable, the same Edge Functions are plain HTTP endpoints and can be invoked on a schedule by Vercel Cron or GitHub Actions (no n8n, no active browser session required).

---

## 4. Failover — n8n outage and recovery

Failover is **automatic and administrator-configurable** (`auto_failover_enabled` in `automation_engines`, changed only through the Automation Control Centre and audited).

### Scenario A — n8n healthy
1. `automation-health-check` pings n8n every minute → n8n status = `healthy`.
2. `automation-dispatcher` claims eligible jobs → `current_engine = 'n8n'`.
3. Dispatcher invokes n8n → n8n executes the existing workflow unchanged.
4. n8n reports completion → job `Completed`, result stored, idempotency `completed`.

### Scenario B — n8n unavailable
1. Health check fails `N8N_FAILURE_THRESHOLD` times (default 3) → n8n status = `unhealthy`; native engine marked active.
2. Dispatcher claims eligible jobs → `current_engine = 'iriad-native'`.
3. Native Edge Function executes the equivalent business operation directly against PostgreSQL.
4. Result recorded → `Completed` or `Failed`; administrators notified via `notifications`.

### Scenario C — individual n8n workflow failure
1. Failure event logged to `automation_runs`; job identified by `workflow_name` + `execution_id`.
2. Check `automation_idempotency[idempotency_key]`: if `completed`, no action (operation already done).
3. If safe, transfer to backup engine → new claim with `current_engine = 'iriad-native'`, recovery recorded in `automation_recoveries`.
4. Backup engine executes the equivalent operation; administrators alerted.

### Scenario D — n8n timeout (never treated as proof of non-execution)
1. Job marked `Uncertain` (not `Failed`).
2. Check n8n execution status using the stored `execution_id`; check `automation_idempotency` and any business side-effect row.
3. Reconcile: confirmed completed → `Completed`; confirmed failed → `Failed`; inconclusive → backup engine may execute **only** when duplicate business execution is safely prevented (idempotency key free and no business side-effect found).
4. Reconciliation evidence stored in `execution_result` / `error_details`.

### Scenario E — n8n recovery
1. Health check succeeds → n8n status = `healthy`; confirm it accepts new jobs (test dispatch).
2. Resume primary execution for **new** eligible jobs.
3. Do **not** automatically replay `Completed` or `Uncertain` operations.
4. Preserve backup execution history (`automation_executions`, `automation_recoveries`) for the audit trail.

---

## 5. What happens when n8n becomes unavailable

1. `automation-health-check` detects n8n is unreachable.
2. After the failure threshold, n8n is marked `unhealthy`.
3. New eligible jobs are routed to the native backup engine instead of n8n.
4. The native engine executes attendance open/close, reports, notifications, and other business operations directly in PostgreSQL.
5. Administrators are notified of the failover via `notifications` (+ fallback email if configured).
6. When n8n returns, `automation-uncertain-reconciliation` reconciles any `Uncertain` jobs: if n8n confirms completion, the job is marked `Completed`; if n8n confirms failure or has no record, the job is retried by the native engine or marked `Failed`. No operation is executed twice.

---

## 6. Idempotency and duplicate prevention

Both engines use the **same** `idempotency_key` for the same business operation (e.g. `attendance-open-<org-id>-2026-11-09`, `weekly-report-<org-id>-W45`).

- Unique constraint on `automation_jobs.idempotency_key` prevents duplicate job registration at the database layer.
- Primary key on `automation_idempotency.idempotency_key` prevents duplicate effect recording.
- Atomic job claiming via `claim_automation_job()` uses `FOR UPDATE SKIP LOCKED` so concurrent dispatchers never claim the same job.
- Execution leases (10 minutes) bound job ownership; expired leases → `Uncertain` for reconciliation, never silent re-dispatch.
- Before any business effect, the engine checks `automation_idempotency`. If `completed`, the effect is skipped entirely. If `pending` or absent, a `pending` row is inserted in the same transaction as the effect, the effect is performed, then the row is marked `completed`.
- External operations (email) are recorded in `email_logs` with `provider_message_id` before the provider call. On timeout, the job is `Uncertain` — never blindly retried. Reconciliation checks the idempotency record and provider message ID before deciding whether a retry is safe.

**Result: no business operation executes twice, even when n8n fails mid-flight or an external call times out.**

---

## 7. Uncertain execution reconciliation

A job becomes `Uncertain` when its execution lease expires without completion (e.g. n8n timed out, or the dispatcher crashed). `Uncertain` is **never** treated as proof that the operation did not run.

Reconciliation (performed by `automation-uncertain-reconciliation`):
1. Find all `Uncertain` jobs.
2. For each job with an `execution_id`, query n8n's execution status.
3. Check `automation_idempotency[idempotency_key]` and any business side-effect row (attendance row, `generated_reports` row, notification row).
4. Reconcile:
   - Confirmed completed → `Completed`
   - Confirmed failed → `Failed` (or `Retrying` if retries remain)
   - Inconclusive → native backup may execute **only** when duplicate execution is safely prevented
5. Store reconciliation evidence in `execution_result` / `error_details` for the audit trail.

Jobs in `Uncertain` are **never** automatically re-executed by n8n until reconciliation rules out a completed business effect.

---

## 8. Missed schedule recovery

`automation-missed-schedule-recovery` runs hourly and scans for `Pending`/`Failed` jobs whose `scheduled_at` is in the past (within a 24-hour relevance window). For each:

1. Skip if `automation_idempotency` shows `completed` (operation already done).
2. Check for a business side-effect before re-executing (Uncertain-safe — never assume a missed schedule means the operation didn't run).
3. If no side-effect exists, claim and execute via the native engine (`iriad-native`).
4. Record a recovery event in `automation_recoveries` (`reason = 'missed_schedule'`).

---

## 9. The 16 business operations and their backup behavior

| # | Operation | n8n (primary) | Native backup |
|---|-----------|---------------|---------------|
| 1 | Attendance opening (~08:00 Mon–Fri) | Section 1 | `automation-attendance-open` |
| 2 | Automatic attendance closure (09:00) | Section 1 close branch | `automation-attendance-close` |
| 3 | Staff check-in / check-out | Edge `attendance-checkin` + n8n sign-out window | `automation-staff-checkin` / `-checkout` |
| 4 | Daily attendance reporting | Section 1 close branch | `automation-daily-attendance-report` |
| 5 | Weekly reporting | Sections 3 & 4 | `automation-weekly-report` |
| 6 | Monthly reporting | Sections 3 & 4 | `automation-monthly-report` |
| 7 | Leave request notifications | UI flow only (no n8n today) | `automation-leave-notifications` |
| 8 | Attendance correction notifications | UI flow only (no n8n today) | `automation-correction-notifications` |
| 9 | Task assignment notifications | Section 2 | `automation-task-reminders` |
| 10 | Task deadline reminders | Section 2 | `automation-task-reminders` |
| 11 | Announcement notifications | Section 5 webhook | `automation-announcement-notification` |
| 12 | Document upload notifications | Partially (UI) | `automation-document-notifications` |
| 13 | Project & task status notifications | Partially (Section 2) | `automation-project-notifications` |
| 14 | AI knowledge assistant | Section 7 webhook → NVIDIA | `automation-knowledge-chat` (fallback placeholder) |
| 15 | Knowledge-base ingestion | Section 6 webhook | `automation-knowledge-ingestion` |
| 16 | Automation error monitoring & alerts | Section 8 + Error Handler | `automation-error-alert` |

**Count verified: 16 business operations.** This matches `docs/DUAL_AUTOMATION_INVENTORY.md` §3 and the `automation_jobs.business_operation` check constraint. Operations 7, 8, and 12 exist as UI flows today but have no automated n8n equivalent; the native engine implements them as new equivalent operations (not a parallel system).

---

## 10. Automation Control Centre (operators)

The Automation Control Centre page (`/automation-control-centre`, Admin + Director only) provides:

- **Engine health panel:** n8n status, native engine status, last health check, last successful check, current execution mode, automatic failover on/off.
- **Execution statistics:** successful/failed/pending/running/uncertain jobs; jobs by engine (n8n vs backup); recovered jobs.
- **Workflow monitoring:** workflow name, last execution, last successful execution, status, retry count, recent errors, execution history.
- **Administrative controls:** inspect failed jobs, retry eligible jobs, enable/disable automatic failover, manually select preferred execution mode, view engine health, inspect recovery history.
- **Recovery history:** `automation_recoveries` list with reason, engine, timestamp, notes.

Every Control Centre action is audited to `activity_logs`. Manual mode changes do not bypass idempotency or job-safety checks (claiming still goes through `claim_automation_job()`).

> **Note:** The Control Centre depends on migration 012 tables which are not yet applied. The page exists in the UI but cannot operate against live automation tables until the migrations are applied and approved.

---

## 11. Known operational issues

- **Timezone bugs:** Several native Edge Functions use UTC `new Date()` / `getUTCDay()` instead of Africa/Lagos for attendance windows (08:00–09:00, 17:00–18:05), workday checks, and report dates. Must be fixed before production.
- **Silent check-in overwrite:** `attendance-checkin` upsert silently overwrites an existing check-in instead of rejecting a duplicate.
- **Migration 011/012 not applied:** The native engine tables and `claim_automation_job()` do not exist yet.
- **n8n not live:** Workflows inactive, no credentials, no Gmail configured. Failover cannot be tested yet.
- **`match_knowledge_chunks` RPC missing:** Knowledge chat vector search does not work until this function is created in the database.
- **No live credentials:** `.env` placeholders only; `SUPABASE_SECRET_KEY` previously exposed — rotate before production.
