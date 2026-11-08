import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * automation-daily-attendance-report
 *
 * Phase 3 native backup engine — daily attendance report.
 *
 * For each organisation, aggregates today's attendance (present/late/absent),
 * records a generated_reports entry (idempotent), and notifies configured
 * email report recipients.
 *
 * Idempotent: same idempotency_key won't regenerate the same-day report.
 *
 * Expects POST body: { job: { job_id, idempotency_key, business_operation,
 *   organisation_id, scheduled_at } }
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

    // Aggregate attendance for the day across organisations this job covers
    const { data: orgs, error: orgError } = await supabase
      .from("organisations")
      .select("id, name")
      .eq("id", job.organisation_id)
      .single();
    if (orgError) throw orgError;

    const orgId = job.organisation_id;

    // Count attendance statuses for today
    const { data: attendance } = await supabase
      .from("attendance")
      .select("status, is_late")
      .eq("organisation_id", orgId)
      .eq("attendance_date", workDate);

    const total = attendance?.length ?? 0;
    const present = attendance?.filter(a => a.status === "checked_in").length ?? 0;
    const late = attendance?.filter(a => a.is_late === true).length ?? 0;
    const checkedOut = attendance?.filter(a => a.status === "checked_out").length ?? 0;
    const absent = total - present;

    // Record generated report (idempotent via unique idempotency_key)
    const reportKey = `daily-${orgId}-${workDate}`;
    const { data: report, error: reportError } = await supabase
      .from("generated_reports")
      .upsert({
        organisation_id: orgId,
        report_type: "daily",
        period_start: workDate,
        period_end: workDate,
        idempotency_key: reportKey,
        delivery_status: "pending",
      }, { onConflict: "idempotency_key" })
      .select()
      .single();

    if (reportError) throw reportError;

    // Log automation run
    await supabase.from("automation_runs").insert({
      organisation_id: orgId,
      workflow_name: "automation-daily-attendance-report",
      trigger: "schedule",
      status: "completed",
      completed_at: now,
      input: { work_date: workDate },
      output: { total, present, late, checked_out, absent, report_id: report.id },
    });

    // Notify configured daily report recipients
    const { data: recipients } = await supabase
      .from("email_report_recipients")
      .select("email, name")
      .eq("organisation_id", orgId)
      .contains("report_types", ["daily"])
      .eq("is_active", true);

    if (recipients && recipients.length > 0) {
      await supabase.from("notifications").insert(
        recipients.map((r: any) => ({
          organisation_id: orgId,
          recipient_id: r.id || null,
          type: "report_deadline",
          title: "Daily attendance report ready",
          body: `Daily attendance for ${workDate}: ${present} present, ${late} late, ${absent} absent of ${total} staff.`,
          created_at: now,
        }))
      );
    }

    // Mark idempotency completed
    await supabase.from("automation_idempotency").upsert({
      idempotency_key: job.idempotency_key,
      business_operation: job.business_operation,
      organisation_id: orgId,
      status: "completed",
      result: { report_id: report.id, total, present, late, absent },
      completed_at: now,
    }, { onConflict: "idempotency_key" });

    return json({ ok: true, reportId: report.id, total, present, late, absent });
  } catch (err) {
    console.error("daily-attendance-report error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
