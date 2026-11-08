# IRIAD Operations Portal — Known Issues

Unresolved bugs, blockers, and placeholder items. Updated continuously.

## Blockers (!)

- No real Supabase credentials configured: `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` are placeholders in `.env.example`. The app will not connect to Supabase until a real `.env` is created and the database migrations are applied to project `rvjpdfudghwqcxldrkri`.
- Supabase secret key was previously exposed in conversation — treat as compromised; rotate in Supabase dashboard before use.
- n8n instance not connected; `N8N_BASE_URL` and `N8N_WEBHOOK_SECRET` are placeholders. Email/Gmail (`ADMIN_EMAIL`, Gmail credential) not configured.
- NVIDIA API key (`NVIDIA_API_KEY`) is a placeholder; real key goes in local `.env` only. AI/chatbot features will return a "not configured" message until a key and n8n AI Agent workflow are set up.
- Live n8n workflows not imported/tested — see `n8n/README.md` for import instructions once n8n is available.
- Edge Function `attendance-checkin` not yet deployed to Supabase — deploy via `supabase functions deploy attendance-checkin`.

## Known issues (~)

- Auth is placeholder-gated: `ProtectedRoute` checks for a Supabase session; demo credentials shown in LoginPage UI do not actually exist until seed data is loaded into Supabase.
- Chat realtime subscription in ChatPage is not cleaned up on unmount (missing channel cleanup) — minor memory/reconnect concern.

## Not started ( )

- End-to-end tests against live Supabase (awaiting `.env` + migrations + n8n instance).

## Recently completed

- Leave/remote/field-work admin approval UI (LeavePage enhanced with approve/reject).
- Attendance corrections/overrides UI with audit history (AttendanceCorrectionsPage).
- Custom project table builder UI (ProjectTableBuilderPage).
- Chat attachments, emoji reactions, read receipts (ChatPage enhanced).
- Weekly/monthly reports toggle (ReportsPage).
- DashboardPage with real stats from Supabase.
- CeoDashboardPage with recharts charts (attendance trend, leave by type).
- Knowledge Base file upload (PDF/DOCX/TXT/MD/CSV) + text/url/faq ingestion UI.
- ChatbotPage uses `VITE_N8N_KNOWLEDGE_CHAT_WEBHOOK_URL` env var for n8n webhook.
- Edge Function `attendance-checkin` for server-side 8–9 AM Africa/Lagos check-in enforcement.
- `n8n/README.md` with workflow setup/verification instructions.
- `DEPLOYMENT.md` with local setup/deployment instructions.
- 4 new integration test files (43 total tests, all passing).
- Six guide docs: SYSTEM_OVERVIEW, DATABASE_GUIDE, SECURITY_GUIDE, N8N_SETUP, RAG_GUIDE, USER_GUIDE.
- n8n master workflow + error handler rebuilt with Gmail nodes, 11 legacy workflows archived
- `supabase/seed.sql` created (labelled demo data).
- Migration 009 added `content` column to knowledge_sources; Migration 006 added documents Storage bucket.
- TypeScript check (`tsc --noEmit`) clean; production build succeeds (~1,045 KB JS); all 43 tests passing; n8n master workflow validated (92 nodes, 62 connections, 9 Gmail nodes).
- Form validation (react-hook-form + zod) applied to ReportsPage, KnowledgeBasePage, LeavePage, AttendanceCorrectionsPage.
- Search/filter added to ReportsPage reports list and ChatPage rooms list.
- PDF generation utility created (`src/lib/pdf.ts`) with print-to-PDF download button on ReportsPage.
