import { requireUser } from "@/lib/auth/require-user";
import type { TenantModuleKey } from "@/lib/auth/module-page-access";
import {
  hasTenantModuleAccess,
  type TenantModuleAccessLevel,
} from "@/lib/auth/module-role-access";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";

export async function resolveTenantModuleContext(
  tenantSlug: string,
  moduleKey: TenantModuleKey,
  requiredLevel: Exclude<TenantModuleAccessLevel, "none"> = "read",
) {
  const tenant = await resolveTenantContextBySlug(tenantSlug);
  const moduleRole = tenant.moduleRoleByKey[moduleKey] ?? "none";

  if (!hasTenantModuleAccess(moduleRole, requiredLevel)) {
    throw new Error("Access denied for this tenant module.");
  }

  return tenant;
}

export async function resolveTenantModuleActor(
  tenantSlug: string,
  moduleKey: TenantModuleKey,
  requiredLevel: Exclude<TenantModuleAccessLevel, "none"> = "manage",
) {
  const tenant = await resolveTenantModuleContext(tenantSlug, moduleKey, requiredLevel);
  const user = await requireUser();

  return {
    tenant,
    user,
  };
}
