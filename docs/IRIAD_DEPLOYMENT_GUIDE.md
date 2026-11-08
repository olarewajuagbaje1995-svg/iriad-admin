# IRIAD Operations Portal — Deployment Guide

**Product:** IRIAD Operations Portal  
**Repository:** `C:\dev\IRIAD`  
**Commit:** `289114c`  
**Guide date:** 2026-11-08  
**Prepared by:** Claude Code

---

## 1. Overview

This guide covers configuring, building, and deploying the IRIAD Operations Portal to a staging or production environment. It covers the frontend (React SPA), Supabase backend (migrations, RLS, Edge Functions, Storage), and n8n automation (primary engine). The native backup engine migrations (011/012) are **planned but not yet applied** — do not apply them to production without separate review and approval.

**Do not** apply production migrations, deploy to production Vercel, activate production n8n workflows, or change production credentials without separate approval.

---

## 2. Prerequisites

- Node.js 18+ and npm (for the frontend build)
- Supabase CLI (for Edge Function deployment and migration application)
- Access to the Supabase project `rvjpdfudghwqcxldrkri`
- An n8n instance (for the primary automation engine) — optional for a minimal deploy
- A hosting platform for the frontend (Vercel recommended) — optional

---

## 3. Environment variables

### 3.1 Frontend (browser-safe, `VITE_*` prefix)

Create a `.env` file in the repository root (gitignored — never commit real values). Use `.env.example` as the template.

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://<project>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key (browser-safe) | `eyJ...` |
| `VITE_N8N_ANNOUNCEMENT_WEBHOOK_URL` | n8n announcement webhook | `https://<n8n>/webhook/announcement` |
| `VITE_N8N_KNOWLEDGE_INGEST_WEBHOOK_URL` | n8n knowledge-ingest webhook | `https://<n8n>/webhook/knowledge-ingest` |
| `VITE_N8N_KNOWLEDGE_CHAT_WEBHOOK_URL` | n8n knowledge-chat webhook | `https://<n8n>/webhook/knowledge-chat` |
| `VITE_DEMO_MODE` | `true` = demo mode (localStorage auth, no Supabase); anything else = real Supabase auth | `false` |

### 3.2 Server-side (never expose with `VITE_*` prefix)

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://<project>.supabase.co` |
| `SUPABASE_SECRET_KEY` | Supabase service-role key (server-side only) | `eyJ...` |
| `N8N_BASE_URL` | n8n base URL for health checks and dispatch | `https://<n8n>` |
| `N8N_WEBHOOK_SECRET` | Secret for validating n8n webhooks/callbacks | `random-secret` |
| `N8N_FAILURE_THRESHOLD` | Consecutive n8n health failures before failover (default 3) | `3` |
| `APP_BASE_URL` | Frontend base URL | `http://localhost:5173` |
| `NVIDIA_API_KEY` | NVIDIA NIM API key for knowledge embeddings/chat | (server-side only) |

### 3.3 Demo vs production separation

Demo mode is controlled solely by `VITE_DEMO_MODE`:
- `VITE_DEMO_MODE=true`: uses `src/lib/demoAuth.ts` — email/password only, session in `localStorage`, independent of Supabase. Demo accounts: `admin@iriad.example`, `director@iriad.example`, `staff@iriad.example`.
- `VITE_DEMO_MODE=false` (or unset): real Supabase Auth.

**Demo data (localStorage) and production data (Supabase) never mix**, provided the local `.env` with `VITE_DEMO_MODE=true` is **never deployed to production**. `.env` is gitignored and is not part of the commit. Production deployment must use real environment variables set in the hosting platform, not the local `.env`.

---

## 4. Local development

```bash
cd C:\dev\IRIAD
# 1. Copy the example env and fill in real values
cp .env.example .env
# edit .env with real Supabase keys (placeholders are not functional)

# 2. Install dependencies
npm install

# 3. Run the dev server
npm run dev

# 4. Type check
npx tsc --noEmit

# 5. Run tests
npm test

# 6. Production build
npm run build
```

The local `.env` ships with `VITE_DEMO_MODE=true`, so the app runs in demo mode without Supabase credentials. To test against real Supabase, set `VITE_DEMO_MODE=false` and provide real keys.

---

## 5. Supabase backend setup

### 5.1 Apply migrations

Apply migrations `001`–`010` in order to the Supabase project:

```bash
supabase link --project-ref rvjpdfudghwqcxldrkri
supabase db push
```

Or apply each SQL file via the Supabase SQL Editor in order: `001_initial_schema.sql` → `010_rag_rpc.sql`.

**Do not apply migration 011/012 to production** until they are created as files, reviewed, and approved. They are planned in `docs/DUAL_AUTOMATION_ARCHITECTURE.md` §16 but do not yet exist in the repository.

### 5.2 Load seed data (demo/staging only)

After creating real Auth users, load `supabase/seed.sql` to populate demo organisations, profiles, and reference data. The seed is labelled demo data.

**Do not load seed data into production** unless production demo data is explicitly desired.

### 5.3 Storage

Migration 006 creates the `documents` Storage bucket (private). Documents are downloaded via signed URLs. Ensure the bucket exists in the target project; the migration uses `on conflict (id) do nothing`.

### 5.4 Edge Functions

