# IRIAD Operations Portal — n8n Workflows

This directory contains 11 n8n workflow JSON files that automate attendance, reminders, reports, notifications, and the knowledge assistant for the IRIAD Operations Portal.

Workflows:

| File | Purpose | Trigger |
|------|---------|---------|
| `attendance-open.json` | Opens the daily 08:00–09:00 check-in window and notifies staff | Schedule (Daily 08:00 Lagos) |
| `attendance-close-and-daily-report.json` | Closes the check-in window, fetches yesterday's attendance, saves a daily snapshot | Schedule (Daily 09:05 Lagos) |
| `evening-signout-open-close.json` | Opens (17:00) and closes (18:05) the daily sign-out window | Schedule (2× daily) |
| `attendance-reminders.json` | Reminds active staff who have not checked in by 09:10 | Schedule (Daily 09:10 Lagos) |
| `task-reminders.json` | Task deadline/assignment reminders | Schedule |
| `weekly-management-report.json` | Weekly management summary report | Schedule (weekly) |
| `monthly-management-report.json` | Monthly management summary report | Schedule (monthly) |
| `announcement-email-notification.json` | Creates an announcement, fetches email recipients, notifies them | Webhook / manual insert |
| `chat-notifications.json` | Creates a chat message, fetches room members, notifies them | Insert into `chat_messages` |
| `knowledge-ingestion.json` | Registers a knowledge source, stores chunks with embeddings, marks indexed | Manual insert |
| `knowledge-chat-agent.json` | Knowledge-assistant chat: webhook → AI agent (NVIDIA NIM) → pgvector search → save reply | **Webhook (POST)** |

All workflows are imported inactive (`"active": false`). Activate each one after configuring credentials.

---

## 1. Prerequisites

