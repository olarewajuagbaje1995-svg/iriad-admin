import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const N8N_WEBHOOK_SECRET = Deno.env.get("N8N_WEBHOOK_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * automation-n8n-acknowledge
 *
 * Phase 4 n8n integration — acknowledgement endpoint.
 *
 * The n8n Master Workflow POSTs here when it has received and accepted a job.
 * Marks the automation_job as Acknowledged and records the n8n execution_id.
 *
 * Idempotent: re-acknowledging the same job/execution is a no-op.
 *
 * Expects POST body: { job_id, execution_id, status: "acknowledged" }
 * Auth: Bearer SUPABASE_SERVICE_ROLE_KEY (or N8N_WEBHOOK_SECRET header)
 */
serve(async (req) => {
  try {
    // Verify n8n webhook secret if configured
    if (N8N_WEBHOOK_SECRET) {
      const secret = req.headers.get("x-webhook-secret");
      if (secret !== N8N_WEBHOOK_SECRET) {
        return json({ ok: false, error: "Unauthorized" }, 401);
      }
    }

    const { job_id, execution_id, status } = await req.json();
    if (!job_id) {
      return json({ ok: false, error: "job_id required" }, 400);
    }

    const now = new Date().toISOString();

    // Fetch the job first (for org scoping + idempotency)
    const { data: job, error: jobError } = await supabase
      .from("automation_jobs")
      .select("id, status, execution_id, acknowledged_at, organisation_id")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      return json({ ok: false, error: "Job not found" }, 404);
    }

    // Idempotency: already acknowledged with same execution_id
    if (job.acknowledged_at && job.execution_id === execution_id) {
      return json({ ok: true, skipped: true, reason: "already_acknowledged" });
    }

    // Update job: acknowledged, record execution_id
    const { error: updateError } = await supabase
      .from("automation_jobs")
      .update({
        status: status || "Acknowledged",
        execution_id: execution_id || null,
        acknowledged_at: now,
        updated_at: now,
      })
      .eq("id", job_id);

    if (updateError) throw updateError;

    // Record execution attempt for the acknowledgement
    await supabase.from("automation_executions").insert({
      job_id,
      engine: "n8n",
      attempt_number: 1,
      status: "completed",
      started_at: now,
      completed_at: now,
      result: { acknowledged: true, execution_id },
    });

    return json({ ok: true, jobId: job_id, acknowledged: true, execution_id });
  } catch (err) {
    console.error("n8n-acknowledge error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
