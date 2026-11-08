import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Return the current moment expressed in Africa/Lagos wall-clock time. */
function nowLagos(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }))
}

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
    const now = nowLagos();
    const nowISO = now.toISOString();
    // Use the job's scheduled_at (Lagos) to derive the work date in Lagos time
    const workDate = new Date(new Date(job.scheduled_at).toLocaleString('en-US', { timeZone: 'Africa/Lagos' })).toISOString().slice(0, 10);

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
        morning_closed_at: nowISO,
        updated_at: nowISO,
      }, { onConflict: "organisation_id,work_date" })
      .select()
      .single();

    if (error) throw error;

    // Mark late check-ins (checked in after morning close time)
    const closeTime = nowISO.slice(11, 16);
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
      created_at: nowISO,
    });

    // Mark idempotency completed
    await supabase.from("automation_idempotency").upsert({
      idempotency_key: job.idempotency_key,
      business_operation: job.business_operation,
      organisation_id: job.organisation_id,
      status: "completed",
      result: { session_id: session.id, work_date: workDate },
      completed_at: nowISO,
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
