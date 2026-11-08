import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * automation-attendance-close
 *
 * Phase 3 native backup engine — business operation #2.
 *
 * Closes the attendance session for the work date. Upserts attendance_sessions
 * with morning_closed_at, records late check-ins, and creates a daily snapshot
 * notification (attendance_closed).
 *
 * Idempotent: same idempotency_key won't re-close an already-closed session.
 *
 * Expects POST body: { job: { ... } }
 */
serve(async (req) => {
  try {
    const { job } = await req.json();
    const now = new Date().toISOString();
    const workDate = new Date(job.scheduled_at).toISOString().slice(0, 10);

    // Idempotency guard
    const { data: idem } = await supabase
      .from("automation_idempotency")
      .select("status")
      .eq("idempotency_key", job.idempotency_key)
      .single();
    if (idem?.status === "completed") {
      return json({ ok: true, skipped: true, reason: "idempotency_completed" });
    }

    // Upsert attendance session close (org + work_date unique)
    const { data: session, error } = await supabase
      .from("attendance_sessions")
      .upsert({
        organisation_id: job.organisation_id,
        work_date: workDate,
        morning_closed_at: now,
        updated_at: now,
      }, { onConflict: "organisation_id,work_date" })
      .select()
      .single();

    if (error) throw error;

    // Mark late check-ins (checked in after morning close time)
    const closeTime = now.slice(11, 16);
    await supabase
      .from("attendance")
      .update({ is_late: true, status: "late" })
      .eq("organisation_id", job.organisation_id)
      .eq("attendance_date", workDate)
      .not("check_in_at", "is", null)
      .filter("check_in_at", "gt", `${workDate}T${closeTime}:00+00:00`);

    // Create closing notification
    await supabase.from("notifications").insert({
      organisation_id: job.organisation_id,
      type: "attendance_closed",
      title: "Attendance closed",
      body: `Check-in window closed for ${workDate}`,
      created_at: now,
    });

    // Mark idempotency completed
    await supabase.from("automation_idempotency").upsert({
      idempotency_key: job.idempotency_key,
      business_operation: job.business_operation,
      organisation_id: job.organisation_id,
      status: "completed",
      result: { session_id: session.id, work_date: workDate },
      completed_at: now,
    }, { onConflict: "idempotency_key" });

    return json({ ok: true, sessionId: session.id, workDate });
  } catch (err) {
    console.error("attendance-close error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
