# IRIAD Operations Portal — Deployment

Local setup and deployment instructions for the IRIAD Operations Portal frontend, Supabase database, and Edge Functions.

---

## 1. Prerequisites

- [Node.js](https://nodejs.org/) (v18+) and npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`supabase --version`)
- [n8n](https://docs.n8n.io/) (for workflow automation; see `n8n/README.md`)
- A [Supabase](https://supabase.com) project (for local dev you can run Supabase locally or connect to a remote project)

Verify tooling:

```bash
node --version
npm --version
supabase --version
```

---

## 2. Environment setup

Copy the example environment file:

```bash
cp .env.example .env
```

Then fill in the placeholders in `.env`. Never commit real secrets.

```env
# Supabase project (browser-safe: URL + publishable key only)
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}

# Server-side only (backend/Edge Functions). NEVER expose with a VITE_ prefix.
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SECRET_KEY=${SUPABASE_SECRET_KEY}

# Optional server-side services
N8N_BASE_URL=${N8N_BASE_URL}
N8N_WEBHOOK_SECRET=${N8N_WEBHOOK_SECRET}
RESEND_API_KEY=${RESEND_API_KEY}
EMAIL_FROM=${EMAIL_FROM}
APP_BASE_URL=http://localhost:5173

# NVIDIA API (AI model provider for knowledge assistant / RAG). Configure locally in .env only.
NVIDIA_API_KEY=${NVIDIA_API_KEY}
```

Key variables:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL (frontend) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key (frontend) |
| `SUPABASE_URL` | Supabase project URL (server-side / Edge Functions) |
| `SUPABASE_SECRET_KEY` | Supabase service role secret key (server-side only) |
| `N8N_BASE_URL` | Base URL of your n8n instance |
| `N8N_WEBHOOK_SECRET` | Secret for validating n8n webhooks |
| `ADMIN_EMAIL` | Admin email for Gmail alerts |
| `EMAIL_FROM` | From address for emails |
| `APP_BASE_URL` | Frontend URL (default `http://localhost:5173`) |
| `NVIDIA_API_KEY` | NVIDIA API key for knowledge assistant / RAG |

---

## 3. Database migration steps (001–009)

Apply the Supabase migrations in `supabase/migrations/` in numeric order:

```bash
# Link to your Supabase project (remote)
supabase login
supabase link --project-ref ${PROJECT_REF}

# Or start Supabase locally
supabase start

# Apply all migrations
supabase db push
```

This applies migrations `001` through `009`:

| Migration | Tables created |
|-----------|----------------|
| `001_initial_schema.sql` | organisations, departments, profiles, organisation_members, system_settings, activity_logs (+ RLS) |
| `002_attendance.sql` | attendance_policy, working_calendar, attendance_sessions, attendance, attendance_corrections, leave_requests |
| `003_tasks_projects.sql` | projects, project_members, project_milestones, tasks, task_assignees, task_updates, ... |
| `004_reports.sql` | daily_reports, weekly_reports, monthly_reports, email_report_recipients |
| `005_communication.sql` | announcements, chat_rooms, chat_room_members, chat_messages, notifications |
| `006_documents_calendar.sql` | documents, calendar_events |
| `007_notifications.sql` | notification preferences / templates |
| `008_rag.sql` | knowledge_sources, knowledge_chunks (pgvector) |
| `009_rag_content.sql` | content column on knowledge_sources |

To reset the local database and re-apply from scratch:

```bash
supabase db reset
```

---

## 4. Seed data

Migration `001` seeds the IRIAD organisation (`slug: iriad`) automatically. Additional reference data (departments, attendance policy, working days) can be inserted via the Supabase SQL editor or the frontend admin UI after migration.

Example: set the attendance policy for the organisation:

```sql
insert into public.attendance_policy (organisation_id, working_days, morning_open_time, morning_close_time)
values (
  '00000000-0000-0000-0000-000000000001',
  '{1,2,3,4,5}',
  '08:00',
  '09:00'
) on conflict (organisation_id) do nothing;
```

---

## 5. Running the frontend

Install dependencies:

```bash
npm install
```

Run the development server (Vite, `http://localhost:5173`):

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Lint:

```bash
npm run lint
```

The frontend connects to Supabase using `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

---

## 6. Running tests

```bash
npm run test
```

Tests use [Vitest](https://vitest.dev/) with jsdom. Run in watch mode:

```bash
npx vitest
```

---

## 7. Edge Function deployment

Edge Functions live in `supabase/functions/`. The project includes:

- `supabase/functions/attendance-checkin/index.ts` — validates and records staff check-ins (attendance window, working day, late status, RLS).

Deploy the check-in function:

```bash
supabase functions deploy attendance-checkin
```

Set required secrets for the function (supabase project must be linked):

```bash
supabase secrets set SUPABASE_URL=${SUPABASE_URL} SUPABASE_ANON_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}
```

List deployed functions:

```bash
supabase functions list
```

View function logs:

```bash
supabase functions logs attendance-checkin
```

Call the function from the frontend:

```ts
const { data, error } = await supabase.functions.invoke('attendance-checkin', {
  body: { attendance_type: 'office', check_in_note: '', work_date: '2026-01-09' },
})
```

---

## 8. Connect frontend to live Supabase

1. Create a project at [supabase.com](https://supabase.com) and note the Project URL and anon/public key.
2. Run migrations against the project:

   ```bash
   supabase login
   supabase link --project-ref ${PROJECT_REF}
   supabase db push
   ```

3. Add the values to `.env`:

   ```env
   VITE_SUPABASE_URL=https://${PROJECT_REF}.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_PUBLIC_KEY}
   SUPABASE_URL=https://${PROJECT_REF}.supabase.co
   SUPABASE_SECRET_KEY=${SERVICE_ROLE_KEY}
   ```

4. Restart the dev server so it picks up the new env vars:

   ```bash
   npm run dev
   ```

5. Confirm the frontend loads and can read/write Supabase tables (RLS policies are enabled on all tables; sign in as a user with a `profiles` row).

---

## Related

- `n8n/README.md` — n8n workflow import, credentials, webhook URLs, and verification.
- `supabase/migrations/` — database schema (001–009).
- `supabase/functions/attendance-checkin/index.ts` — attendance check-in Edge Function.
