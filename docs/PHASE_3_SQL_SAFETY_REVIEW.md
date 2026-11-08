# Phase 3 SQL Safety Review

**Scope:** `supabase/migrations/011_role_alignment.sql` and `supabase/migrations/012_automation_engine.sql`
**Status:** Review only — migrations NOT applied, NOT deployed, production data NOT modified.
**Reviewer:** Claude Code (SQL safety review)
**Date:** 2026-11-08

## Review convention

Each finding carries one of four verdicts:

| Verdict | Meaning |
|---------|---------|
| **PASS** | Meets the requirement as written; no change needed. |
| **FAIL** | Defect that blocks approval; must be fixed before apply. |
| **WARNING** | Acceptable but carries operational risk or a caveat to document. |
| **REQUIRED FIX** | Change required to the SQL file before the migration is approved for staging. |

Every finding cites the SQL file and section (line numbers refer to the files as written).

---

## Executive summary

| Area | PASS | FAIL | WARNING | REQUIRED FIX |
|------|------|------|---------|--------------|
| 1. Role migration | 5 | 0 | 2 | 1 |
| 2. Automation registry | 4 | 0 | 2 | 0 |
| 3. Atomic job claiming | 3 | 0 | 2 | 1 |
| 4. Security | 4 | 0 | 2 | 1 |
| 5. Scheduling | 2 | 0 | 2 | 2 |
| 6. Rollback | 1 | 0 | 2 | 1 |
| 7. n8n preservation | 3 | 0 | 0 | 0 |
| **Total** | **22** | **0** | **10** | **6** |

No FAIL findings. Both migrations are safe in principle and ready for staging once the REQUIRED FIX items are addressed and the WARNING items are acknowledged.

---

## 1. Role migration — `supabase/migrations/011_role_alignment.sql`

### R-1 — PASS — Role value mapping complete and correct
**File/section:** `011_role_alignment.sql`, §1 Data mapping (lines 26–40)

- `profiles.role`: `super_admin` → `admin`, `staff_admin` → `admin`, `ceo` → `director`, `staff` unchanged.
- `organisation_members.role`: same mapping applied.
- Both tables covered; no role value left unmapped.

### R-2 — PASS — No accounts deleted; history intact
**File/section:** `011_role_alignment.sql`, §1 Data mapping (lines 26–40)

- Statements are `UPDATE` only. No `DELETE`, `TRUNCATE`, or `DROP` on `profiles` or `organisation_members`.
- Existing accounts and their foreign-key history (e.g. `activity_logs.actor_id`, `automation_config.updated_by`) remain valid because the `id` PK is unchanged.

### R-3 — PASS — Check constraints tightened to three roles
**File/section:** `011_role_alignment.sql`, §2 Tighten check constraints (lines 46–58)

- `profiles.role` → `check (role in ('admin','director','staff'))`.
- `organisation_members.role` → `check (role in ('admin','director','staff'))`.

### R-4 — PASS — All relevant RLS policies rewritten to admin/director
**File/section:** `011_role_alignment.sql`, §3 Rewrite RLS policies (lines 67–450)

- 34 `drop policy if exists` / `create policy` pairs across migrations 001–008.
- Every occurrence of `p.role in ('super_admin','staff_admin')` replaced with `p.role in ('admin','director')`.
- Policies not referencing roles (e.g. owner-based, member-based) left unchanged as intended.

### R-5 — PASS — No hidden super_admin or CEO privileges remain
**File/section:** `011_role_alignment.sql`, §2–3 (lines 46–450)

- Check constraints no longer admit `super_admin`/`staff_admin`/`ceo`.
- No RLS policy references `super_admin`, `staff_admin`, or `ceo` after the migration.
- Frontend (`src/config/brand.ts`, `src/lib/permissions.ts`) already uses `admin`/`director`/`staff`, so the DB and frontend are aligned.

### R-6 — WARNING — Re-runnability / partial-failure state
**File/section:** `011_role_alignment.sql`, whole file

- Data-mapping `UPDATE`s are idempotent (second run matches no rows).
- `drop constraint if exists` / `add constraint` is idempotent.
- `drop policy if exists` / `create policy` is idempotent.
- **Caveat:** if the migration fails partway (e.g. mid-way through §3), some policies would carry the old role literals and others the new ones. Supabase runs each migration file in a single transaction by default, so a failure rolls the whole file back — but this should be confirmed on the target. Recommend running the full file as one transaction and verifying afterwards with a SELECT of `pg_policies`.

