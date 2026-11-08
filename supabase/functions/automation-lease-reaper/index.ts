import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * automation-lease-reaper
 *
 * Phase 3 native backup engine — infrastructure.
 *
 * Finds Running jobs whose execution lease has expired and marks them as
 * Uncertain for reconciliation. Expired leases do NOT cause automatic
 * re-execution — they go through the Uncertain reconciliation path where
 * idempotency and business side-effects are checked before any backup
 * execution occurs.
 *
 * Intended to be invoked on a schedule (e.g. every 15 minutes).
 */
serve(async (req) => {
  try {
    const now = new Date().toISOString();

    // Find Running jobs with expired leases
    const { data: expiredJobs, error } = await supabase
      .from("automation_jobs")
      .select("id, job_id, business_operation, idempotency_key, current_engine, organisation_id")
      .eq("status", "Running")
      .lt("lease_expires_at", now);

    if (error) throw error;

    let reaped = 0;
    for (const job of expiredJobs ?? []) {
      await supabase.from("automation_jobs").update({
        status: "Uncertain",
        updated_at: now,
      }).eq("id", job.id);

      await supabase.from("automation_executions").insert({
        job_id: job.id,
        engine: job.current_engine ?? "iriad-native",
        attempt_number: 0,
        status: "timed_out",
        started_at: now,
        error: { reason: "lease_expired", lease_expires_at: job.lease_expires_at },
      });

      await supabase.from("automation_recoveries").insert({
        job_id: job.id,
        reason: "lease_expired",
        recovered_by_engine: "iriad-native",
        notes: "Lease expired — job marked Uncertain for reconciliation",
      });

      reaped++;
    }

    return new Response(
      JSON.stringify({ ok: true, reaped, now }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("lease-reaper error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
