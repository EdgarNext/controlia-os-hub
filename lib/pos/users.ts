import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { RuntimePerfTrace } from "@/lib/retail-pos/runtime-perf";
import { runSupabaseReadWithRetry } from "@/lib/retail-pos/runtime-supabase-retry";

export type PosUserRow = {
  id: string;
  tenant_id: string;
  name: string;
  pin_hash: string;
  role: "cashier" | "supervisor" | "admin";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listPosUsersForTenant(
  tenantId: string,
  trace?: RuntimePerfTrace,
): Promise<PosUserRow[]> {
  const supabase = getSupabaseAdminClient({ trace });
  const { data, error } = await runSupabaseReadWithRetry<PosUserRow[]>({
    trace,
    step: "operators_query",
    query: (signal) =>
      supabase
        .from("pos_users")
        .select("id, tenant_id, name, pin_hash, role, is_active, created_at, updated_at")
        .abortSignal(signal)
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true }),
  });

  if (error) {
    throw new Error(`No fue posible consultar usuarios POS: ${error.message}`);
  }

  return (data ?? []) as PosUserRow[];
}
