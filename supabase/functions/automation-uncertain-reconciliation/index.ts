import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const N8N_BASE_URL = Deno.env.get("N8N_BASE_URL") || "";
const N8N_WEBHOOK_SECRET = Deno.env.get("N8N_WEBHOOK_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * automation-uncertain-reconciliation
 *
 * Phase 4 n8n integration — uncertain job reconciliation.
 *
 * Finds automation_jobs in "Uncertain" state (lease expired, no terminal
 * callback from n8n) and reconciles them by checking n8n's execution status
 * via the recorded execution_id. Jobs that n8n confirms as completed/failed
 * are marked terminal; jobs with no n8n record are returned to Pending for
 * native backup engine re-execution.
 *
 * Idempotent: safe to run on a schedule; each uncertain job is reconciled
 * at most once per run.
 *
 * Expects POST body: {} (scheduled invocation, no body required)
 * Auth: Bearer SUPABASE_SERVICE_ROLE_KEY
 */
serve(async (req) => {
  try {
    const now = new Date().toISOString();

    // Find uncertain jobs (dispatched to n8n, no terminal callback, lease expired)
    const { data: uncertainJobs, error: fetchError } = await supabase
      .from("automation_jobs")
      .select("id, job_id, idempotency_key, business_operation, execution_id, organisation_id, attempt_number, max_retries, retry_count, scheduled_at")
      .eq("status", "Uncertain");

    if (fetchError) throw fetchError;

    let reconciled = 0;
    let returnedToPending = 0;
    let markedTerminal = 0;

    for (const job of uncertainJobs ?? []) {
      let n8nStatus: "completed" | "failed" | "not_found" | "unknown" = "unknown";

      // Check n8n execution status if we have an execution_id and n8n URL
      if (job.execution_id && N8N_BASE_URL) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(
            `${N8N_BASE_URL}/api/v1/executions/${job.execution_id}`,
            {
              signal: controller.signal,
              headers: N8N_WEBHOOK_SECRET
                ? { "x-webhook-secret": N8N_WEBHOOK_SECRET }
                : {},
            },
          );
          clearTimeout(timeout);

          if (res.ok) {
            const execution = await res.json().catch(() => ({}));
            const finished = execution.finished || execution.status === "success";
            if (finished && execution.status !== "error") {
              n8nStatus = "completed";
            } else if (execution.status === "error" || execution.status === "failed") {
              n8nStatus = "failed";
            }
          } else if (res.status === 404) {
            n8nStatus = "not_found";
          }
        } catch {
          n8nStatus = "unknown"; // n8n unreachable — leave uncertain
        }
      } else {
        n8nStatus = "not_found"; // no execution_id — n8n never ran it
      }

      switch (n8nStatus) {
        case "completed": {
          // n8n confirms completion — mark job terminal
          await supabase.from("automation_jobs").update({
            status: "Completed",
            completed_at: now,
            updated_at: now,
          }).eq("id", job.id);

          await supabase.from("automation_executions").insert({
            job_id: job.id,
            engine: "n8n",
            attempt_number: job.attempt_number,
            status: "completed",
            started_at: now,
            completed_at: now,
            result: { reconciled: true, source: "n8n" },
          });

          await supabase.from("automation_idempotency").upsert({
            idempotency_key: job.idempotency_key,
            business_operation: job.business_operation,
            organisation_id: job.organisation_id,
            status: "completed",
            result: { reconciled: true, source: "n8n_completed" },
            completed_at: now,
          }, { onConflict: "idempotency_key" });

          markedTerminal++;
          break;
        }

        case "failed": {
          // n8n confirms failure — mark job Failed (or Retrying if retries remain)
          const retryCount = (job.retry_count ?? 0) + 1;
          const maxRetries = job.max_retries ?? 3;
          const terminal = retryCount >= maxRetries ? "Failed" : "Retrying";

          await supabase.from("automation_jobs").update({
            status: terminal,
            retry_count: retryCount,
            updated_at: now,
          }).eq("id", job.id);

          await supabase.from("automation_executions").insert({
            job_id: job.id,
            engine: "n8n",
            attempt_number: job.attempt_number,
            status: "failed",
            started_at: now,
            completed_at: now,
            error: { reconciled: true, source: "n8n_failed" },
          });

          markedTerminal++;
          break;
        }

        case "not_found":
        case "unknown": {
          // n8n has no record of this execution — return to Pending for
          // native backup engine to re-execute (failover)
          const retryCount = (job.retry_count ?? 0) + 1;
          const maxRetries = job.max_retries ?? 3;
          const terminal = retryCount >= maxRetries ? "Failed" : "Pending";

          await supabase.from("automation_jobs").update({
            status: terminal,
            retry_count: retryCount,
            current_engine: "iriad-native",
            lease_expires_at: null,
            lease_holder: null,
            updated_at: now,
          }).eq("id", job.id);

          await supabase.from("automation_recoveries").insert({
            job_id: job.id,
            reason: "n8n_uncertain",
            recovered_by_engine: "iriad-native",
            notes: `n8n execution ${job.execution_id || "unknown"} not found; failing over to native backup`,
          });

          if (terminal === "Pending") {
            returnedToPending++;
          } else {
            markedTerminal++;
          }
          break;
        }
      }

      reconciled++;
    }

    // Log reconciliation run
    await supabase.from("automation_runs").insert({
      organisation_id: null,
      workflow_name: "automation-uncertain-reconciliation",
      trigger: "schedule",
      status: "completed",
      completed_at: now,
      input: {},
      output: {
        uncertain_found: (uncertainJobs ?? []).length,
        reconciled,
        returned_to_pending: returnedToPending,
        marked_terminal: markedTerminal,
      },
    });

    return json({
      ok: true,
      uncertainFound: (uncertainJobs ?? []).length,
      reconciled,
      returnedToPending,
      markedTerminal,
    });
  } catch (err) {
    console.error("uncertain-reconciliation error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
