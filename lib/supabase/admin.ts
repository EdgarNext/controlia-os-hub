import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleConfig } from "./config";
import type { RuntimePerfTrace } from "@/lib/retail-pos/runtime-perf";

export function getSupabaseAdminClient(input?: { trace?: RuntimePerfTrace }) {
  const startedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const { url, serviceRoleKey } = getSupabaseServiceRoleConfig();
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "invalid-url";
    }
  })();

  const client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const durationMs =
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
    startedAt;
  input?.trace?.addDuration("supabase_client_create", durationMs);
  console.info(
    `[retail-pos][runtime][supabase-admin] ${JSON.stringify({
      request_id: input?.trace?.requestId ?? null,
      supabase_host: host,
      has_service_role_key: Boolean(serviceRoleKey),
      node_env: process.env.NODE_ENV ?? "unknown",
      duration_ms: Math.round(durationMs * 100) / 100,
    })}`,
  );

  return client;
}
