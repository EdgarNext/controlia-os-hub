import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export function normalizeTenantId(rawTenantId: unknown): string {
  const tenantId = String(rawTenantId ?? "").trim();
  if (!tenantId) {
    throw new Error("Tenant is required.");
  }
  return tenantId;
}

export async function assertTenantMember(tenantId: string) {
  const user = await requireUser();
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase.rpc("is_tenant_member", {
    p_tenant_id: tenantId,
  });

  if (error) {
    throw new Error(`Unable to verify tenant membership: ${error.message}`);
  }

  if (!data) {
    throw new Error("Access denied for this tenant.");
  }

  return user;
}

export async function assertTenantAdmin(tenantId: string) {
  const user = await requireUser();
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase.rpc("is_tenant_admin", {
    p_tenant_id: tenantId,
  });

  if (error) {
    throw new Error(`Unable to verify tenant admin role: ${error.message}`);
  }

  if (!data) {
    throw new Error("Admin access is required for this tenant action.");
  }

  return user;
}
