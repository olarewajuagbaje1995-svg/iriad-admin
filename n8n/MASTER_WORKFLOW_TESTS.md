# IRIAD Master Workflow — Tests

This document describes how to test the IRIAD Master Workflow (consolidated n8n workflow).

## Test strategy

Because n8n workflows are server-side automation, tests fall into two groups:

1. **Offline / static validation** (no credentials needed): JSON validity, node types, connection integrity, column/table reference correctness.
2. **Live / integration tests** (requires n8n + Supabase credentials): trigger execution, end-to-end data flow, RLS enforcement.

## Section 1 — Offline validation (no credentials)

These checks can be run locally without n8n or Supabase access.

### T1 — Workflow JSON is valid
**Goal**: Confirm `n8n/IRIAD_MASTER_WORKFLOW.json` parses as valid JSON.

**Steps**:
```bash
node -e "JSON.parse(require('fs').readFileSync('n8n/IRIAD_MASTER_WORKFLOW.json','utf8')); console.log('OK');"
```

**Expected**: Prints `OK` with no error.

### T2 — All node types are known n8n node types
**Goal**: Confirm every node uses a real n8n node type.

**Steps**: Check each node's `type` field against this allowlist:

- `n8n-nodes-base.scheduleTrigger`
- `n8n-nodes-base.webhook`
- `n8n-nodes-base.supabase`
- `n8n-nodes-base.httpRequest`
- `n8n-nodes-base.if`
- `n8n-nodes-base.stickyNote`
- `n8n-nodes-base.noOp`
- `n8n-nodes-base.gmail`

**Expected**: All node types are in the allowlist.

### T3 — All connections reference existing node IDs
**Goal**: Confirm every connection source and target references a node `id` that exists.

**Steps**: For each entry in `connections`, verify `source` is a node `id` and each branch target `node` is a node `id`.

**Expected**: No dangling references.

### T4 — No hardcoded organisation UUID
**Goal**: Confirm no workflow node hardcodes `00000000-0000-0000-0000-000000000001` or any literal org UUID.

**Steps**: Grep the workflow JSON for `00000000-0000-0000-0000-000000000001`.

**Expected**: No matches.

### T5 — No hardcoded secrets
**Goal**: Confirm no workflow node contains a literal API key, secret, or password.

**Steps**: Grep the workflow JSON for `nvapi-`, `eyJ`, `sk-`, or `REPLACE_WITH`.

**Expected**: No matches.

### T6 — All schedule triggers use Africa/Lagos timezone
**Goal**: Confirm every `scheduleTrigger` node has `timezone: "Africa/Lagos"`.

**Steps**: For each `scheduleTrigger` node, check `parameters.timezone`.

**Expected**: All are `"Africa/Lagos"`.

### T7 — All webhooks validate the secret
**Goal**: Confirm every `webhook` node is followed by an `if` node that validates `x-webhook-secret` against `$env.N8N_WEBHOOK_SECRET`.

**Steps**: Trace from each webhook node to its first `if` node; confirm the condition checks `headers['x-webhook-secret']` equals `$env.N8N_WEBHOOK_SECRET`.

**Expected**: All three webhooks (announcement, knowledge-ingest, knowledge-chat) have secret validation.

### T8 — No references to removed tables/columns
**Goal**: Confirm no node references `attendance_windows`, `daily_reports`, `indexed`, `indexed_at`, `assignee_id`, or `sender_id`.

**Steps**: Grep the workflow JSON for each removed identifier.

**Expected**: No matches. Correct references are:
- `attendance_windows` → `attendance_sessions`
- `daily_reports` → `generated_reports`
- `indexed`/`indexed_at` → `indexing_status`/`last_indexed_at`
- `assignee_id` → task_assignees join via `project_members`/`tasks`
- `sender_id` → `profile_id`

## Section 2 — Live / integration tests (requires credentials)

These require a running n8n instance, applied Supabase migrations, and real credentials.

### T9 — Import master workflow into n8n
**Goal**: Confirm the workflow imports without errors.

**Steps**:
1. Open n8n → Workflows → Import from file.
2. Select `n8n/IRIAD_MASTER_WORKFLOW.json`.
3. Confirm all 229 nodes appear on the canvas (including 13 Gmail nodes).

**Expected**: Import succeeds; workflow is listed and inactive.

### T9a — Gmail nodes present and configured
**Goal**: Confirm all 13 Gmail nodes exist and use the Gmail credential.

**Steps**:
1. In the imported workflow, confirm Gmail nodes exist for: check-in open, missing check-in, sign-out open, missing sign-out, approvals, task digest, event digest, weekly report reminder, monthly report reminder, daily management report, weekly management report, monthly management report, announcement.
2. Confirm each Gmail node has the `Gmail` OAuth2 credential selected.
3. Confirm each Gmail node uses `sendTo: ={{ $json.to }}` for dynamic recipient resolution.

**Expected**: 13 Gmail nodes present, all with Gmail credential and dynamic recipient.

### T10 — Configure credentials
**Goal**: Confirm n8n credentials exist for Supabase, NVIDIA, and Gmail.

**Steps**:
1. n8n → Settings → Credentials.
2. Confirm `IRIAD Supabase` credential uses `SUPABASE_SERVICE_ROLE_KEY`.
3. Confirm `NVIDIA API` credential exists for embeddings/LLM.
4. Confirm `Gmail` OAuth2 credential exists for email sending.
5. Confirm `ADMIN_EMAIL` environment variable is set to `olarewajuagbaje@gmail.com`.

**Expected**: All credentials present and selected in relevant nodes.

### T11 — Section 1: Attendance open/close (live)
**Goal**: Confirm check-in window opens at 08:00 Lagos and closes at 09:05 Lagos.