### R-7 — REQUIRED FIX — Verify auto-generated constraint names before apply
**File/section:** `011_role_alignment.sql`, §2 (lines 46–58)

- Migration 001 defines the role CHECK constraints inline without explicit names, so PostgreSQL auto-names them `profiles_role_check` and `organisation_members_role_check`.
- The migration `drop constraint if exists profiles_role_check` / `organisation_members_role_check` depends on those exact names.
- **Fix:** Before applying, confirm the actual names:
  ```sql
  SELECT conname FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass AND contype = 'c';
  SELECT conname FROM pg_constraint
  WHERE conrelid = 'public.organisation_members'::regclass AND contype = 'c';
  ```
  If the target DB uses different names, update the `drop constraint if exists` targets accordingly (or add `IF NOT EXISTS` guard logic around `add constraint`).

---

## 2. Automation registry — `supabase/migrations/012_automation_engine.sql`

### A-1 — PASS — Six tables with constraints, indexes, foreign keys
**File/section:** `012_automation_engine.sql`, §1–6 (lines 50–176) and §8 Indexes (lines 197–208)

- `automation_engines`, `automation_jobs`, `automation_executions`, `automation_idempotency`, `automation_recoveries`, `automation_config`.
- All have `uuid` primary keys (`gen_random_uuid()`), `timestamptz` audit columns, and `on delete cascade` foreign keys where appropriate.
- Indexes on status/schedule, idempotency key, job id, org, engine, lease, business operation, and recovery job.

### A-2 — PASS — Job IDs and idempotency keys cannot be duplicated
**File/section:** `012_automation_engine.sql`, §2 Central job registry (lines 76–77) and §4 Idempotency (line 139)

- `automation_jobs.job_id text not null unique`.
- `automation_jobs.idempotency_key text not null unique`.
- `automation_idempotency.idempotency_key text primary key`.
- Both engines share the same `idempotency_key` per business operation, so duplicate registration is rejected at the DB layer regardless of which engine attempts it.

### A-3 — PASS — Execution history preserved
**File/section:** `012_automation_engine.sql`, §3 Execution history (lines 121–132)

- `automation_executions` stores one row per attempt (`job_id`, `engine`, `attempt_number`, `status`, `started_at`, `completed_at`, `result`, `error`).
- Foreign key to `automation_jobs.id` with `on delete cascade`.

### A-4 — PASS — Engine registration does not depend on hardcoded org UUID
**File/section:** `012_automation_engine.sql`, §7 Seed engine rows (lines 183–191)

- Seed uses `select ... from public.organisations where slug = 'iriad'` — lookup by slug, not a hardcoded UUID.
- `on conflict (name) do nothing` makes the seed idempotent on re-apply.
- **Caveat (see A-5):** if no org with slug `iriad` exists, the seed inserts nothing silently.

### A-5 — WARNING — `automation_engines.organisation_id` nullable; seed is silent on missing org
**File/section:** `012_automation_engine.sql`, §1 line 65 and §7 lines 183–191

- `organisation_id` is nullable, permitting platform-level rows. This is intentional for cross-org engine rows, but means org-scoped RLS must handle the null case (it does: `organisation_id is null or ...`).
- The seed `select ... where slug = 'iriad'` returns zero rows if the org doesn't exist, so no engine rows are created with no error. **Verify the IRIAD organisation exists before applying.**

### A-6 — WARNING — Status value `'Timed Out'` contains a space
**File/section:** `012_automation_engine.sql`, §2 line 93

- Valid `text` value, but application code, tests, and queries must match it exactly (including the space). Recommend a code-search for `'Timed Out'` consistency across the native Edge Functions and any frontend status displays.

---

## 3. Atomic job claiming — `supabase/migrations/012_automation_engine.sql`

### C-1 — PASS — `FOR UPDATE SKIP LOCKED` used correctly
**File/section:** `012_automation_engine.sql`, §10 Atomic job claiming (lines 310–317)

- The CTE `locked` selects one due, unlocked job with `for update skip locked limit 1`.
- Concurrent dispatcher instances each claim a different job without blocking or duplicating.

