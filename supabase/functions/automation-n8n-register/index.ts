import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * automation-n8n-register
 *
 * Phase 4 n8n integration — job registration endpoint.
 *
 * Registers n8n Master Workflow job mappings in the central automation_jobs
 * registry. Called during n8n setup/deployment to pre-register the scheduled
 * jobs that the n8n Master Workflow will handle. The native dispatcher can
 * then claim and route these jobs (to n8n when healthy, to native backup
 * when n8n is down).
 *
 * Idempotent: same job_id won't create a duplicate job.
 *
 * Expects POST body (single job or array):
 *   { job_id, business_operation, trigger_type, scheduled_at,
 *     organisation_id, primary_engine?, backup_engine?, max_retries?,
 *     payload? }
 * Auth: Bearer SUPABASE_SERVICE_ROLE_KEY (service role only — admin setup)
 */
serve(async (req) => {
  try {
    const body = await req.json();
    const jobs = Array.isArray(body) ? body : [body];
    const now = new Date().toISOString();

    const results = [];

    for (const spec of jobs) {
      const {
        job_id,
        business_operation,
        trigger_type = "schedule",
        scheduled_at,
        organisation_id,
        primary_engine = "n8n",
        backup_engine = "iriad-native",
        max_retries = 3,
      } = spec;

      if (!job_id || !business_operation || !scheduled_at || !organisation_id) {
        results.push({ job_id, ok: false, error: "missing required fields" });
        continue;
      }

      // Idempotent insert: same job_id won't duplicate
      const { data: inserted, error } = await supabase
        .from("automation_jobs")
        .insert({
          job_id,
          business_operation,
          trigger_type,
          scheduled_at,
          primary_engine,
          backup_engine,
          status: "Pending",
          max_retries,
          retry_count: 0,
          attempt_number: 0,
          organisation_id,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        // Could be unique violation (job_id already exists) — treat as idempotent skip
        results.push({ job_id, ok: false, error: error.message, skipped: true });
        continue;
      }

      results.push({ job_id, ok: true, status: "Pending", id: inserted.id });
    }

    return json({ ok: true, registered: results.length, results });
  } catch (err) {
    console.error("n8n-register error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