- [n8n](https://docs.n8n.io/) installed and running (self-hosted, n8n cloud, or docker).
- A [Supabase](https://supabase.com) project with the IRIAD schema migrated (see `C:\dev\IRIAD\DEPLOYMENT.md`, migrations `001`–`009`).
- An [NVIDIA API key](https://build.nvidia.com) for the knowledge assistant (`knowledge-chat-agent`).
- Gmail OAuth2 credential for announcement email notifications.

---

## 2. Importing a workflow into n8n

1. Open n8n and go to **Workflows**.
2. Click **Import from file** (or the `⋮` menu → **Import**).
3. Select the workflow JSON file from `C:\dev\IRIAD\n8n\workflows\`.
4. The workflow appears in the canvas, inactive by default.
5. Open each **Supabase** node and select/create the Supabase credential (see section 3).
6. Open each **Schedule Trigger** node and confirm the timezone is set to **Africa/Lagos** (WAT).
7. Click **Save**, then toggle the workflow **Active**.

Repeat for all 11 files. Example for the knowledge chat agent:

```bash
# Open n8n UI, then import:
n8n/workflows/knowledge-chat-agent.json
```

---

## 3. Required credentials in n8n

Configure these credentials once in n8n (**Settings → Credentials**) and reuse them across workflows.

### Supabase credential (used by all Supabase nodes)

Create a Supabase API credential in n8n with:

| Field | Value (placeholder) |
|-------|---------------------|
| Name | `IRIAD Supabase` |
| API URL | `${SUPABASE_URL}` |
| API Key | `${SUPABASE_SERVICE_ROLE_KEY}` (server-side secret key) |

> Use the Supabase **service role key** (not the anon/publishable key) so n8n can write to tables. Never expose the service role key in the frontend. Find it in Supabase → Project Settings → API.

### NVIDIA API credential (knowledge-chat-agent only)

The AI Agent node references credential `nvidiaApiCredential`. Create an n8n credential:

| Field | Value (placeholder) |
|-------|---------------------|
| Name | `nvidiaApiCredential` |
| API Key | `${NVIDIA_API_KEY}` |

### Email / SMTP credential (announcement-email-notification)

The workflow reads recipients from Supabase and inserts notifications. If you wire an actual email send node, configure SMTP credentials:

| Field | Value (placeholder) |
|-------|---------------------|
| Host | `${SMTP_HOST}` |
| Port | `${SMTP_PORT}` |
| User | `${SMTP_USER}` |
| Pass | `${SMTP_PASS}` |
| From | `${EMAIL_FROM}` |

Or use Gmail with the n8n Gmail credential.

---

## 4. Webhook URLs

Only **one** workflow exposes an HTTP webhook for the frontend to call:

| Workflow | Webhook node | Method | Path | Full URL |
|----------|-------------|--------|------|----------|
| `knowledge-chat-agent.json` | `knowledge-chat-webhook` | `POST` | `knowledge-chat` | `${N8N_BASE_URL}/webhook/knowledge-chat` |

All other workflows are **schedule-triggered** or driven by Supabase inserts and do not expose a webhook.

Example frontend call:

```bash
curl -X POST "${N8N_BASE_URL}/webhook/knowledge-chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the IRIAD leave policy?"}'
```

> `${N8N_BASE_URL}` is your n8n instance base URL, e.g. `http://localhost:5678` (local) or your n8n cloud domain. Set it in `.env` (section 6).

---

## 5. Environment variables (.env)

Copy `C:\dev\IRIAD\.env.example` to `.env` and fill in placeholders. The n8n-relevant variables are:

```env
# n8n
N8N_BASE_URL=http://localhost:5678
N8N_WEBHOOK_SECRET=REPLACE_WITH_WEBHOOK_SECRET

# Supabase (server-side; never prefix with VITE_)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=REPLACE_WITH_NEW_ROTATED_SECRET_KEY

# Email
RESEND_API_KEY=REPLACE_WITH_RESEND_KEY
EMAIL_FROM=noreply@yourdomain.com

# NVIDIA (knowledge assistant / RAG)
NVIDIA_API_KEY=REPLACE_WITH_NVIDIA_API_KEY

# Frontend (browser-safe)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=REPLACE_WITH_CURRENT_PUBLISHABLE_KEY
APP_BASE_URL=http://localhost:5173
```

Never commit real secrets. `.env` is gitignored; `.env.example` contains placeholders only.

---

## 6. Verifying each workflow is working

1. In n8n, open the workflow and toggle it **Active**.
2. Open the **Executions** tab. Run the workflow manually (click **Execute Workflow**) or wait for its schedule.
3. Confirm each node executes with a green check and no error nodes.
4. Verify the expected Supabase side effect:

| Workflow | Verify in Supabase |
|----------|-------------------|
| `attendance-open` | A row in `attendance_windows` (window_type = check_in) for today, 08:00–09:00; a notification row |
| `attendance-close-and-daily-report` | Today's `attendance_windows` set to `is_active = false`; a row in `daily_reports` |
| `evening-signout-open-close` | `attendance_windows` sign_out window open 17:00–18:05, then closed |
| `attendance-reminders` | Notification rows of type `attendance_reminder` for staff without today's check-in |
| `task-reminders` | Notification rows for upcoming/overdue tasks |
| `weekly-management-report` | Weekly report row/content generated |
| `monthly-management-report` | Monthly report row/content generated |
| `announcement-email-notification` | Announcement row + notification rows for active recipients |
| `chat-notifications` | Chat message row + notification rows for room members |
| `knowledge-ingestion` | Knowledge source row + chunk rows with embeddings, `indexed = true` |
| `knowledge-chat-agent` | POST to the webhook returns an assistant reply; a `chatbot_messages` row is saved |

5. Check the n8n execution log for any failed node and inspect the error output.

---

## 7. Troubleshooting tips

| Problem | Likely cause / fix |
|---------|-------------------|
| Supabase node returns `401` / `permission denied` | Wrong API key — use the **service role key**, not the anon key. Confirm the credential is selected in the node. |
| Schedule trigger never fires | Confirm the workflow is **Active** and the trigger timezone is **Africa/Lagos**. |
| Webhook returns `404` | Confirm `knowledge-chat-agent` is active and the path is exactly `knowledge-chat`. URL: `${N8N_BASE_URL}/webhook/knowledge-chat`. |
| AI Agent replies "cannot answer from context" | Knowledge base not ingested. Run `knowledge-ingestion` first so chunks + embeddings exist; confirm `NVIDIA_API_KEY` credential is set. |
| Email recipients empty | Confirm `email_report_recipients` has active rows (`is_active = true`). |
| Nodes fail with credential not found | Create the n8n credentials in section 3 and re-select them in each Supabase node. |
| Execution shows stale data | Re-run the workflow; n8n caches node output per execution. |

### Logs

- n8n executions: n8n UI → Workflows → → Executions.
- n8n server logs (docker): `docker logs n8n`
- Supabase edge function logs: `supabase functions logs attendance-checkin`