### C-2 — PASS — Only one engine can claim a particular job
**File/section:** `012_automation_engine.sql`, §10 (lines 310–331)

- Single-row lock + `skip locked` guarantees distinct jobs to concurrent claimers.
- The `UPDATE` atomically sets `current_engine = p_engine`, `lease_holder = p_engine`, `status = 'Running'`, and takes a lease.

### C-3 — PASS — Lease and heartbeat supported
**File/section:** `012_automation_engine.sql`, §10 lines 323–324

- `lease_expires_at = now() + make_interval(secs => 600)` → 10-minute lease.
- `heartbeat_at = now()` recorded on claim.
- `automation_jobs.lease_expires_at`, `heartbeat_at` columns exist for renewal/reaper logic.

### C-4 — WARNING — Lease-holder exclusivity for completion is application-layer, not DB-enforced
**File/section:** `012_automation_engine.sql`, §9 RLS (lines 246–253) and §10 (lines 304–332)

- `claim_automation_job()` enforces that only one engine *claims* a job.
- However, `automation_jobs_manage_admin` (`for all`) lets any admin/director update *any* job row — there is no DB trigger or constraint requiring `lease_holder = current_user_engine` before setting `status = 'Completed'`.
- **Implication:** lease-holder exclusivity for completion must be enforced in the Edge Function/application layer (the function should verify `lease_holder` before writing a terminal state). This is a design convention, not a migration defect, but it must be documented and tested.

### C-5 — PASS — Expired leases do not cause automatic double execution
**File/section:** `012_automation_engine.sql`, §10 lines 313–314

- The claim query filters `lease_expires_at is null or lease_expires_at < now()`, so expired leases become claimable again.
- Per the architecture state machine (§4), an expired lease moves the job to `Uncertain` for reconciliation, not straight to re-execution. Duplicate execution is blocked by the shared idempotency key (A-2).

### C-6 — REQUIRED FIX — Add `search_path` hardening to `claim_automation_job()`
**File/section:** `012_automation_engine.sql`, §10 (line 304)

- The function is declared without a `SET search_path` clause, which is a minor search-path-injection hardening gap.
- **Fix:** Add `SET search_path = public, pg_temp` to the function declaration:
  ```sql
  create or replace function public.claim_automation_job(p_engine text)
  returns setof public.automation_jobs
  language plpgsql
  set search_path = public, pg_temp
  as $$ ... $$;
  ```
- Also document that the function is intended for service-role invocation (Edge Functions); direct authenticated-user calls are subject to RLS and have no staff manage policy (see S-5).

---

## 4. Security — both files

### S-1 — PASS — RLS enabled on all six new tables
**File/section:** `012_automation_engine.sql`, §9 (lines 217–222)

- `alter table ... enable row level security` for `automation_engines`, `automation_jobs`, `automation_executions`, `automation_idempotency`, `automation_recoveries`, `automation_config`.

### S-2 — PASS — Manage policies restricted to admin/director
**File/section:** `011_role_alignment.sql` §3 (lines 67–450) and `012_automation_engine.sql` §9 (lines 231–296)

- Every `*_manage_admin` policy uses `p.role in ('admin','director')`.
- No manage policy grants staff write access to automation infrastructure tables.

### S-3 — PASS — Staff cannot manage automation infrastructure
**File/section:** `012_automation_engine.sql`, §9 (lines 225–296)

- Staff has `automation_*_select_own` (org-scoped read) but no `automation_*_manage_admin` write access.
- Staff cannot modify `automation_config`, `automation_engines`, or claim jobs via RLS.

### S-4 — PASS — Select policies are organisation-scoped
**File/section:** `012_automation_engine.sql`, §9 (lines 225–287)

- Rows readable only within the user's own organisation (`organisation_id in (select ... where id = auth.uid())`), except platform-level null-org rows which are readable by admin/director via the manage/select policies.

### S-5 — WARNING — `claim_automation_job()` is `SECURITY INVOKER` (default)
**File/section:** `012_automation_engine.sql`, §10 (line 304)

- No `SECURITY DEFINER` specified, so the function runs with invoker privileges.
- Intended invocation is via Edge Functions using the service-role key (RLS bypassed). Direct calls by ordinary authenticated users would be subject to RLS and would fail (no staff manage policy on `automation_jobs`) — this is protective, but should be documented so operators don't confuse a permissions error with a bug.

