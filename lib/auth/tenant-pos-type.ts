import type { TenantContext } from "@/lib/auth/tenant-context";

export type TenantPosType = "simple" | "variants" | "retail" | "unknown";

type ModuleConfigMap = Record<string, Record<string, unknown>>;

function readConfigPosType(config: Record<string, unknown> | undefined): TenantPosType | null {
  const rawValue = config?.pos_type;

  if (rawValue === "simple" || rawValue === "variants" || rawValue === "retail") {
    return rawValue;
  }

  return null;
}

export function resolveTenantPosType(input: {
  enabledModuleKeys: string[];
  moduleConfigsByKey: ModuleConfigMap;
}): TenantPosType {
  const enabledModules = new Set(input.enabledModuleKeys);
  const retailConfigType = readConfigPosType(input.moduleConfigsByKey.retail_pos);
  const salesConfigType = readConfigPosType(input.moduleConfigsByKey.sales_pos);

  if (enabledModules.has("retail_pos") || retailConfigType === "retail") {
    return "retail";
  }

  if (enabledModules.has("sales_pos") && salesConfigType === "simple") {
    return "simple";
  }

  if (enabledModules.has("sales_pos") && salesConfigType === "variants") {
    return "variants";
  }

  return "unknown";
}

export function isTenantPosTypeAllowed(
  tenantPosType: TenantPosType,
  allowedPosTypes: TenantPosType[],
  allowUnknown = true,
): boolean {
  if (allowUnknown && tenantPosType === "unknown") {
    return true;
  }

  return allowedPosTypes.includes(tenantPosType);
}

export function assertTenantPosType(
  tenant: Pick<TenantContext, "posType">,
  allowedPosTypes: TenantPosType[],
  allowUnknown = true,
) {
  if (!isTenantPosTypeAllowed(tenant.posType, allowedPosTypes, allowUnknown)) {
    throw new Error("Access denied for this POS experience.");
  }
}
