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
 * automation-attendance-open
 *
 * Phase 3 native backup engine — business operation #1.
 *
 * Opens the attendance session for the work date. Upserts attendance_sessions
 * with morning_opened_at and creates an attendance_opening notification.
 *
 * Idempotent: same idempotency_key won't re-open an already-opened session.
 *
 * Expects POST body: { job: { job_id, idempotency_key, business_operation,
 *   organisation_id, scheduled_at } }
 */
serve(async (req) => {
  try {
    const { job } = await req.json();
    const now = nowLagos();
    const nowISO = now.toISOString();
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

    // Upsert attendance session (org + work_date unique)
    const { data: session, error } = await supabase
      .from("attendance_sessions")
      .upsert({
        organisation_id: job.organisation_id,
        work_date: workDate,
        morning_opened_at: nowISO,
        updated_at: nowISO,
      }, { onConflict: "organisation_id,work_date" })
      .select()
      .single();

    if (error) throw error;

    // Create opening notification
    await supabase.from("notifications").insert({
      organisation_id: job.organisation_id,
      type: "attendance_opening",
      title: "Attendance opened",
      body: `Check-in window opened for ${workDate}`,
      created_at: nowISO,
    });

    // Mark idempotency completed (same transaction conceptually; here sequential)
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
    console.error("attendance-open error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
