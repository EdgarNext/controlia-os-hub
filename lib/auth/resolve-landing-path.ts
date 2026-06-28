import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTenantLaunchHref } from "@/lib/navigation/module-launch";
import type { TenantRole } from "@/lib/repos/types";

type TenantMembershipRow = {
  tenant_id: string;
  role: TenantRole;
  tenants: { slug: string } | { slug: string }[] | null;
};

type TenantModuleRow = {
  module_key: string;
  enabled: boolean;
};

type ModuleRoleRow = {
  module_key: string;
  module_role: "admin" | "operator" | "viewer";
};

function extractSlug(row: TenantMembershipRow): string | null {
  const tenants = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
  return tenants?.slug ?? null;
}

export async function resolveUserLandingPath(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: isPlatformOwner, error: ownerError } = await supabase.rpc("is_platform_owner");

  if (ownerError) {
    throw new Error(`Unable to determine platform owner role: ${ownerError.message}`);
  }

  if (isPlatformOwner) {
    return "/tenants";
  }

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role, tenants!inner(slug)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Unable to resolve tenant membership: ${membershipError.message}`);
  }

  if (!membership) {
    return "/no-access";
  }

  const slug = extractSlug(membership as TenantMembershipRow);

  if (!slug) {
    return "/no-access";
  }

  const membershipRow = membership as TenantMembershipRow;
  const tenantId = membershipRow.tenant_id;

  const [{ data: tenantModules, error: tenantModulesError }, { data: moduleRoles, error: moduleRolesError }] =
    await Promise.all([
      supabase.from("tenant_modules").select("module_key, enabled").eq("tenant_id", tenantId),
      supabase.rpc("list_current_tenant_module_roles", { p_tenant_id: tenantId }),
    ]);

  if (tenantModulesError) {
    throw new Error(`Unable to resolve tenant modules: ${tenantModulesError.message}`);
  }

  if (moduleRolesError) {
    throw new Error(`Unable to resolve tenant module roles: ${moduleRolesError.message}`);
  }

  const enabledModuleKeys = ((tenantModules ?? []) as TenantModuleRow[])
    .filter((row) => row.enabled)
    .map((row) => row.module_key);

  const moduleRoleByKey = enabledModuleKeys.reduce<
    Record<string, "admin" | "operator" | "viewer" | "none">
  >((accumulator, moduleKey) => {
    accumulator[moduleKey] = "none";
    return accumulator;
  }, {});

  for (const row of (moduleRoles ?? []) as ModuleRoleRow[]) {
    moduleRoleByKey[row.module_key] = row.module_role;
  }

  return resolveTenantLaunchHref({
    tenantSlug: slug,
    enabledModuleKeys,
    moduleRoleByKey,
  });
}