**Steps**:
1. Activate the master workflow.
2. Wait for 08:00 Lagos schedule (or execute the `attendance-open-trigger` branch manually).
3. Check Supabase: `attendance_sessions` has a row for today with `morning_opened_at` set.
4. Check Supabase: `notifications` has a row of type `attendance_opening`.
5. Execute the `attendance-close-trigger` branch manually.
6. Check: `attendance_sessions.morning_closed_at` is set.

**Expected**: Rows created/updated correctly; notifications sent.

### T12 — Section 1: Missing check-in reminder (live)
**Goal**: Confirm staff who haven't checked in by 09:05 get a reminder.

**Steps**:
1. Ensure a staff member has no `attendance` row for today.
2. Execute the `attendance-close-trigger` branch manually.
3. Check Supabase: `notifications` has a row of type `attendance_reminder` for that staff member.

**Expected**: Reminder notification created.

### T13 — Section 3: Weekly report idempotency (live)
**Goal**: Confirm running the weekly report twice does not create duplicate `generated_reports` rows.

**Steps**:
1. Execute the `weekly-report-trigger` branch manually.
2. Check Supabase: one `generated_reports` row with `report_type = 'weekly'` and an `idempotency_key`.
3. Execute the branch again.
4. Check: still only one row for that idempotency key (upsert behavior).

**Expected**: No duplicate rows.

### T14 — Section 6: Knowledge ingestion webhook (live)
**Goal**: Confirm POST to `/webhook/knowledge-ingest` triggers ingestion.

**Steps**:
1. Create a `knowledge_sources` row in Supabase with `indexing_status = 'pending'`.
2. POST to `${N8N_BASE_URL}/webhook/knowledge-ingest` with `x-webhook-secret` header and body `{"source_id": "<id>", "source_type": "text"}`.
3. Check: `knowledge_sources.indexing_status` becomes `indexed`; `knowledge_chunks` rows exist with embeddings.

**Expected**: Source indexed, chunks stored with embeddings.

### T15 — Section 7: Knowledge chat webhook (live)
**Goal**: Confirm POST to `/webhook/knowledge-chat` returns a grounded answer.

**Steps**:
1. Ensure at least one indexed `knowledge_chunks` row exists with an embedding.
2. POST to `${N8N_BASE_URL}/webhook/knowledge-chat` with valid secret and body `{"question": "...", "conversation_id": "<id>", "profile_id": "<id>"}`.
3. Check response: contains an `answer` and `sources`.
4. Check Supabase: `chatbot_messages` has an assistant reply row.

**Expected**: Grounded answer with citations; message saved.

### T16 — Section 8: Error handling (live)
**Goal**: Confirm failures are logged to `automation_runs` and admins are notified.

**Steps**:
1. Temporarily point an HTTP Request node to an invalid URL.
2. Execute the affected branch.
3. Check Supabase: `automation_runs` has a failed row; `notifications` has a failure alert.

**Expected**: Failure logged and admin notified; other sections unaffected.

### T17 — RLS: knowledge chunks role filtering (live)
**Goal**: Confirm staff cannot retrieve admin-only knowledge chunks via `match_knowledge_chunks`.

**Steps**:
1. Create a chunk with `allowed_roles = ['super_admin']` and `visibility != 'all_staff'`.
2. Call `match_knowledge_chunks` as a `staff` role user.
3. Check: the admin-only chunk is not returned.

**Expected**: Role-based filtering enforced by RLS/RPC.

### T18 — Error handler workflow (live)
**Goal**: Confirm the IRIAD Error Handler workflow captures failures, deduplicates, logs to Supabase, and sends Gmail alerts.

**Steps**:
1. Import `n8n/IRIAD_ERROR_HANDLER.json` into n8n.
2. Configure `Gmail` credential, `ADMIN_EMAIL` env var, and `IRIAD Supabase` credential.
3. In the master workflow settings, confirm `errorWorkflowId` is set to `iriad-error-handler`.
4. Cause a test failure in any branch of the master workflow (e.g. point an HTTP Request to an invalid URL).
5. Confirm the Error Trigger fires and captures: workflow name, node name, execution ID, execution URL, error message, Africa/Lagos timestamp.
6. Confirm deduplication: re-triggering the same execution ID does not create duplicate `automation_runs` rows.
7. Check Supabase: `automation_runs` has a failed row; `notifications` has a `system_error` row.
8. Check Gmail: alert received at olarewajuagbaje@gmail.com with execution details.

**Expected**: Error alert email delivered; error logged to Supabase; no duplicate alerts for same execution ID.

### T19 — Static validation (no credentials)
**Goal**: Confirm `n8n/validate-workflow.cjs` passes all checks for both workflows.

**Steps**:
```bash
node n8n/validate-workflow.cjs
```

**Expected**: `ALL CHECKS PASSED` with 0 failures and 0 warnings.

## Test execution summary

| Test ID | Area | Credentials needed | Automated? |
|---------|------|-------------------|------------|
| T1 | JSON validity | No | Yes |
| T2 | Node types | No | Yes |
| T3 | Connection integrity | No | Yes |
| T4 | No hardcoded org UUID | No | Yes |
| T5 | No hardcoded secrets | No | Yes |
| T6 | Lagos timezone | No | Yes |
| T7 | Webhook secret validation | No | Yes |
| T8 | Removed table/column refs | No | Yes |
| T9 | Import + node count | No | Yes |
| T9a | Gmail nodes present | No | Yes |
| T10–T18 | Live execution | Yes | Partial |
| T19 | Static validation script | No | Yes |

Run T1–T8 and T19 before importing into n8n. Run T9–T18 after the master workflow is imported and activated.
