import { cache } from "react";
import type { TenantRole } from "@/lib/repos/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type TenantModuleRole = TenantRole | "none";
export type TenantModuleAccessLevel = "none" | "read" | "manage";

type ModuleRoleRow = {
  module_key: string;
  module_role: TenantRole;
};

const listCurrentTenantModuleRolesCached = cache(
  async (tenantId: string): Promise<ModuleRoleRow[]> => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.rpc("list_current_tenant_module_roles", {
      p_tenant_id: tenantId,
    });

    if (error) {
      throw new Error(`Unable to resolve tenant module roles: ${error.message}`);
    }

    return (data ?? []) as ModuleRoleRow[];
  },
);

export async function getCurrentTenantModuleRoleMap(
  tenantId: string,
): Promise<Record<string, TenantModuleRole>> {
  const rows = await listCurrentTenantModuleRolesCached(tenantId);

  return rows.reduce<Record<string, TenantModuleRole>>((accumulator, row) => {
    accumulator[row.module_key] = row.module_role;
    return accumulator;
  }, {});
}

export function hasTenantModuleRole(
  moduleRole: TenantModuleRole | undefined,
): moduleRole is Exclude<TenantModuleRole, "none"> {
  return moduleRole === "admin" || moduleRole === "operator" || moduleRole === "viewer";
}

export function hasTenantModuleAccess(
  moduleRole: TenantModuleRole | undefined,
  requiredLevel: Exclude<TenantModuleAccessLevel, "none"> = "read",
): boolean {
  if (!hasTenantModuleRole(moduleRole)) {
    return false;
  }

  if (requiredLevel === "manage") {
    return moduleRole === "admin";
  }

  return true;
}

export async function assertCurrentTenantModuleAccess(
  tenantId: string,
  moduleKey: string,
  requiredLevel: Exclude<TenantModuleAccessLevel, "none"> = "read",
): Promise<TenantModuleRole> {
  const moduleRoleByKey = await getCurrentTenantModuleRoleMap(tenantId);
  const moduleRole = moduleRoleByKey[moduleKey] ?? "none";

  if (!hasTenantModuleAccess(moduleRole, requiredLevel)) {
    throw new Error("Access denied for this tenant module.");
  }

  return moduleRole;
}
