# IRIAD Master Workflow — Engineering Audit Report

**Date:** 2026-11-08  
**Scope:** `n8n/IRIAD_MASTER_WORKFLOW.json` + `n8n/IRIAD_ERROR_HANDLER.json`  
**Status:** All static validation checks passed (294 PASS, 0 FAIL, 0 WARN)  
**Deployed:** No — workflows are inactive (`"active": false`) and must not be activated without live credentials.

---

## 1. Executive Summary

The IRIAD Master Workflow consolidates 11 legacy n8n workflows into a single consolidated workflow with 8 independent automation sections. Every section starts from its own trigger node, so a failure in one section cannot cascade to another. Centralized error handling has been moved to a separate `IRIAD Error Handler` workflow, referenced via `settings.errorWorkflowId = "iriad-error-handler"`.

**Result:** The workflow is structurally valid, secure (no hardcoded secrets, all webhooks authenticated, all schedule triggers on Africa/Lagos), and ready for live import and credential configuration. It has **not** been deployed or activated.

---

## 2. Inventory

### 2.1 Master Workflow (`n8n/IRIAD_MASTER_WORKFLOW.json`)

| Metric | Value |
|--------|-------|
| Total nodes | 229 |
| Schedule triggers | 11 (all `Africa/Lagos`) |
| Webhook triggers | 3 (`announcement`, `knowledge-ingest`, `knowledge-chat`) |
| respondToWebhook nodes | 17 |
| HTTP Request nodes | 97 |
| Code nodes | 61 |
| IF nodes | 16 |
| Gmail nodes | 13 |
| Sticky notes | 11 (visual canvas annotations) |
| Supabase nodes | 0 (Supabase accessed via HTTP Request REST calls) |
| Error Trigger nodes | 0 (error handling delegated to error handler) |
| Orphan nodes | 0 |
| Dangling connection references | 0 |
| Hardcoded secrets | 0 |
| Hardcoded organisation UUID | 0 |
| Removed table/column references | 0 |

**Settings:**
```json
{
  "executionOrder": "v1",
  "timezone": "Africa/Lagos",
  "errorWorkflowId": "iriad-error-handler"
}
```

### 2.2 Error Handler (`n8n/IRIAD_ERROR_HANDLER.json`)

| Metric | Value |
|--------|-------|
| Total nodes | 8 |
| Trigger type | `n8n-nodes-base.errorTrigger` (starts the workflow) |
| Code nodes | 1 (extracts execution data, formats Africa/Lagos timestamp) |
| IF nodes | 1 (deduplication check) |
| Supabase nodes | 2 (log to `automation_runs`, insert `notifications`) |
| Gmail nodes | 1 (alert to `olarewajuagbaje@gmail.com`) |
| noOp nodes | 1 (duplicate skip) |
| Orphan nodes | 0 |
| Dangling connection references | 0 |
| Hardcoded secrets | 0 |

**Flow:** Error Trigger → Extract Error Data → Check Duplicate Execution → Is Duplicate? → [No-Op] OR [Log Error to Supabase → Notify Admin In-App → Gmail — Error Alert]

---

## 3. Triggers

### 3.1 Schedule Triggers (Master Workflow — all Africa/Lagos)

| # | Trigger | Time (Lagos) | Days | Section |
|---|---------|-------------|------|---------|
| 1 | Attendance | 08:00 Open Check-in | Mon–Fri | Attendance |
| 2 | Attendance | 09:00 Close Check-in | Mon–Fri | Attendance |
| 3 | Attendance | Every 5 min — Sign-out Window | Mon–Fri | Attendance |
| 4 | Leave & Corrections | Every 10 min | Mon–Fri | Leave & Corrections |
| 5 | Tasks & Deadlines | 09:00 Task Reminders | Mon–Fri | Tasks & Deadlines |
| 6 | Daily Notifications | 09:00 Event Reminders | Mon–Fri | Daily Notifications |
| 7 | Weekly Reporting | 09:30 Deadline Check | Weekly | Weekly Reporting |
| 8 | Monthly Reporting | 09:30 Deadline Check | Monthly | Monthly Reporting |
| 9 | Management Reports | Daily Trigger | Mon–Fri | Management Reports |
| 10 | Management Reports | Weekly Trigger | Mondays | Management Reports |
| 11 | Management Reports | Monthly Trigger | 1st of month | Management Reports |

