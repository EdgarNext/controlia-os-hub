import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { TenantModuleRecord, TenantRecord, TenantStatus } from "@/lib/repos/types";

function mapStatusFilter(status: string | null): TenantStatus | null {
  if (status === "active" || status === "inactive" || status === "archived") {
    return status;
  }

  return null;
}

export async function listTenants(status: string | null): Promise<TenantRecord[]> {
  const supabase = await getSupabaseServerClient();
  const statusFilter = mapStatusFilter(status);

  let query = supabase
    .from("tenants")
    .select("id, slug, name, status, created_at, created_by, updated_at")
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as TenantRecord[];
}

export async function getTenantById(tenantId: string): Promise<TenantRecord | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, slug, name, status, created_at, created_by, updated_at")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as TenantRecord | null;
}

export async function createTenant(input: {
  name: string;
  slug: string;
  createdBy: string;
}) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenants")
    .insert({
      name: input.name,
      slug: input.slug,
      status: "active",
      created_by: input.createdBy,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as { id: string };
}

export async function updateTenant(input: {
  tenantId: string;
  name: string;
  slug: string;
  status: TenantStatus;
}) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("tenants")
    .update({
      name: input.name,
      slug: input.slug,
      status: input.status,
    })
    .eq("id", input.tenantId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function archiveTenant(tenantId: string) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("tenants").update({ status: "archived" }).eq("id", tenantId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function listTenantModules(tenantId: string): Promise<TenantModuleRecord[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenant_modules")
    .select(
      "id, module_key, enabled, config, created_at, modules_catalog(name, description, status)",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{
    id: string;
    module_key: string;
    enabled: boolean;
    config: Record<string, unknown>;
    created_at: string;
    modules_catalog:
      | { name: string; description: string | null; status: "active" | "deprecated" | "planned" }[]
      | { name: string; description: string | null; status: "active" | "deprecated" | "planned" }
      | null;
  }>).map((row) => {
    const relatedModule = Array.isArray(row.modules_catalog)
      ? row.modules_catalog[0]
      : row.modules_catalog;

    return {
      id: row.id,
      module_key: row.module_key,
      enabled: row.enabled,
      config: row.config,
      created_at: row.created_at,
      module: relatedModule
        ? {
            name: relatedModule.name,
            description: relatedModule.description,
            status: relatedModule.status,
          }
        : null,
    };
  });
}
