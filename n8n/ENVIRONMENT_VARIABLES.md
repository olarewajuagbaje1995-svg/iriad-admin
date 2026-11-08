# IRIAD Master Workflow — Environment Variables

This document lists all environment variables required by the IRIAD Master Workflow and related automation.

## Where to set variables

- **n8n environment variables**: Set in n8n (**Settings → Environment Variables**) or in the n8n `.env` file. These are referenced in workflow nodes as `$env.VARIABLE_NAME`.
- **Supabase Edge Function variables**: Set in Supabase (Project Settings → Edge Functions → Environment variables) or via `supabase secrets set`.
- **Frontend variables**: Prefixed with `VITE_`, set in `.env` (gitignored) and `.env.example` (placeholders only). Never prefix secrets with `VITE_`.

## n8n environment variables (server-side, never in browser)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `N8N_BASE_URL` | Yes | Base URL of the n8n instance, used for webhook callbacks and embedding/LLM HTTP requests | `http://localhost:5678` |
| `N8N_WEBHOOK_SECRET` | Yes | Shared secret for authenticating webhook calls from the frontend | `changeme-strong-secret-32chars` |
| `IRIAD_ORGANISATION_ID` | Yes | UUID of the IRIAD organisation. Prevents hardcoding org IDs in workflow nodes | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `SUPABASE_URL` | Yes | Supabase project URL | `https://rvjpdfudghwqcxldrkri.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only). Never expose in frontend. | `eyJhbGciOiJ...` |
| `NVIDIA_API_KEY` | Yes | NVIDIA NIM API key for embeddings and LLM generation | `nvapi-...` |
| `ADMIN_EMAIL` | Yes | Admin email address for system alerts and error notifications | `olarewajuagbaje@gmail.com` |

## Supabase Edge Function environment variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `SUPABASE_URL` | Yes | Supabase project URL | `https://rvjpdfudghwqcxldrkri.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for privileged DB operations | `eyJhbGciOiJ...` |
| `SUPABASE_ANON_KEY` | Yes | Anon/public key for client-side auth | `eyJhbGciOiJ...` |

## Frontend environment variables (browser-safe, VITE_ prefix)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL (browser-safe) | `https://rvjpdfudghwqcxldrkri.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon/publishable key (browser-safe) | `eyJhbGciOiJ...` |
| `VITE_CHATBOT_WEBHOOK_URL` | No | n8n knowledge-chat webhook URL for the chatbot (deprecated — use `VITE_N8N_KNOWLEDGE_CHAT_WEBHOOK_URL`) | `http://localhost:5678/webhook/knowledge-chat` |
| `VITE_KNOWLEDGE_INGEST_WEBHOOK_URL` | No | n8n knowledge-ingest webhook URL for triggering ingestion (deprecated — use `VITE_N8N_KNOWLEDGE_INGEST_WEBHOOK_URL`) | `http://localhost:5678/webhook/knowledge-ingest` |
| `VITE_N8N_ANNOUNCEMENT_WEBHOOK_URL` | No | n8n announcement webhook URL for creating announcements from the frontend | `https://olarewajuagbaje-n8n-automation-hub.hf.space/webhook/announcement` |
| `VITE_N8N_KNOWLEDGE_INGEST_WEBHOOK_URL` | No | n8n knowledge-ingest webhook URL for triggering ingestion | `https://olarewajuagbaje-n8n-automation-hub.hf.space/webhook/knowledge-ingest` |
| `VITE_N8N_KNOWLEDGE_CHAT_WEBHOOK_URL` | No | n8n knowledge-chat webhook URL for the chatbot | `https://olarewajuagbaje-n8n-automation-hub.hf.space/webhook/knowledge-chat` |
| `APP_BASE_URL` | No | Application base URL | `http://localhost:5173` |

## Security rules

- **Never** commit real secrets. `.env` is gitignored; `.env.example` contains placeholders only.
- **Never** prefix secret keys with `VITE_` — they would be embedded in the frontend bundle.
- **Never** send `SUPABASE_SERVICE_ROLE_KEY`, `NVIDIA_API_KEY`, `N8N_WEBHOOK_SECRET`, or email credentials to the browser.
- Use **server-side Edge Functions** or **protected n8n credentials** for privileged operations.
- **Never trust browser-sent** `role` or `user_id`; always validate against the Supabase session/JWT.
- **Never print credentials in logs**.

## Example .env (placeholders only)

```env
# ============================================================
# IRIAD Operations Portal — .env (COPY FROM .env.example)
# Real values go here; this file is gitignored.
# ============================================================

# --- Frontend (browser-safe, VITE_ prefix only) ---
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=REPLACE_WITH_PUBLISHABLE_KEY
VITE_N8N_ANNOUNCEMENT_WEBHOOK_URL=https://olarewajuagbaje-n8n-automation-hub.hf.space/webhook/announcement
VITE_N8N_KNOWLEDGE_INGEST_WEBHOOK_URL=https://olarewajuagbaje-n8n-automation-hub.hf.space/webhook/knowledge-ingest
VITE_N8N_KNOWLEDGE_CHAT_WEBHOOK_URL=https://olarewajuagbaje-n8n-automation-hub.hf.space/webhook/knowledge-chat
APP_BASE_URL=http://localhost:5173

# --- n8n (server-side) ---
N8N_BASE_URL=http://localhost:5678
N8N_WEBHOOK_SECRET=REPLACE_WITH_WEBHOOK_SECRET
IRIAD_ORGANISATION_ID=REPLACE_WITH_ORG_UUID
ADMIN_EMAIL=olarewajuagbaje@gmail.com

# --- Supabase (server-side; never VITE_ prefix) ---
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_SERVICE_ROLE_KEY

# --- NVIDIA (server-side; never VITE_ prefix) ---
NVIDIA_API_KEY=REPLACE_WITH_NVIDIA_API_KEY
```

## Rotation

If any secret is compromised (e.g. `SUPABASE_SERVICE_ROLE_KEY` was previously exposed), rotate it immediately:
1. Generate a new key in Supabase (Project Settings → API).
2. Update all environments (n8n, Edge Functions, `.env`).
3. Revoke the old key.
4. Re-import/re-activate n8n workflows if credentials changed.
