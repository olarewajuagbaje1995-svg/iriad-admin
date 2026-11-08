import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * automation-correction-notifications
 *
 * Phase 3 native backup engine — attendance correction notifications.
 *
 * Notifies organisation admins/directors of pending attendance corrections
 * awaiting review, and notifies staff when their correction is approved/rejected.
 *
 * Idempotent: same idempotency_key won't re-notify for the same correction batch.
 *
 * Expects POST body: { job: { ... } }
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

    // Find pending attendance corrections (awaiting admin review)
    const { data: pendingCorrections, error: corrError } = await supabase
      .from("attendance_corrections")
      .select("id, staff_id, correction_type, old_value, new_value, reason, status, created_at")
      .eq("organisation_id", orgId)
      .eq("status", "pending");

    if (corrError) throw corrError;

    let notified = 0;

    // Notify admins/directors about pending corrections
    const { data: admins } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("organisation_id", orgId)
      .in("role", ["admin", "director"]);

    if (pendingCorrections && pendingCorrections.length > 0 && admins && admins.length > 0) {
      const adminNotifications = admins.flatMap((admin: any) =>
        pendingCorrections.map((corr: any) => ({
          organisation_id: orgId,
          recipient_id: admin.id,
          actor_id: corr.requested_by,
          type: "task_assigned",
          title: "Attendance correction pending review",
          body: `${corr.correction_type} correction for staff ${corr.staff_id}: ${corr.reason}.`,
          link: `/attendance/corrections/${corr.id}`,
          created_at: now,
        }))
      );
      await supabase.from("notifications").insert(adminNotifications);
      notified += adminNotifications.length;
    }

    // Log automation run
    await supabase.from("automation_runs").insert({
      organisation_id: orgId,
      workflow_name: "automation-correction-notifications",
      trigger: "schedule",
      status: "completed",
      completed_at: now,
      input: {},
      output: { pending_correction_count: (pendingCorrections ?? []).length, notified },
    });

    // Mark idempotency completed
    await supabase.from("automation_idempotency").upsert({
      idempotency_key: job.idempotency_key,
      business_operation: job.business_operation,
      organisation_id: orgId,
      status: "completed",
      result: { pending_correction_count: (pendingCorrections ?? []).length, notified },
      completed_at: now,
    }, { onConflict: "idempotency_key" });

    return json({ ok: true, pendingCorrectionCount: (pendingCorrections ?? []).length, notified });
  } catch (err) {
    console.error("correction-notifications error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
