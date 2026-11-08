import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const N8N_BASE_URL = Deno.env.get("N8N_BASE_URL") || "";
const N8N_WEBHOOK_SECRET = Deno.env.get("N8N_WEBHOOK_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * automation-dispatcher
 *
 * Phase 3 native backup engine — infrastructure.
 *
 * Claims due Pending/Dispatched/Retrying jobs via claim_automation_job(),
 * then routes each job to n8n (when healthy) or to the native backup engine.
 *
 * Dispatcher prefers n8n whenever it is healthy (hybrid architecture;
 * n8n remains the permanent primary automation workflow).
 *
 * Intended to be invoked on a schedule. Requires server-side secrets only.
 */
serve(async (req) => {
  try {
    // Determine which engine to prefer based on n8n health
    const n8nHealthy = await checkN8nHealth();
    const preferredEngine = n8nHealthy ? "n8n" : "iriad-native";

    // Claim one job for the preferred engine
    const { data: jobs, error: claimError } = await supabase
      .rpc("claim_automation_job", { p_engine: preferredEngine })
      .single();

    if (claimError || !jobs) {
      // No job to claim — that's normal
      return new Response(
        JSON.stringify({ ok: true, claimed: false, engine: preferredEngine }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const job = jobs;
    const startedAt = new Date().toISOString();

    // Record execution attempt
    await supabase.from("automation_executions").insert({
      job_id: job.id,
      engine: preferredEngine,
      attempt_number: job.attempt_number,
      status: "running",
      started_at: startedAt,
    });

    let result: unknown = null;
    let success = false;
    let errorMsg: string | null = null;

    try {
      if (preferredEngine === "n8n") {
        result = await dispatchToN8n(job);
        success = true;
      } else {
        result = await dispatchToNative(job);
        success = true;
      }
    } catch (err) {
      errorMsg = String(err);
      success = false;
    }

    const completedAt = new Date().toISOString();

    // Update job terminal state
    if (success) {
      await supabase.from("automation_jobs").update({
        status: "Completed",
        current_engine: preferredEngine,
        completed_at: completedAt,
        updated_at: completedAt,
      }).eq("id", job.id);

      await supabase.from("automation_executions").update({
        status: "completed",
        completed_at: completedAt,
        result: { output: result },
      }).eq("id", job.id).eq("attempt_number", job.attempt_number);

      // Mark idempotency completed
      await supabase.from("automation_idempotency").upsert({
        idempotency_key: job.idempotency_key,
        business_operation: job.business_operation,
        organisation_id: job.organisation_id,
        status: "completed",
        result: { output: result },
        completed_at: completedAt,
      }, { onConflict: "idempotency_key" });
    } else {
      const retryCount = (job.retry_count ?? 0) + 1;
      const maxRetries = job.max_retries ?? 3;
      const newStatus = retryCount >= maxRetries ? "Failed" : "Retrying";

      await supabase.from("automation_jobs").update({
        status: newStatus,
        retry_count: retryCount,
        error_details: { message: errorMsg, failed_at: completedAt },
        updated_at: completedAt,
      }).eq("id", job.id);

      await supabase.from("automation_executions").update({
        status: "failed",
        completed_at: completedAt,
        error: { message: errorMsg },
      }).eq("id", job.id).eq("attempt_number", job.attempt_number);
    }

    return new Response(
      JSON.stringify({ ok: true, claimed: true, jobId: job.id, engine: preferredEngine, success }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("dispatcher error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

async function checkN8nHealth(): Promise<boolean> {
  if (!N8N_BASE_URL) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${N8N_BASE_URL}/healthz`, {
      signal: controller.signal,
      headers: N8N_WEBHOOK_SECRET ? { "x-webhook-secret": N8N_WEBHOOK_SECRET } : {},
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

async function dispatchToN8n(job: any): Promise<unknown> {
  // Dispatch to the existing n8n Master Workflow via its webhook/HTTP endpoint.
  // The n8n Master JSON is preserved unchanged — we only register and track jobs.
  const webhookUrl = `${N8N_BASE_URL}/webhook/${job.business_operation}`;
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(N8N_WEBHOOK_SECRET ? { "x-webhook-secret": N8N_WEBHOOK_SECRET } : {}),
    },
    body: JSON.stringify({
      job_id: job.job_id,
      idempotency_key: job.idempotency_key,
      business_operation: job.business_operation,
      organisation_id: job.organisation_id,
      scheduled_at: job.scheduled_at,
    }),
  });

  if (!res.ok) {
    throw new Error(`n8n dispatch failed: ${res.status} ${res.statusText}`);
  }

  return await res.json().catch(() => ({ ok: true }));
}

async function dispatchToNative(job: any): Promise<unknown> {
  // Route native backup execution to the appropriate Edge Function handler.
  // Each handler implements equivalent business outcome via PostgreSQL.
  const handlerMap: Record<string, string> = {
    attendance_open: "automation-attendance-open",
    attendance_close: "automation-attendance-close",
    staff_checkin: "automation-staff-checkin",
    staff_checkout: "automation-staff-checkout",
    daily_attendance_report: "automation-daily-attendance-report",
    weekly_report: "automation-weekly-report",
    monthly_report: "automation-monthly-report",
    leave_notification: "automation-leave-notifications",
    leave_approval: "automation-leave-notifications",
    correction_notification: "automation-correction-notifications",
    correction_approval: "automation-correction-notifications",
    task_assignment: "automation-task-reminders",
    task_deadline_reminder: "automation-task-reminders",
    announcement_notification: "automation-announcement-notification",
    document_notification: "automation-document-notifications",
    project_notification: "automation-project-notifications",
    knowledge_ingestion: "automation-knowledge-ingestion",
    knowledge_chat: "automation-knowledge-chat",
    error_alert: "automation-error-alert",
    recovery: "automation-missed-schedule-recovery",
  };

  const handlerName = handlerMap[job.business_operation];
  if (!handlerName) {
    throw new Error(`No native handler registered for business_operation: ${job.business_operation}`);
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${handlerName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ job }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Native handler ${handlerName} failed: ${res.status} ${body}`);
  }

  return await res.json().catch(() => ({ ok: true }));
}
