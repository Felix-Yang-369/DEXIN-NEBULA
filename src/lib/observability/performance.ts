import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logServerEvent } from "@/lib/observability/server-log";

export async function recordPerformance(
  supabase: SupabaseClient,
  fields: { route: string; operation: string; durationMs: number; status: "ok" | "error"; metadata?: Record<string, string | number | boolean> },
) {
  logServerEvent("application.performance", {
    route: fields.route,
    operation: fields.operation,
    durationMs: Math.round(fields.durationMs),
    status: fields.status,
  }, fields.status === "error" ? "warn" : "info");
  const { error } = await supabase.rpc("record_performance_event", {
    p_route: fields.route,
    p_operation: fields.operation,
    p_duration_ms: fields.durationMs,
    p_status: fields.status,
    p_metadata: fields.metadata ?? {},
  });
  if (error) {
    logServerEvent("application.performance.persist_failed", { route: fields.route, code: error.code }, "warn");
  }
}
