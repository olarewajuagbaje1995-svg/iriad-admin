import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const N8N_BASE_URL = Deno.env.get("N8N_BASE_URL") || "";
const N8N_WEBHOOK_SECRET = Deno.env.get("N8N_WEBHOOK_SECRET") || "";
const FAILURE_THRESHOLD = parseInt(Deno.env.get("N8N_FAILURE_THRESHOLD") || "3", 10);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * automation-health-check
 *
 * Phase 3 native backup engine — infrastructure.
 *
 * Pings the n8n health endpoint, updates automation_engines.status for n8n,
 * tracks consecutive failures, and trips failover after the threshold.
 *
 * Intended to be invoked on a schedule (pg_cron or external scheduler).
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side only).
 */
serve(async (req) => {
  try {
    const n8nHealthy = await checkN8nHealth();

    // Upsert n8n engine health
    const now = new Date().toISOString();
    if (n8nHealthy) {
      await supabase
        .from("automation_engines")
        .upsert({
          name: "n8n",
          kind: "primary",
          status: "healthy",
          last_health_check_at: now,
          last_successful_health_check_at: now,
          consecutive_failures: 0,
          updated_at: now,
        }, { onConflict: "name" });
    } else {
      // Fetch current consecutive failures
      const { data: current } = await supabase
        .from("automation_engines")
        .select("consecutive_failures, status")
        .eq("name", "n8n")
        .single();

      const failures = ((current?.consecutive_failures ?? 0) + 1);
      const status = failures >= FAILURE_THRESHOLD ? "unhealthy" : "degraded";

      await supabase
        .from("automation_engines")
        .upsert({
          name: "n8n",
          kind: "primary",
          status,
          last_health_check_at: now,
          consecutive_failures: failures,
          updated_at: now,
        }, { onConflict: "name" });

      // Log the failure
      await supabase.from("automation_runs").insert({
        workflow_name: "n8n-health-check",
        trigger: "schedule",
        status: "failed",
        error: { message: "n8n health check failed", consecutive_failures: failures },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, n8nHealthy }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("health-check error:", err);
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