### S-6 — REQUIRED FIX — Add `search_path` to function (same as C-6)
**File/section:** `012_automation_engine.sql`, §10 (line 304)

- See REQUIRED FIX C-6: add `set search_path = public, pg_temp`.

### S-7 — PASS — No server-side credentials exposed
**File/section:** `012_automation_engine.sql`, §11 Cron (lines 342–386)

- The `Authorization: Bearer <REPLACE_WITH_SERVICE_ROLE_KEY>` header uses an explicit placeholder, not a real key.
- URLs use `<supabase-project>` placeholder.
- No `VITE_` frontend exposure of service-role or NVIDIA keys.

---

## 5. Scheduling — `supabase/migrations/012_automation_engine.sql`

### SC-1 — PASS — pg_cron / pg_net creation guarded
**File/section:** `012_automation_engine.sql`, §0 Extensions (lines 43–44)

- `create extension if not exists pg_cron;` and `create extension if not exists pg_net;`
- `if not exists` prevents errors if already present.

### SC-2 — PASS — Missing extensions do not cause migration failure
**File/section:** `012_automation_engine.sql`, §11 Cron (lines 342–386)

- All `cron.schedule(...)` calls are wrapped in:
  ```sql
  do $$
  begin
    if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
      ...
    end if;
  end $$;
  ```
- If `pg_cron` is unavailable, the `do` block is a no-op and the rest of the migration still applies. Migration does not fail.

### SC-3 — REQUIRED FIX — Cron guard checks only pg_cron, not pg_net
**File/section:** `012_automation_engine.sql`, §11 lines 344 and 349/359/369/379

- The guard checks `pg_available_extensions` for `pg_cron` only, but the scheduled commands call `net.http_post(...)`, which requires `pg_net`.
- **Risk:** if `pg_cron` is available but `pg_net` is not, cron jobs are created but fail at runtime.
- **Fix:** Extend the guard to require both extensions, or split into per-extension checks:
  ```sql
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
  ```

### SC-4 — REQUIRED FIX — Placeholder URL and service-role key must be replaced before cron fires
**File/section:** `012_automation_engine.sql`, §11 lines 350–351, 360–361, 370–371, 380–381

- `url := 'https://<supabase-project>.functions.supabase.co/...'` and `Authorization: Bearer <REPLACE_WITH_SERVICE_ROLE_KEY>` are placeholders.
- Cron jobs will be created but non-functional until replaced with the real project URL and service-role key.
- **Fix:** Replace placeholders with actual values (supplied via the real `.env`, never committed) before enabling cron, or document this as a mandatory post-apply configuration step. Since this is a review file, marking as REQUIRED FIX to ensure the placeholders are flagged and not accidentally left as-is on production apply.

### SC-5 — PASS — Edge Function invocation uses Authorization Bearer header
**File/section:** `012_automation_engine.sql`, §11 lines 351, 361, 371, 381

- Each `cron.schedule` posts with `jsonb_build_object('Authorization', 'Bearer ...')`.

### SC-6 — PASS — Alternative scheduler covers missed-job recovery when pg_cron unavailable
**File/section:** `012_automation_engine.sql`, §0 comment (lines 38–40); architecture doc §9

