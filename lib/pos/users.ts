import { getSupabaseAdminClient } from "@/lib/supabase/admin";

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

export async function listPosUsersForTenant(tenantId: string): Promise<PosUserRow[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pos_users")
    .select("id, tenant_id, name, pin_hash, role, is_active, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`No fue posible consultar usuarios POS: ${error.message}`);
  }

  return (data ?? []) as PosUserRow[];
}
