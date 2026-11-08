# IRIAD Operations Portal — n8n Setup

**Status:** 11 workflow JSON files generated under `n8n/workflows/`; n8n instance and credentials not yet connected.

## 1. Required workflows (files in `n8n/workflows/`)

| File | Purpose | Schedule trigger |
|------|---------|------------------|
| `attendance-open.json` | Opens the 08:00–09:00 check-in window; notifies staff | Daily 08:00 Africa/Lagos |
| `attendance-close-and-daily-report.json` | Closes check-in window; builds daily attendance snapshot | Daily 09:05 Africa/Lagos |
| `evening-signout-open-close.json` | Opens (17:00) and closes (18:05) the sign-out window | Daily 17:00 / 18:05 Africa/Lagos |
| `attendance-reminders.json` | Reminds staff who haven't checked in by 09:10 | Daily 09:10 Africa/Lagos |
| `task-reminders.json` | Reminds assignees of open/due tasks | Daily 09:00 Africa/Lagos |
| `weekly-management-report.json` | Compiles weekly reports; notifies management | Weekly Friday 16:00 Africa/Lagos |
| `monthly-management-report.json` | Compiles monthly reports; notifies management | Monthly last day 17:00 Africa/Lagos |
| `announcement-email-notification.json` | Creates announcement; notifies email recipients | On-demand (webhook/insert) |
| `chat-notifications.json` | Routes new chat messages to room members | On-demand (message insert) |
| `knowledge-ingestion.json` | Registers source; stores chunks + embeddings; marks indexed | On-demand (source insert) |
| `knowledge-chat-agent.json` | RAG chat: webhook → AI Agent → pgvector search → save reply | Webhook (`/knowledge-chat`) |

## 2. Importing into n8n

1. Open n8n → Workflows → Import → select each JSON file.
2. Workflows import as **inactive** (`"active": false`). Activate after configuring credentials.
3. Update Supabase credential references in each workflow to your n8n Supabase credential.
4. For `knowledge-chat-agent`, configure the NVIDIA API credential on the AI Agent node (model `nemotron`).

## 3. Credentials required in n8n

| Credential | Used by | Env var |
|------------|---------|---------|
| Supabase | all DB workflows | `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` |
| NVIDIA API | knowledge-chat-agent AI Agent | `NVIDIA_API_KEY` |
| Webhook secret | knowledge-chat-agent webhook | `N8N_WEBHOOK_SECRET` |
| Gmail (native n8n node) | email-report workflows | Gmail OAuth2 credential |

Set `N8N_BASE_URL` in `.env` (local, gitignored) so the frontend can call webhooks.

## 4. Key design notes

- Schedules use **Africa/Lagos** time (8–9 AM check-in window, Mon–Fri).
- Daily report is idempotent by `report_date` (upsert by date) — no double-send on re-run.
- Email recipients come from `email_report_recipients` table (admin-configurable), not hardcoded.
- `knowledge-chat-agent` exposes a POST webhook at `/knowledge-chat` called by the Chatbot page.

## 5. Verification checklist

- [ ] All 11 JSON files import into n8n without errors
- [ ] Each workflow's Supabase credential connects
- [ ] Schedules fire at the correct Lagos times
- [ ] `knowledge-chat-agent` webhook returns an answer (requires NVIDIA_API_KEY + pgvector data)
- [ ] Daily report does not double-send on re-run (idempotency)
