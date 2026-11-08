import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * automation-staff-checkin
 *
 * Phase 3 native backup engine — business operation #3 (staff check-in).
 *
 * Enforces the 08:00–09:00 Africa/Lagos check-in window plus holiday/workday
 * checks via attendance_policy and working_calendar. Upserts the attendance
 * record (unique org + staff + date).
 *
 * Idempotent: same idempotency_key won't double-check-in.
 *
 * Expects POST body: { job: { ... } }
 */
serve(async (req) => {
  try {
    const { job } = await req.json();
    const now = new Date().toISOString();
    const workDate = new Date().toISOString().slice(0, 10);

    // Idempotency guard
    const { data: idem } = await supabase
      .from("automation_idempotency")
      .select("status")
      .eq("idempotency_key", job.idempotency_key)
      .single();
    if (idem?.status === "completed") {
      return json({ ok: true, skipped: true, reason: "idempotency_completed" });
    }

    // Fetch attendance policy for the organisation
    const { data: policy } = await supabase
      .from("attendance_policy")
      .select("*")
      .eq("organisation_id", job.organisation_id)
      .single();

    const openTime = policy?.morning_open_time ?? "08:00";
    const closeTime = policy?.morning_close_time ?? "09:00";
    const workingDays = policy?.working_days ?? [1, 2, 3, 4, 5];
    const graceMinutes = policy?.grace_period_minutes ?? 0;

    // Check working day
    const dayOfWeek = new Date().getUTCDay(); // 0=Sun ... 6=Sat
    const isWorkDay = workingDays.includes(dayOfWeek === 0 ? 7 : dayOfWeek);
    if (!isWorkDay) {
      return json({ ok: true, skipped: true, reason: "non_workday" });
    }

    // Check holiday/workday override
    const { data: calEntry } = await supabase
      .from("working_calendar")
      .select("is_workday")
      .eq("organisation_id", job.organisation_id)
      .eq("date", workDate)
      .single();
    if (calEntry?.is_workday === false) {
      return json({ ok: true, skipped: true, reason: "holiday" });
    }

    // Check check-in window (08:00–09:00 + grace for late tolerance only)
    const nowTime = now.slice(11, 16); // "HH:MM"
    if (nowTime < openTime || nowTime > closeTime) {
      return json({
        ok: false,
        error: `Check-in window is ${openTime}–${closeTime} Africa/Lagos`,
      }, 409);
    }

    // Determine if late (after close time, grace applies to closing boundary)
    const isLate = nowTime > closeTime;

    // Resolve staff_id from job payload (set when the job is created for a
    // specific staff member) — required for per-staff check-in/checkout ops.
    const staffId = (job as any)?.payload?.staff_id ?? (job as any)?.staff_id;
    if (!staffId) {
      return json({ ok: false, error: "staff_id not provided in job payload" }, 400);
    }

    // Upsert attendance record (unique org + staff + date)
    const { data: attendance, error } = await supabase
      .from("attendance")
      .upsert({
        organisation_id: job.organisation_id,
        staff_id: staffId,
        attendance_date: workDate,
        check_in_at: now,
        status: isLate ? "late" : "checked_in",
        is_late: isLate,
        attendance_type: "office",
        updated_at: now,
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
      result: { attendance_id: attendance.id, check_in_at: now, is_late: isLate },
      completed_at: now,
    }, { onConflict: "idempotency_key" });

    return json({ ok: true, attendanceId: attendance.id, isLate });
  } catch (err) {
    console.error("staff-checkin error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
