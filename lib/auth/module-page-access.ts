import { cache } from "react";
import { requireUser } from "@/lib/auth/require-user";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type ModulePageAccessLevel = "none" | "read" | "manage";
export type SalesPosPageKey = "devices" | "categories" | "products" | "reports";

type ModulePageAccessRow = {
  page_key: string;
  access_level: ModulePageAccessLevel;
};

const accessRank: Record<ModulePageAccessLevel, number> = {
  none: 0,
  read: 1,
  manage: 2,
};

const listCurrentTenantModulePageAccessesCached = cache(
  async (tenantId: string, moduleKey: string): Promise<ModulePageAccessRow[]> => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.rpc("list_current_tenant_module_page_accesses", {
      p_tenant_id: tenantId,
      p_module_key: moduleKey,
    });

    if (error) {
      throw new Error(`Unable to resolve module page access: ${error.message}`);
    }

    return (data ?? []) as ModulePageAccessRow[];
  },
);

export function hasModulePageAccess(
  currentLevel: ModulePageAccessLevel,
  requiredLevel: Exclude<ModulePageAccessLevel, "none"> = "read",
): boolean {
  return accessRank[currentLevel] >= accessRank[requiredLevel];
}

export async function getCurrentTenantModulePageAccessMap(
  tenantId: string,
  moduleKey: string,
): Promise<Record<string, ModulePageAccessLevel>> {
  const rows = await listCurrentTenantModulePageAccessesCached(tenantId, moduleKey);

  return rows.reduce<Record<string, ModulePageAccessLevel>>((accumulator, row) => {
    accumulator[row.page_key] = row.access_level;
    return accumulator;
  }, {});
}

export async function assertSalesPosPageAccess(
  tenantId: string,
  pageKey: SalesPosPageKey,
  requiredLevel: Exclude<ModulePageAccessLevel, "none"> = "read",
): Promise<ModulePageAccessLevel> {
  const accessMap = await getCurrentTenantModulePageAccessMap(tenantId, "sales_pos");
  const currentLevel = accessMap[pageKey] ?? "none";

  if (!hasModulePageAccess(currentLevel, requiredLevel)) {
    throw new Error("Access denied for this tenant page.");
  }

  return currentLevel;
}

export async function resolveSalesPosPageContext(
  tenantSlug: string,
  pageKey: SalesPosPageKey,
  requiredLevel: Exclude<ModulePageAccessLevel, "none"> = "read",
) {
  const tenant = await resolveTenantContextBySlug(tenantSlug);
  await assertSalesPosPageAccess(tenant.tenantId, pageKey, requiredLevel);
  return tenant;
}

export async function resolveSalesPosPageActor(
  tenantSlug: string,
  pageKey: SalesPosPageKey,
  requiredLevel: Exclude<ModulePageAccessLevel, "none"> = "manage",
) {
  const tenant = await resolveSalesPosPageContext(tenantSlug, pageKey, requiredLevel);
  const user = await requireUser();

  return {
    tenant,
    user,
  };
}