Deploy each Edge Function to Supabase:

```bash
supabase functions deploy attendance-checkin
supabase functions deploy automation-dispatcher
# ... repeat for all 25 functions
```

Or deploy all:
```bash
supabase functions deploy
```

Edge Functions require server-side secrets (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`) set in the Supabase Edge Function secret store or project environment.

### 5.5 pg_cron / pg_net (native backup engine scheduling)

The native backup engine uses Supabase Cron (pg_cron) to invoke Edge Functions on a schedule. Confirm availability **before** applying migration 012:

```sql
SELECT * FROM pg_available_extensions WHERE name IN ('pg_cron', 'pg_net');
```

If available:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

Then schedule (per `docs/DUAL_AUTOMATION_ARCHITECTURE.md` §9):
- `automation-health-check`: `* * * * *` (every minute)
- `automation-dispatcher`: `* * * * *` (every minute)
- `automation-lease-reaper`: `*/15 * * * *`
- `automation-missed-schedule-recovery`: `0 * * * *` (hourly)

**Independent scheduling fallback** (if pg_cron/pg_net are unavailable): invoke the same Edge Function URLs on a schedule via Vercel Cron or GitHub Actions, sending `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`. No n8n or active browser session is required.

---

## 6. n8n automation engine (primary)

n8n is the permanent primary automation engine. Existing workflows are preserved unchanged.

### 6.1 Import workflows

- `n8n/IRIAD_MASTER_WORKFLOW.json` (92 nodes, 8 sections)
- `n8n/IRIAD_ERROR_HANDLER.json` (6 nodes)

Import via the n8n UI. Workflows are exported inactive (`"active": false`) — **do not activate without live credentials and explicit authorisation.**

### 6.2 Configure n8n credentials

| Credential | Used by |
|------------|---------|
| Supabase (service-role key) | All Supabase HTTP Request nodes |
| NVIDIA API | Embeddings + LLM nodes |
| Gmail (OAuth2) | All 9 email delivery nodes |
| `N8N_WEBHOOK_SECRET` | Webhook validation (env) |
| `IRIAD_ORGANISATION_ID`, `SUPABASE_URL`, `ADMIN_EMAIL` | Workflow env vars |

All 3 webhooks validate `x-webhook-secret` against `$env.N8N_WEBHOOK_SECRET`.

### 6.3 Email

All outgoing email uses native n8n Gmail nodes (9 nodes). Resend has been fully removed from the project. Configure the Gmail OAuth2 credential in n8n before email delivery will work.

---

## 7. Frontend deployment (Vercel recommended)

```bash
npm run build
# outputs to dist/
```

Deploy `dist/` to Vercel (or any static host). Set the frontend environment variables (section 3.1) in the hosting platform — **not** the local `.env`.

Ensure `VITE_DEMO_MODE=false` (or unset) in production so real Supabase Auth is used.

---

## 8. Rollback procedures

### Frontend
- Revert to the previous deployed build on the hosting platform (Vercel supports instant rollback).

### Supabase migrations
- **Migration 012 (schema only):** fully reversible before production use — `DROP TABLE`/`DROP FUNCTION` the new automation objects. Once jobs exist in production, dropping them loses execution history; rollback is only safe before go-live.
- **Migration 011 (role data mapping):** not directly reversible from a dump alone — previous role values are not recorded. Rollback requires restoring a pre-migration snapshot (`pg_dump`).
- Always take a `pg_dump` snapshot of the Supabase project before applying any migration, and test both migrations on a staging copy first.

### n8n
- Workflows are inactive by default. To roll back, deactivate the master workflow and re-import the previous version.

---

## 9. Secrets management

- `.env` is gitignored — never commit it.
- `.env.example` contains placeholders only — never real secrets.
- `SUPABASE_SECRET_KEY` was previously exposed in conversation — treat as compromised; rotate in the Supabase dashboard before production use.
- No secrets in frontend bundles (only `VITE_*` vars).
- No hardcoded credentials in n8n workflow exports (all use `$env.*`).
- Rotate `NVIDIA_API_KEY`, `N8N_WEBHOOK_SECRET`, and Gmail credentials on a regular schedule.

---

## 10. Pre-deployment checklist

- [ ] Real `.env` created with Supabase URL/publishable key, service-role key, `NVIDIA_API_KEY`, `N8N_BASE_URL`, `N8N_WEBHOOK_SECRET`, `ADMIN_EMAIL`
- [ ] `VITE_DEMO_MODE=false` (or unset) in production environment
- [ ] Migrations `001`–`010` applied to Supabase project
- [ ] `pg_dump` snapshot taken before any migration
- [ ] Migration 011/012 reviewed, approved, and applied on staging first (not yet created as files)
- [ ] `pg_cron` / `pg_net` availability confirmed, or external scheduler configured
- [ ] Edge Functions deployed to Supabase
- [ ] `SUPABASE_SECRET_KEY` rotated (was previously exposed)
- [ ] n8n master workflow + error handler imported; credentials configured
- [ ] Live RLS/permission tests run against Supabase
- [ ] Timezone bug in Edge Functions fixed (use `Africa/Lagos` explicitly) before production
- [ ] Do **not** push to GitHub, deploy to production Vercel, activate production n8n workflows, or change production credentials without separate approval
