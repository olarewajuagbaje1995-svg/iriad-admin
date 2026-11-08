import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * automation-project-notifications
 *
 * Phase 3 native backup engine — project notifications.
 *
 * Notifies project members about project status changes, new milestones, and
 * upcoming milestone due dates.
 *
 * Idempotent: same idempotency_key won't re-notify for the same project batch.
 *
 * Expects POST body: { job: { ... } }
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
    let notified = 0;

    // Find recently updated projects (last 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: projects, error: projError } = await supabase
      .from("projects")
      .select("id, title, status, updated_at, created_by")
      .eq("organisation_id", orgId)
      .gte("updated_at", yesterday);

    if (projError) throw projError;

    for (const project of projects ?? []) {
      const { data: members } = await supabase
        .from("project_members")
        .select("profile_id")
        .eq("project_id", project.id);

      if (members && members.length > 0) {
        await supabase.from("notifications").insert(
          members.map((m: any) => ({
            organisation_id: orgId,
            recipient_id: m.profile_id,
            actor_id: project.created_by || null,
            type: "project_milestone",
            title: `Project updated: ${project.title}`,
            body: `Project status is now ${project.status}.`,
            link: `/projects/${project.id}`,
            created_at: now,
          }))
        );
        notified += members.length;
      }
    }

    // Find milestones due today
    const { data: milestones, error: msError } = await supabase
      .from("project_milestones")
      .select("id, title, due_date, status, projects(title, organisation_id)")
      .eq("due_date", today)
      .in("status", ["pending", "in_progress"]);

    if (msError) throw msError;

    for (const ms of milestones ?? []) {
      const projOrgId = ms.projects?.organisation_id;
      if (projOrgId !== orgId) continue;

      const { data: members } = await supabase
        .from("project_members")
        .select("profile_id")
        .eq("project_id", ms.projects.id);

      if (members && members.length > 0) {
        await supabase.from("notifications").insert(
          members.map((m: any) => ({
            organisation_id: projOrgId,
            recipient_id: m.profile_id,
            type: "project_milestone",
            title: `Milestone due today: ${ms.title}`,
            body: `Milestone "${ms.title}" is due today in project "${ms.projects.title}".`,
            link: `/projects/${ms.projects.id}`,
            created_at: now,
          }))
        );
        notified += members.length;
      }
    }

    await supabase.from("automation_runs").insert({
      organisation_id: orgId,
      workflow_name: "automation-project-notifications",
      trigger: "schedule",
      status: "completed",
      completed_at: now,
      input: {},
      output: { projects: (projects ?? []).length, notified },
    });

    // Mark idempotency completed
    await supabase.from("automation_idempotency").upsert({
      idempotency_key: job.idempotency_key,
      business_operation: job.business_operation,
      organisation_id: orgId,
      status: "completed",
      result: { projects: (projects ?? []).length, notified },
      completed_at: now,
    }, { onConflict: "idempotency_key" });

    return json({ ok: true, projects: (projects ?? []).length, notified });
  } catch (err) {
    console.error("project-notifications error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
