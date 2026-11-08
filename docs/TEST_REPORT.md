# IRIAD Operations Portal — Test Report

Test results are recorded here per READ.ME instruction #5 ("After each phase, run TypeScript checks, linting and tests") and acceptance criteria §22.

## Automated checks

| Check | Tool | Result | Notes |
|-------|------|--------|-------|
| TypeScript type check | `tsc --noEmit` | PASS | Zero errors |
| Production build | `vite build` | PASS | dist/ built (~1,045 KB JS, gzip ~287 KB) |
| Lint | eslint | NOT RUN | eslint config not yet added |
| Unit + integration tests | vitest | PASS | 43 tests passing across 6 files |
| Master workflow JSON validity | node JSON.parse | PASS | 92 nodes, 62 connections |
| Error handler JSON validity | node JSON.parse | PASS | 6 nodes, 3 connections |
| Workflow connection integrity | custom script | PASS | No dangling references (all Gmail nodes connected) |
| Resend removal | grep | PASS | Zero Resend/SMTP references in source files |
| Gmail node coverage | custom script | PASS | 9 Gmail nodes for all email categories |
| Webhook path verification | custom script | PASS | 3 webhook paths with secret validation |

## Unit test results

| File | Tests | Result |
|------|-------|--------|
| `src/lib/dates.test.ts` | 7 | PASS |
| `src/lib/permissions.test.ts` | 7 | PASS |
| `src/lib/attendance-boundary.test.ts` | 8 | PASS |
| `src/features/attendance/duplicate-prevention.test.ts` | 6 | PASS |
| `src/features/chat/chat.integration.test.ts` | 6 | PASS |
| `src/features/knowledge-base/rag-access.test.ts` | 9 | PASS |

**Total: 43 tests, 0 failures.**

## n8n workflow validation

The master workflow (`n8n/IRIAD_MASTER_WORKFLOW.json`) and error handler (`n8n/IRIAD_ERROR_HANDLER.json`) were validated offline:

- **T1 — JSON validity**: Both files parse as valid JSON
- **T2 — Node types**: All node types are known n8n types (scheduleTrigger, webhook, supabase, httpRequest, if, stickyNote, noOp, gmail)
- **T3 — Connection integrity**: All connection source/target references point to existing node IDs
- **T4 — No hardcoded org UUID**: No literal org UUIDs in workflow JSON
- **T5 — No hardcoded secrets**: No literal API keys, secrets, or passwords in workflow JSON
- **T6 — Lagos timezone**: All scheduleTrigger nodes use Africa/Lagos
- **T7 — Webhook secret validation**: All 3 webhooks validate x-webhook-secret against $env.N8N_WEBHOOK_SECRET
- **T8 — No removed table/column refs**: No references to removed tables/columns
- **T9 — Import readiness**: 92 nodes (83 workflow + 9 Gmail) ready for n8n import

## To be performed (Phase 7 — live DB, blocked on credentials)

These require a live Supabase connection and cannot run without `.env` credentials and applied migrations:

- [ ] RLS: sign in as staff, confirm cannot read another organisation's profiles
- [ ] RLS: staff cannot update another staff's attendance record
- [ ] RLS: only staff_admin/super_admin can manage projects/roles
- [ ] Attendance boundary: check-in rejected outside 8:00–9:00 Africa/Lagos (server-side Edge Function)
- [ ] Duplicate prevention: unique staff+date prevents two check-ins same day
- [ ] Idempotency: n8n-style daily report does not double-send
- [ ] Chat room membership: non-member cannot read/send messages (RLS)
- [ ] RAG: staff cannot retrieve admin-only knowledge chunks
- [ ] n8n: master workflow + error handler import into n8n (see `n8n/README.md`)
- [ ] Mobile/layout checks on key pages
- [ ] Email failure/retry behaviour

## Notes

vitest suite runs without Supabase credentials (supabase client mocked via `vi.mock('@/lib/supabase')`). All 43 tests pass.

No live-Supabase tests have been executed yet because credentials and migrations are not configured. Once `.env` is populated and migrations applied to project `rvjpdfudghwqcxldrkri`, run the Phase 7 checklist above and record actual results here.

Edge Function `attendance-checkin` is implemented and ready for deployment via `supabase functions deploy attendance-checkin` (requires Supabase CLI + project link).
