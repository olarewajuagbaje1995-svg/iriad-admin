import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * automation-monthly-report
 *
 * Phase 3 native backup engine — monthly report reminder.
 *
 * Finds active monthly reporting periods that are due and notifies staff who
 * have not yet submitted their monthly report for the current month.
 *
 * Idempotent: same idempotency_key won't re-notify for the same period.
 *
 * Expects POST body: { job: { ... } }
 */
serve(async (req) => {
  try {
    const { job } = await req.json();
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    // Idempotency guard
    const { data: idem } = await supabase
      .from("automation_idempotency")
      .select("status")
      .eq("idempotency_key", job.idempotency_key)
      .single();
    if (idem?.status === "completed") {
      return json({ ok: true, skipped: true, reason: "idempotency_completed" });
    }

    // Find active monthly reporting periods due on or before today
    const { data: periods, error: periodError } = await supabase
      .from("reporting_periods")
      .select("id, organisation_id, label, start_date, end_date, due_date, is_closed")
      .eq("period_type", "monthly")
      .eq("is_closed", false)
      .lte("due_date", today);

    if (periodError) throw periodError;

    let notified = 0;

    for (const period of periods ?? []) {
      const monthStart = period.reporting_month ?? new Date(period.start_date).toISOString().slice(0, 7) + "-01";

      const { data: submitted } = await supabase
        .from("monthly_reports")
        .select("staff_id")
        .eq("organisation_id", period.organisation_id)
        .eq("reporting_month", monthStart)
        .in("status", ["submitted", "under_review", "approved"]);

      const submittedStaffIds = new Set((submitted ?? []).map((r: any) => r.staff_id));

      const { data: staff, error: staffError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("organisation_id", period.organisation_id)
        .eq("is_active", true);

      if (staffError) throw staffError;

      const notifications = (staff ?? [])
        .filter((s: any) => !submittedStaffIds.has(s.id))
        .map((s: any) => ({
          organisation_id: period.organisation_id,
          recipient_id: s.id,
          type: "report_deadline",
          title: "Monthly report due",
          body: `Your monthly report for ${period.label} (month starting ${monthStart}) is due by ${period.due_date}.`,
          link: `/reports/monthly`,
          created_at: now,
        }));

      if (notifications.length > 0) {
        await supabase.from("notifications").insert(notifications);
        notified += notifications.length;
      }

      await supabase.from("automation_runs").insert({
        organisation_id: period.organisation_id,
        workflow_name: "automation-monthly-report",
        trigger: "schedule",
        status: "completed",
        completed_at: now,
        input: { period_id: period.id, month_start: monthStart },
        output: { notified_count: notifications.length },
      });
    }

    // Mark idempotency completed
    await supabase.from("automation_idempotency").upsert({
      idempotency_key: job.idempotency_key,
      business_operation: job.business_operation,
      organisation_id: job.organisation_id,
      status: "completed",
      result: { periods_processed: (periods ?? []).length, notified },
      completed_at: now,
    }, { onConflict: "idempotency_key" });

    return json({ ok: true, periodsProcessed: (periods ?? []).length, notified });
  } catch (err) {
    console.error("monthly-report error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