- When pg_cron is unavailable, the same Edge Functions can be invoked on a schedule by Vercel Cron or GitHub Actions `schedule` calling the Edge Function URLs with `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.
- This is independent of n8n and requires no browser session, matching the requirement for a fallback not dependent on n8n/browser timers.

---

## 6. Rollback — both files

### RB-1 — PASS — Migration 012 is additive and reversible before go-live
**File/section:** `012_automation_engine.sql` header (lines 17–18)

- `create table if not exists` only; no existing table altered, dropped, or truncated.
- Reversible via `DROP TABLE` / `DROP FUNCTION` on the new objects before production jobs exist.

### RB-2 — WARNING — Migration 011 role data mapping is not directly reversible
**File/section:** `011_role_alignment.sql`, §1 (lines 26–40)

- The `UPDATE` statements overwrite previous role values; the old values (`super_admin`, `staff_admin`, `ceo`) are not recorded anywhere.
- Rollback requires restoring from a `pg_dump` snapshot taken before apply.

### RB-3 — WARNING — Migration 012 becomes irreversible once jobs exist
**File/section:** `012_automation_engine.sql`, whole file

- Once `automation_jobs`/`automation_executions` contain production execution history, `DROP TABLE` would lose that history.
- Rollback is safe only before go-live (no jobs), or via snapshot restore after.

### RB-4 — REQUIRED FIX — Take snapshot + staging test before any production apply
**File/section:** Process requirement (documented in architecture doc §16.4–16.5)

- **Fix (process, not SQL):** Before applying to production, take a `pg_dump` snapshot of `rvjpdfudghwqcxldrkri`, apply both migrations to a staging copy first, run the RLS/permission and failover tests, and only then consider production apply with explicit user authorisation.

---

## 7. n8n preservation

### N-1 — PASS — `n8n/IRIAD_MASTER_WORKFLOW.json` unchanged
**Evidence:** Neither migration file references, reads, writes, or deletes any n8n workflow JSON. The file was not touched during this review.

### N-2 — PASS — `n8n/IRIAD_ERROR_HANDLER.json` unchanged
**Evidence:** Same as N-1. Not referenced or modified by either migration.

### N-3 — PASS — No existing n8n business workflow deleted, replaced, or restructured
**File/section:** `012_automation_engine.sql` header (lines 18–20)

- Explicitly states: "Existing n8n Master Workflow is the permanent primary automation workflow. The native IRIAD engine is an independent secondary failover engine. This is a hybrid architecture, not an n8n replacement."
- Migration 012 is additive only (new tables, new function, new indexes, new RLS). No existing table or column is altered.
- n8n continues to execute existing business workflows unchanged; the native engine only runs when n8n is unhealthy or a workflow fails.

---

## Required fixes summary (must be addressed before staging)

| ID | File | Section | Required fix |
|----|------|---------|--------------|
| R-7 | `011_role_alignment.sql` | §2 (lines 46–58) | Verify auto-generated CHECK constraint names (`profiles_role_check`, `organisation_members_role_check`) match the target DB; update `drop constraint if exists` targets if different. |
| C-6 / S-6 | `012_automation_engine.sql` | §10 (line 304) | Add `set search_path = public, pg_temp` to `claim_automation_job()`; document service-role-only invocation. |
| SC-3 | `012_automation_engine.sql` | §11 (line 344) | Extend cron guard to require both `pg_cron` and `pg_net` (needed for `net.http_post`). |
| SC-4 | `012_automation_engine.sql` | §11 (lines 350–381) | Replace `<supabase-project>` and `<REPLACE_WITH_SERVICE_ROLE_KEY>` placeholders before cron is enabled; treat as mandatory post-apply configuration. |
| RB-4 | Process | — | Take `pg_dump` snapshot; test both migrations on staging first; apply to production only with explicit user authorisation. |

## Warnings to acknowledge (do not block, but document)

- **R-6:** Partial-failure could leave mixed policy state; run as one transaction and verify `pg_policies` afterwards.
- **A-5:** `organisation_id` nullable; seed is silent if no org with slug `iriad` exists — verify org exists before applying.
- **A-6:** Status `'Timed Out'` contains a space — keep application code/tests consistent.
- **C-4:** Lease-holder exclusivity for job *completion* is enforced in the Edge Function/application layer, not by a DB trigger or constraint.
- **S-5:** `claim_automation_job()` is `SECURITY INVOKER`; intended for service-role invocation only.
- **RB-2 / RB-3:** Migration 011 data mapping and migration 012 (post-jobs) are not directly reversible; snapshot restore required.

## Conclusion

Both migrations pass the safety review with **no FAIL findings**. The six REQUIRED FIX items are largely straightforward (constraint-name verification, `search_path`, pg_net guard, placeholder replacement, snapshot/staging process). The ten WARNING items are operational caveats to document and test during staging.

**Next step:** Awaiting your approval. On approval, I will apply the REQUIRED FIX items to the SQL files (without applying to production), then proceed to staging tests only.

---
**n8n preservation confirmed:** `n8n/IRIAD_MASTER_WORKFLOW.json` and `n8n/IRIAD_ERROR_HANDLER.json` are untouched; no existing n8n business workflow has been deleted, replaced, or restructured.