### 3.2 Webhook Triggers (Master Workflow)

| # | Path | Method | Auth | Section |
|---|------|--------|------|---------|
| 1 | `/webhook/announcement` | POST | `x-webhook-secret` header | Announcements |
| 2 | `/webhook/knowledge-ingest` | POST | `x-webhook-secret` header | Knowledge Ingestion |
| 3 | `/webhook/knowledge-chat` | POST | `x-webhook-secret` header | AI Assistant |

All 3 webhooks are followed by an IF node that validates `headers['x-webhook-secret']` against `$env.N8N_WEBHOOK_SECRET`.

### 3.3 Error Handler Trigger

| # | Type | Purpose |
|---|------|---------|
| 1 | `n8n-nodes-base.errorTrigger` | Captures failures from any workflow linked via `errorWorkflowId` |

---

## 4. Branches (8 Independent Sections)

Each section starts from its own trigger node. A failure in one section does not cascade to another.

| Section | Trigger(s) | Primary Action |
|---------|-----------|----------------|
| 1 — Attendance Automation | 3 schedule triggers (08:00, 09:00, every 5 min) | Open/close check-in & sign-out windows, remind missing check-ins/sign-outs |
| 2 — Daily Notifications & Reminders | 1 schedule trigger (09:00) | Overdue task reminders, upcoming event reminders |
| 3 — Weekly & Monthly Reports | 2 schedule triggers | Generate weekly/monthly reports with idempotency keys |
| 4 — Management Reporting | 3 schedule triggers (daily, weekly, monthly) | Generate management summary reports |
| 5 — Announcements & Communication | 1 webhook (`announcement`) + 1 schedule (10:00 ack reminders) | Create announcements, notify staff, acknowledgement reminders |
| 6 — Document & Knowledge Processing | 1 webhook (`knowledge-ingest`) | Fetch source, extract text, generate embeddings (NVIDIA), store chunks, mark indexed |
| 7 — AI Assistant & RAG | 1 webhook (`knowledge-chat`) | Get profile, load history, vector search (`match_knowledge_chunks` RPC), NVIDIA AI response, save reply |
| 8 — Error Handling & Monitoring | Delegated to `IRIAD Error Handler` workflow | Log failures to `automation_runs`, notify admin via `notifications` + Gmail |

---

## 5. Webhooks

| Endpoint | Method | Section | Auth | Secured? |
|----------|--------|---------|------|----------|
| `/webhook/announcement` | POST | 5 — Announcements | `x-webhook-secret` = `$env.N8N_WEBHOOK_SECRET` | Yes |
| `/webhook/knowledge-ingest` | POST | 6 — Knowledge Processing | `x-webhook-secret` = `$env.N8N_WEBHOOK_SECRET` | Yes |
| `/webhook/knowledge-chat` | POST | 7 — AI Assistant & RAG | `x-webhook-secret` = `$env.N8N_WEBHOOK_SECRET` | Yes |

**Webhook auth: SECURE.** All 3 webhooks validate the `x-webhook-secret` header against `$env.N8N_WEBHOOK_SECRET` before processing.

---

## 6. Gmail Nodes

| # | Node | Recipient | Purpose |
|---|------|-----------|---------|
| 1 | Notification Delivery \| Check-in Open Send Gmail | `{{ $json.to }}` | Check-in open notification |
| 2 | Notification Delivery \| Missing Check-in Send Gmail | `{{ $json.to }}` | Missing check-in reminder |
| 3 | Notification Delivery \| Sign-out Open Send Gmail | `{{ $json.to }}` | Sign-out open notification |
| 4 | Notification Delivery \| Missing Sign-out Send Gmail | `{{ $json.to }}` | Missing sign-out alert |
| 5 | Notification Delivery \| Approvals Send Gmail | `{{ $json.to }}` | Leave/approvals notification |
| 6 | Notification Delivery \| Task Digest Send Gmail | `{{ $json.to }}` | Task digest |
| 7 | Notification Delivery \| Event Digest Send Gmail | `{{ $json.to }}` | Event digest |
| 8 | Notification Delivery \| Weekly Report Reminder Send Gmail | `{{ $json.to }}` | Weekly report reminder |
| 9 | Notification Delivery \| Monthly Report Reminder Send Gmail | `{{ $json.to }}` | Monthly report reminder |
| 10 | Notification Delivery \| Daily Mgmt Report Send Gmail | `{{ $json.to }}` | Daily management report |
| 11 | Notification Delivery \| Weekly Mgmt Report Send Gmail | `{{ $json.to }}` | Weekly management report |
| 12 | Notification Delivery \| Monthly Mgmt Report Send Gmail | `{{ $json.to }}` | Monthly management report |
| 13 | Notification Delivery \| Announcement Send Gmail | `{{ $json.to }}` | Announcement notification |

