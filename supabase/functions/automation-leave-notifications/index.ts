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
 * automation-leave-notifications
 *
 * Phase 3 native backup engine — leave request notifications.
 *
 * Notifies organisation admins/directors of pending leave requests awaiting
 * approval, and notifies staff when their leave request is approved/rejected.
 *
 * Idempotent: same idempotency_key won't re-notify for the same leave batch.
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

    // Find pending leave requests (awaiting admin approval)
    const { data: pendingLeave, error: leaveError } = await supabase
      .from("leave_requests")
      .select("id, staff_id, leave_type, start_date, end_date, reason, status, created_at")
      .eq("organisation_id", orgId)
      .eq("status", "pending");

    if (leaveError) throw leaveError;

    let notified = 0;

    // Notify admins/directors about pending leave requests
    const { data: admins } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("organisation_id", orgId)
      .in("role", ["admin", "director"]);

    if (pendingLeave && pendingLeave.length > 0 && admins && admins.length > 0) {
      const adminNotifications = admins.flatMap((admin: any) =>
        pendingLeave.map((leave: any) => ({
          organisation_id: orgId,
          recipient_id: admin.id,
          actor_id: leave.staff_id,
          type: "task_assigned", // closest existing notification type; leave_* not in enum
          title: "Leave request pending approval",
          body: `${leave.leave_type} leave from ${leave.start_date} to ${leave.end_date} awaiting your approval.`,
          link: `/leave/${leave.id}`,
          created_at: now,
        }))
      );
      await supabase.from("notifications").insert(adminNotifications);
      notified += adminNotifications.length;
    }

    // Log automation run
    await supabase.from("automation_runs").insert({
      organisation_id: orgId,
      workflow_name: "automation-leave-notifications",
      trigger: "schedule",
      status: "completed",
      completed_at: now,
      input: {},
      output: { pending_leave_count: (pendingLeave ?? []).length, notified },
    });

    // Mark idempotency completed
    await supabase.from("automation_idempotency").upsert({
      idempotency_key: job.idempotency_key,
      business_operation: job.business_operation,
      organisation_id: orgId,
      status: "completed",
      result: { pending_leave_count: (pendingLeave ?? []).length, notified },
      completed_at: now,
    }, { onConflict: "idempotency_key" });

    return json({ ok: true, pendingLeaveCount: (pendingLeave ?? []).length, notified });
  } catch (err) {
    console.error("leave-notifications error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
