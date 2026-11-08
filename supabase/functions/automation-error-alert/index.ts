import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Return the current moment expressed in Africa/Lagos wall-clock time. */
function nowLagos(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }))
}

/**
 * automation-error-alert
 *
 * Phase 3 native backup engine — error alerting.
 *
 * Alerts organisation admins/directors about recorded automation errors and
 * failed jobs. Creates notifications and logs an automation_runs entry.
 *
 * Idempotent: same idempotency_key won't re-alert for the same error batch.
 *
 * Expects POST body: { job: { job_id, idempotency_key, business_operation,
 *   organisation_id, scheduled_at, payload?: { error_source, error_message } } }
 */
serve(async (req) => {
  try {
    const { job } = await req.json();
    const now = nowLagos().toISOString();

    // Idempotency guard
    const { data: idem } = await supabase
      .from("automation_idempotency")
      .select("status")
      .eq("idempotency_key", job.idempotency_key)
      .single();
    if (idem?.status === "completed") {
      return json({ ok: true, skipped: true, reason: "idempotency_completed" });
    }

    const orgId = job.organisation_id;
    const payload = (job as any).payload || {};
    const errorSource = payload.error_source || "automation";
    const errorMessage = payload.error_message || "Unknown automation error";

    // Find admins/directors to alert
    const { data: admins } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("organisation_id", orgId)
      .in("role", ["admin", "director"]);

    let notified = 0;

    if (admins && admins.length > 0) {
      await supabase.from("notifications").insert(
        admins.map((admin: any) => ({
          organisation_id: orgId,
          recipient_id: admin.id,
          type: "knowledge_processing_failure", // closest existing type for system alerts
          title: "Automation error alert",
          body: `Error in ${errorSource}: ${errorMessage}`,
          link: `/automation/errors`,
          created_at: now,
        }))
      );
      notified = admins.length;
    }

    // Log the error alert run
    await supabase.from("automation_runs").insert({
      organisation_id: orgId,
      workflow_name: "automation-error-alert",
      trigger: "event",
      status: "completed",
      completed_at: now,
      input: { error_source: errorSource, error_message: errorMessage },
      output: { notified },
    });

    // Mark idempotency completed
    await supabase.from("automation_idempotency").upsert({
      idempotency_key: job.idempotency_key,
      business_operation: job.business_operation,
      organisation_id: orgId,
      status: "completed",
      result: { error_source: errorSource, notified },
      completed_at: now,
    }, { onConflict: "idempotency_key" });

    return json({ ok: true, notified });
  } catch (err) {
    console.error("error-alert error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
