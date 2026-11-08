import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const N8N_WEBHOOK_SECRET = Deno.env.get("N8N_WEBHOOK_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Return the current moment expressed in Africa/Lagos wall-clock time. */
function nowLagos(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }))
}

/**
 * automation-n8n-callback
 *
 * Phase 4 n8n integration — job completion callback endpoint.
 *
 * The n8n Master Workflow POSTs here when a job reaches a terminal state
 * (Completed or Failed). Marks the automation_job accordingly and records
 * the result/output.
 *
 * Idempotent: re-calling with the same job_id/execution_id is a no-op.
 *
 * Expects POST body: { job_id, execution_id, status: "completed"|"failed",
 *   result?, error?, output? }
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

    const { job_id, execution_id, status, result, error, output } = await req.json();
    if (!job_id) {
      return json({ ok: false, error: "job_id required" }, 400);
    }

    const now = nowLagos().toISOString();

    // Fetch the job first
    const { data: job, error: jobError } = await supabase
      .from("automation_jobs")
      .select("id, status, execution_id, completed_at, organisation_id")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      return json({ ok: false, error: "Job not found" }, 404);
    }

    // Idempotency: already in terminal state for this execution
    if (
      (job.status === "Completed" || job.status === "Failed") &&
      job.execution_id === execution_id
    ) {
      return json({ ok: true, skipped: true, reason: "already_terminal" });
    }

    const terminalStatus = status === "failed" ? "Failed" : "Completed";

    // Update job to terminal state
    const { error: updateError } = await supabase
      .from("automation_jobs")
      .update({
        status: terminalStatus,
        execution_id: execution_id || null,
        completed_at: now,
        execution_result: result || output || {},
        error_details: error ? { message: error, failed_at: now } : {},
        updated_at: now,
      })
      .eq("id", job_id);

    if (updateError) throw updateError;

    // Record execution history
    await supabase.from("automation_executions").insert({
      job_id,
      engine: "n8n",
      attempt_number: 1,
      status: terminalStatus === "Failed" ? "failed" : "completed",
      started_at: now,
      completed_at: now,
      result: result || output || {},
      error: error ? { message: error } : {},
    });

    // Mark idempotency completed for the job's business operation
    const { data: idem } = await supabase
      .from("automation_idempotency")
      .select("status")
      .eq("idempotency_key", (job as any).idempotency_key)
      .single();

    if (!idem || idem.status !== "completed") {
      await supabase.from("automation_idempotency").upsert({
        idempotency_key: (job as any).idempotency_key,
        business_operation: (job as any).business_operation,
        organisation_id: job.organisation_id,
        status: terminalStatus === "Failed" ? "failed" : "completed",
        result: result || output || {},
        completed_at: now,
      }, { onConflict: "idempotency_key" });
    }

    return json({ ok: true, jobId: job_id, status: terminalStatus });
  } catch (err) {
    console.error("n8n-callback error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