**Error Handler Gmail:** 1 node → `olarewajuagbaje@gmail.com` (system error alerts)

All Gmail nodes use dynamic `sendTo: ={{ $json.to }}` — no hardcoded email addresses in the master workflow (except the error handler's admin alert).

**Email delivery: Gmail only.** No Resend, no SMTP, no third-party email API. Gmail OAuth2 credential required.

---

## 7. Orphan Nodes

**Master: 0 orphans** (11 sticky notes excluded — these are visual canvas annotations, not functional nodes).  
**Error handler: 0 orphans.**

All functional nodes have at least one incoming or outgoing connection.

---

## 8. Unresolved Expressions

**0 unresolved expressions.** All `{{ }}` n8n expressions in parameter fields have balanced opening and closing braces. Code node `jsCode` bodies (JavaScript, not n8n expressions) were excluded from brace checking.

---

## 9. Unverified DB Mappings

The master workflow accesses Supabase via HTTP Request REST calls (97 HTTP Request nodes). Table names referenced in Supabase operations were checked against the migration schema (migrations 001–010). All referenced tables map to known tables:

`organisations, profiles, departments, attendance_sessions, attendance, leave_requests, tasks, projects, notifications, generated_reports, automation_runs, announcements, knowledge_sources, knowledge_chunks, chatbot_conversations, chatbot_messages, email_logs, email_report_recipients, task_assignees, project_members, weekly_reports, monthly_reports`

**No references to removed tables/columns:** `attendance_windows`, `daily_reports`, `indexed_at`, `assignee_id`, `sender_id`, `indexed` — none found.

**Note:** DB compatibility is verified statically (table name matching only). Live RLS, column-level permissions, and RPC function existence (`match_knowledge_chunks`) require live Supabase access to confirm.

---

## 10. Workflow-Transfer Nodes

**0 workflow-transfer nodes.** The master workflow does not call or transfer to other workflows directly. Error handling is delegated via `settings.errorWorkflowId = "iriad-error-handler"` — n8n routes errors automatically when a workflow fails.

---

## 11. Error Handling

| Check | Status |
|-------|--------|
| Master `settings.errorWorkflowId` set | ✅ `iriad-error-handler` |
| Master has 0 errorTrigger nodes | ✅ (delegated to separate handler) |
| Error handler starts with Error Trigger | ✅ |
| Error handler captures execution ID | ✅ |
| Error handler captures execution URL | ✅ |
| Error handler captures error message | ✅ |
| Error handler timestamp in Africa/Lagos | ✅ |
| Error handler identifies business section | ✅ |
| Error handler logs to Supabase (`automation_runs`) | ✅ |
| Error handler sends Gmail alert | ✅ (to `olarewajuagbaje@gmail.com`) |
| Error handler deduplication | ✅ (IF node checks for duplicate execution ID) |
| Error handler in-app notification | ✅ (inserts into `notifications` table) |
| No secrets in error handler | ✅ |

**Error handling: CONFIGURED.** Failures in any branch of the master workflow are routed to the IRIAD Error Handler, which logs to Supabase, sends a Gmail alert, creates an in-app notification, and deduplicates by execution ID.

---

## 12. Webhook Auth Security

**Webhook auth: SECURE.**

All 3 webhook endpoints (`announcement`, `knowledge-ingest`, `knowledge-chat`) validate the `x-webhook-secret` header against `$env.N8N_WEBHOOK_SECRET` via an IF node immediately after the webhook trigger. Requests without the correct secret are rejected.

No webhook exposes sensitive data in responses without authentication.

---

## 13. Tests Passed

Static validation (`n8n/validate-workflow.cjs`): **ALL CHECKS PASSED** — 294 PASS, 0 FAIL, 0 WARN.

| Test Area | Checks | Result |
|-----------|--------|--------|
| JSON validity | 2 | PASS |
| Node counts | 2 | PASS |
| Node types (known n8n types) | ~237 | PASS |
| Error handling architecture | 3 | PASS |
| Schedule trigger timezones | 12 | PASS |
| Error handler architecture | 6 | PASS |
| Error handler data capture | 5 | PASS |
| Connection integrity | ~500 | PASS |
| Orphan nodes | 2 | PASS |
| No hardcoded secrets | 2 | PASS |
| No hardcoded org UUID | 4 | PASS |
| Webhook authentication | 3 | PASS |
| Removed table/column refs | 2 | PASS |
| Supabase table references | ~100 | PASS |
| Gmail nodes | 15 | PASS |
| Expression brace balance | 2 | PASS |

Live tests (T10–T18) require n8n + Supabase credentials and have not been executed.

---

## 14. Integrations Needing Credentials

| Integration | Credential | Used By | Server-side only? |
|-------------|-----------|---------|-------------------|
| Supabase | `IRIAD Supabase` (service role key) | All DB operations via HTTP Request | Yes |
| NVIDIA NIM | `NVIDIA API` (API key) | Embeddings + LLM (Sections 6, 7) | Yes |
| Gmail | `Gmail` OAuth2 | All email delivery (13 master + 1 error handler) | Yes |
| n8n webhook secret | `N8N_WEBHOOK_SECRET` env var | All 3 webhook endpoints | Yes |

**Never expose:** `SUPABASE_SERVICE_ROLE_KEY`, `NVIDIA_API_KEY`, `N8N_WEBHOOK_SECRET`, Gmail OAuth2 token — all server-side only, never prefixed with `VITE_`.

---

## 15. What Remains Before Production

| Item | Status |
|------|--------|
| Apply Supabase migrations 001–010 (including `match_knowledge_chunks` RPC) | Not done — requires live DB access |
| Create n8n credentials (Supabase, NVIDIA, Gmail) | Not done — requires n8n instance |
| Set n8n environment variables (`N8N_BASE_URL`, `N8N_WEBHOOK_SECRET`, `IRIAD_ORGANISATION_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NVIDIA_API_KEY`, `ADMIN_EMAIL`) | Not done — requires n8n instance |
| Import master workflow + error handler into n8n | Not done — ready to import |
| Select credentials in each Supabase/HTTP Request/Gmail node | Not done — post-import manual step |
| Verify all schedule triggers have Africa/Lagos timezone | ✅ Verified statically |
| Enable RLS policies on `knowledge_chunks` for role-filtered RAG | Not done — requires live DB access |
| Run live tests T9–T18 | Not done — requires credentials |
| Activate workflows | **Must NOT** be done by this agent — requires user authorization |

---

## 16. Deliverables

| File | Status |
|------|--------|
| `n8n/IRIAD_MASTER_WORKFLOW.json` | ✅ Complete, validated |
| `n8n/IRIAD_ERROR_HANDLER.json` | ✅ Complete, validated (Error Trigger start, deduplication, Gmail alert) |
| `n8n/validate-workflow.cjs` | ✅ Complete, all checks pass |
| `n8n/WORKFLOW_AUDIT.md` | ✅ This document |
| `n8n/MASTER_WORKFLOW_TESTS.md` | ✅ Updated (T9/T9a node counts, T18 error handler test, added T19) |
| `n8n/ENVIRONMENT_VARIABLES.md` | ✅ Already comprehensive (no changes needed) |
| `n8n/MASTER_WORKFLOW_GUIDE.md` | ✅ Already comprehensive (no changes needed) |

---

**Bottom line:** The IRIAD Master Workflow is structurally complete, secure, and validated. It is ready for import into n8n and credential configuration, but must **not** be activated or connected to a live database without explicit user authorization.
