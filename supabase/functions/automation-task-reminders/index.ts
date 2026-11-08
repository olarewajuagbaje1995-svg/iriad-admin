import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * automation-task-reminders
 *
 * Phase 3 native backup engine — task assignment & deadline reminders.
 *
 * Handles two business operations:
 *   task_assignment      — notify assignees of newly assigned tasks
 *   task_deadline_reminder — remind assignees of tasks due soon/overdue
 *
 * Idempotent: same idempotency_key won't re-notify for the same task batch.
 *
 * Expects POST body: { job: { job_id, idempotency_key, business_operation,
 *   organisation_id, scheduled_at, payload? } }
 */
serve(async (req) => {
  try {
    const { job } = await req.json();
    const now = new Date().toISOString();
    const today = new Date().toISOString().slice(0, 10);

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
    const operation = job.business_operation;
    let notified = 0;

    if (operation === "task_assignment") {
      // Notify assignees of tasks assigned recently (within last 24h) not yet notified
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: assignments, error: assignError } = await supabase
        .from("task_assignees")
        .select("task_id, profile_id, assigned_at, tasks(title, due_date, status)")
        .gte("assigned_at", yesterday)
        .eq("tasks.organisation_id", orgId);

      if (assignError) throw assignError;

      const notifications = (assignments ?? [])
        .filter((a: any) => a.tasks?.status !== "completed")
        .map((a: any) => ({
          organisation_id: orgId,
          recipient_id: a.profile_id,
          actor_id: a.tasks?.created_by || null,
          type: "task_assigned",
          title: "New task assigned",
          body: `You have been assigned to "${a.tasks.title}"${a.tasks.due_date ? ` due ${a.tasks.due_date}` : ""}.`,
          link: `/tasks/${a.task_id}`,
          created_at: now,
        }));

      if (notifications.length > 0) {
        await supabase.from("notifications").insert(notifications);
        notified += notifications.length;
      }
    } else if (operation === "task_deadline_reminder") {
      // Remind assignees of tasks due today or overdue
      const { data: tasks, error: taskError } = await supabase
        .from("tasks")
        .select("id, title, due_date, status")
        .eq("organisation_id", orgId)
        .in("status", ["not_started", "in_progress"])
        .or(`due_date.eq.${today},due_date.lt.${today}`);

      if (taskError) throw taskError;

      for (const task of tasks ?? []) {
        const { data: assignees } = await supabase
          .from("task_assignees")
          .select("profile_id")
          .eq("task_id", task.id);

        const overdue = task.due_date < today;
        const notifications = (assignees ?? []).map((a: any) => ({
          organisation_id: orgId,
          recipient_id: a.profile_id,
          type: overdue ? "task_deadline" : "task_deadline",
          title: overdue ? "Task overdue" : "Task due today",
          body: `"${task.title}" is ${overdue ? "overdue" : "due today"} (${task.due_date}).`,
          link: `/tasks/${task.id}`,
          created_at: now,
        }));

        if (notifications.length > 0) {
          await supabase.from("notifications").insert(notifications);
          notified += notifications.length;
        }
      }
    }

    await supabase.from("automation_runs").insert({
      organisation_id: orgId,
      workflow_name: "automation-task-reminders",
      trigger: "schedule",
      status: "completed",
      completed_at: now,
      input: { operation },
      output: { notified },
    });

    // Mark idempotency completed
    await supabase.from("automation_idempotency").upsert({
      idempotency_key: job.idempotency_key,
      business_operation: operation,
      organisation_id: orgId,
      status: "completed",
      result: { notified },
      completed_at: now,
    }, { onConflict: "idempotency_key" });

    return json({ ok: true, operation, notified });
  } catch (err) {
    console.error("task-reminders error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
