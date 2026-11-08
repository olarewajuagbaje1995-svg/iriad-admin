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
 * automation-staff-checkout
 *
 * Phase 3 native backup engine — business operation #3 (staff check-out).
 *
 * Enforces the 17:00–18:05 sign-out window. Inserts the attendance record
 * with check_out_at (unique org + staff + date) without overwriting an
 * existing check-out.
 *
 * Idempotent: same idempotency_key won't double-check-out.
 *
 * Expects POST body: { job: { ... } }
 */
serve(async (req) => {
  try {
    const { job } = await req.json();
    const now = nowLagos();
    const workDate = now.toISOString().slice(0, 10);

    // Idempotency guard
    const { data: idem } = await supabase
      .from("automation_idempotency")
      .select("status")
      .eq("idempotency_key", job.idempotency_key)
      .single();
    if (idem?.status === "completed") {
      return json({ ok: true, skipped: true, reason: "idempotency_completed" });
    }

    // Check sign-out window (17:00–18:05 Africa/Lagos)
    const openTime = "17:00";
    const closeTime = "18:05";
    const nowTime = now.toISOString().slice(11, 16);
    if (nowTime < openTime || nowTime > closeTime) {
      return json({
        ok: false,
        error: `Sign-out window is ${openTime}–${closeTime} Africa/Lagos`,
      }, 409);
    }

    // Resolve staff_id from job payload (set when the job is created for a
    // specific staff member) — required for per-staff check-in/checkout ops.
    const staffId = (job as any)?.payload?.staff_id ?? (job as any)?.staff_id;
    if (!staffId) {
      return json({ ok: false, error: "staff_id not provided in job payload" }, 400);
    }

    // Check for existing check-out record (prevent duplicate check-out overwrite)
    const { data: existing } = await supabase
      .from("attendance")
      .select("id, check_out_at, status")
      .eq("organisation_id", job.organisation_id)
      .eq("staff_id", staffId)
      .eq("attendance_date", workDate)
      .maybeSingle();

    if (existing && existing.check_out_at) {
      return json({
        ok: false,
        error: "Already checked out today",
        attendance_id: existing.id,
        check_out_at: existing.check_out_at,
        status: existing.status,
      }, 409);
    }

    // Upsert attendance record check-out (unique org + staff + date).
    // If a check-in exists without check-out, this fills in check_out_at.
    // Duplicate check-outs are prevented by the check above + DB unique constraint.
    const { data: attendance, error } = await supabase
      .from("attendance")
      .upsert({
        organisation_id: job.organisation_id,
        staff_id: staffId,
        attendance_date: workDate,
        check_out_at: now.toISOString(),
        status: "checked_out",
        updated_at: now.toISOString(),
      }, { onConflict: "organisation_id,staff_id,attendance_date" })
      .select()
      .single();

    if (error) throw error;

    // Mark idempotency completed
    await supabase.from("automation_idempotency").upsert({
      idempotency_key: job.idempotency_key,
      business_operation: job.business_operation,
      organisation_id: job.organisation_id,
      status: "completed",
      result: { attendance_id: attendance.id, check_out_at: now.toISOString() },
      completed_at: now.toISOString(),
    }, { onConflict: "idempotency_key" });

    return json({ ok: true, attendanceId: attendance.id });
  } catch (err) {
    console.error("staff-checkout error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
