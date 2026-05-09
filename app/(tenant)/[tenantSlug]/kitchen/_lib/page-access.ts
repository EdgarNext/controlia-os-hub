import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import {
  resolveTenantModulePageContext,
  type TenantModuleKey,
} from "@/lib/auth/module-page-access";

export async function resolveKitchenPage(
  tenantSlug: string,
  moduleKey: TenantModuleKey,
  pageKey: string,
) {
  try {
    const tenant = await resolveTenantModulePageContext(tenantSlug, moduleKey, pageKey, "read");

    return {
      ok: true as const,
      tenant,
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false as const,
      };
    }

    throw error;
  }
}
