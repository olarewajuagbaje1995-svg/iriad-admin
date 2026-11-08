# IRIAD n8n Integration Audit

Audit of the consolidated n8n automation for the IRIAD Operations Portal.
Covers: master workflow, error handler, webhook paths, email delivery, credential usage, and security.

## Audit scope

- `n8n/IRIAD_MASTER_WORKFLOW.json` — consolidated master workflow (92 nodes, 62 connections)
- `n8n/IRIAD_ERROR_HANDLER.json` — platform-level error handler (6 nodes, 3 connections)
- `n8n/ENVIRONMENT_VARIABLES.md` — environment variable reference
- `n8n/MASTER_WORKFLOW_GUIDE.md` — workflow import and setup guide
- `n8n/MASTER_WORKFLOW_TESTS.md` — test procedures
- `n8n/workflows/archived/` — 11 archived legacy workflow files

---

## 1. JSON validity

| File | Status | Nodes | Connections |
|------|--------|-------|-------------|
| `n8n/IRIAD_MASTER_WORKFLOW.json` | PASS | 92 | 62 |
| `n8n/IRIAD_ERROR_HANDLER.json` | PASS | 6 | 3 |

Both files parse as valid JSON. All connection source/target references point to existing node IDs (no dangling references).

---

## 2. Resend removal

Resend has been completely removed from the project:

| Location | Status |
|----------|--------|
| `.env.example` | RESEND_API_KEY and EMAIL_FROM removed |
| `n8n/ENVIRONMENT_VARIABLES.md` | Email section removed; no Resend references |
| `n8n/IRIAD_MASTER_WORKFLOW.json` | No "Resend" or "SMTP" strings |
| `n8n/IRIAD_ERROR_HANDLER.json` | No Resend references |
| `n8n/MASTER_WORKFLOW_GUIDE.md` | Credentials table lists Gmail instead of Resend/SMTP |
| `n8n/MASTER_WORKFLOW_TESTS.md` | No Resend references |
| `docs/KNOWN_ISSUES.md` | Resend reference removed |
| `docs/DEEP_SYSTEM_AUDIT.md` | Resend references removed |
| `DEPLOYMENT.md` | Resend references removed |
| `n8n/README.md` | Resend references removed |
| `docs/N8N_SETUP.md` | Resend references removed |
| `docs/SECURITY_GUIDE.md` | Resend references removed |
| `src/lib/email/templates.ts` | No Resend references (HTML templates only) |

**Verdict**: PASS — Resend is fully removed.

---

## 3. Gmail email delivery

All outgoing email uses native n8n Gmail nodes:

| Email type | Gmail node | Recipient | Workflow section |
|------------|-----------|-----------|------------------|
| Attendance check-in reminder | `attendance-reminder-gmail` | `$json.email` (staff) | Section 1 |
| Attendance check-out alert | `attendance-checkout-gmail` | `$json.email` (staff) | Section 1 |
| Task overdue reminder | `task-overdue-gmail` | `$env.ADMIN_EMAIL` | Section 2 |
| Event reminder | `event-reminder-gmail` | `$env.ADMIN_EMAIL` | Section 2 |
| Announcement distribution | `announcement-gmail` | `$json.email` (staff) | Section 5 |
| Weekly management report | `weekly-report-gmail` | `$env.ADMIN_EMAIL` | Section 3 |
| Monthly management report | `monthly-report-gmail` | `$env.ADMIN_EMAIL` | Section 3 |
| Knowledge ingestion failure | `knowledge-failure-gmail` | `$env.ADMIN_EMAIL` | Section 6 |
| System error alert | `system-error-gmail` | `olarewajuagbaje@gmail.com` | Section 8 |

All 9 Gmail nodes use the `n8n-nodes-base.gmail` node type. Each requires the `Gmail` OAuth2 credential to be configured in n8n.

**Verdict**: PASS — Gmail nodes cover all email categories specified in the requirements.

---

## 4. Webhook paths

Three webhook URLs are used exactly as specified:

| Webhook | Path | Frontend env var | URL |
|---------|------|-----------------|-----|
| Announcement | `/webhook/announcement` | `VITE_N8N_ANNOUNCEMENT_WEBHOOK_URL` | `https://olarewajuagbaje-n8n-automation-hub.hf.space/webhook/announcement` |
| Knowledge ingest | `/webhook/knowledge-ingest` | `VITE_N8N_KNOWLEDGE_INGEST_WEBHOOK_URL` | `https://olarewajuagbaje-n8n-automation-hub.hf.space/webhook/knowledge-ingest` |
| Knowledge chat | `/webhook/knowledge-chat` | `VITE_N8N_KNOWLEDGE_CHAT_WEBHOOK_URL` | `https://olarewajuagbaje-n8n-automation-hub.hf.space/webhook/knowledge-chat` |

All three webhook nodes are present in the master workflow. Each is followed by an `if` node that validates the `x-webhook-secret` header against `$env.N8N_WEBHOOK_SECRET`.

**Verdict**: PASS — Three webhook URLs match exactly; secret validation on all.

---

## 5. Environment variables

### n8n (server-side)

| Variable | Source | Status |
|----------|--------|--------|
| `N8N_BASE_URL` | n8n env | Documented |
| `N8N_WEBHOOK_SECRET` | n8n env | Documented |
| `IRIAD_ORGANISATION_ID` | n8n env | Documented |
| `SUPABASE_URL` | n8n env | Documented |
| `SUPABASE_SERVICE_ROLE_KEY` | n8n env | Documented |
| `NVIDIA_API_KEY` | n8n env | Documented |
| `ADMIN_EMAIL` | n8n env | Documented (default: `olarewajuagbaje@gmail.com`) |

