import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ModuleCatalogRecord, TenantModuleAssignmentRecord } from "@/lib/repos/types";

export async function listModuleCatalog(): Promise<ModuleCatalogRecord[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("modules_catalog")
    .select("module_key, name, description, status")
    .order("module_key", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ModuleCatalogRecord[];
}

export async function listTenantModuleAssignments(): Promise<TenantModuleAssignmentRecord[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenant_modules")
    .select("id, tenant_id, module_key, enabled, config, created_at, tenants(id, slug, name, status)")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{
    id: string;
    tenant_id: string;
    module_key: string;
    enabled: boolean;
    config: Record<string, unknown>;
    created_at: string;
    tenants:
      | { id: string; slug: string; name: string; status: "active" | "inactive" | "archived" }[]
      | { id: string; slug: string; name: string; status: "active" | "inactive" | "archived" }
      | null;
  }>).map((row) => {
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] ?? null : row.tenants;

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      module_key: row.module_key,
      enabled: row.enabled,
      config: row.config,
      created_at: row.created_at,
      tenant: tenant
        ? {
            id: tenant.id,
            slug: tenant.slug,
            name: tenant.name,
            status: tenant.status,
          }
        : null,
    };
  });
}