### Frontend (browser-safe, VITE_ prefix)

| Variable | Source | Status |
|----------|--------|--------|
| `VITE_N8N_ANNOUNCEMENT_WEBHOOK_URL` | `.env.example` | Documented with production URL |
| `VITE_N8N_KNOWLEDGE_INGEST_WEBHOOK_URL` | `.env.example` | Documented with production URL |
| `VITE_N8N_KNOWLEDGE_CHAT_WEBHOOK_URL` | `.env.example` | Documented with production URL |

Deprecated frontend variables (`VITE_CHATBOT_WEBHOOK_URL`, `VITE_KNOWLEDGE_INGEST_WEBHOOK_URL`) are marked as deprecated in `ENVIRONMENT_VARIABLES.md`.

No secrets are hardcoded in workflow JSON. No `VITE_` prefixed secrets exist.

**Verdict**: PASS — All env vars documented; no hardcoded credentials.

---

## 6. No workflow-transfer nodes

The master workflow contains no `n8n-nodes-base.workflowTransfer` or equivalent nodes. All sections are independent trigger branches within a single workflow. No nodes execute other workflows or transfer data between workflow files.

**Verdict**: PASS — No workflow-transfer nodes present.

---

## 7. Error handler architecture

The `IRIAD_ERROR_HANDLER.json` workflow:

- **Trigger**: Webhook `POST /webhook/error-handler` with `x-webhook-secret` validation
- **Actions**:
  1. Logs error to `automation_runs` table in Supabase
  2. Sends Gmail alert to `olarewajuagbaje@gmail.com`
  3. Creates in-app notification of type `system_error`
- **Relationship to master workflow**: Master workflow sections log failures to `automation_runs` and notify via `notifications`. The error handler provides a dedicated channel for platform-level errors that escape section-level handling, plus direct Gmail alerting to the admin.

**Verdict**: PASS — Error handler is a dedicated workflow with Gmail alerts to the specified admin email.

---

## 8. Credential usage

| Credential | Used by | Hardcoded? |
|------------|---------|------------|
| `IRIAD Supabase` | All Supabase nodes | No — uses `$env.SUPABASE_SERVICE_ROLE_KEY` |
| `NVIDIA API` | Embeddings + LLM HTTP Request nodes | No — uses `$env.NVIDIA_API_KEY` |
| `Gmail` | All 9 Gmail nodes | No — OAuth2 credential via n8n UI |

No literal API keys, secrets, or passwords appear in either workflow JSON file.

**Verdict**: PASS — No hardcoded credentials.

---

## 9. Section independence

The master workflow has 8 independent sections, each with its own trigger:

1. Attendance Automation (schedule triggers: 08:00, 09:05, 17:00, 18:05 Lagos)
2. Daily Notifications & Reminders (schedule trigger: 09:00 Lagos)
3. Weekly & Monthly Reports (schedule triggers: Friday 16:00, last day 17:00 Lagos)
4. Management Reporting (schedule triggers: daily 19:00, Monday 09:00, 1st 09:00 Lagos)
5. Announcements & Communication (webhook: `/webhook/announcement`)
6. Document & Knowledge Processing (webhook: `/webhook/knowledge-ingest`)
7. AI Assistant & RAG (webhook: `/webhook/knowledge-chat`)
8. Error Handling & Monitoring (integrated failure branches)

Each section starts from its own trigger node. A failure in one section cannot cascade to another.

**Verdict**: PASS — 8 independent sections with separate triggers.

---

## 10. Archived legacy workflows

The following 11 legacy workflow files have been moved to `n8n/workflows/archived/`:

1. `attendance-open.json`
2. `attendance-close-and-daily-report.json`
3. `evening-signout-open-close.json`
4. `attendance-reminders.json`
5. `task-reminders.json`
6. `weekly-management-report.json`
7. `monthly-management-report.json`
8. `announcement-email-notification.json`
9. `chat-notifications.json`
10. `knowledge-ingestion.json`
11. `knowledge-chat-agent.json`

`n8n/workflows/` no longer contains active workflow files — only the `archived/` subdirectory.

**Verdict**: PASS — Legacy workflows archived, not deleted.

---

## 11. Frontend integration

| File | Webhook URL env var | Status |
|------|-------------------|--------|
| `src/features/knowledge-base/KnowledgeBasePage.tsx` | `VITE_N8N_KNOWLEDGE_INGEST_WEBHOOK_URL` | POST `{ source_id }` |
| `src/features/chatbot/ChatbotPage.tsx` | `VITE_N8N_KNOWLEDGE_CHAT_WEBHOOK_URL` | POST `{ question, conversation_id, profile_id }` with Bearer auth |
| `src/features/announcements/AnnouncementsPage.tsx` | `VITE_N8N_ANNOUNCEMENT_WEBHOOK_URL` | POST `{ title, body, category, created_by }` with Bearer auth |

All three frontend files reference the correct `VITE_N8N_*` environment variables matching `.env.example`.

**Verdict**: PASS — Frontend uses correct webhook env vars.

---

## Summary

| Check | Result |
|-------|--------|
| JSON validity | PASS |
| Resend removal | PASS |
| Gmail email delivery | PASS |
| Webhook paths (3 URLs) | PASS |
| Environment variables | PASS |
| No hardcoded secrets | PASS |
| No workflow-transfer nodes | PASS |
| Error handler architecture | PASS |
| Section independence | PASS |
| Legacy workflows archived | PASS |
| Frontend integration | PASS |

**Overall: PASS** — The n8n integration is ready for deployment.
