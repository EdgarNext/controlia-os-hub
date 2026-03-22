export type TenantModuleLaunchTarget = {
  label: string;
  href: (tenantSlug: string) => string;
};

const launchTargets: Record<string, TenantModuleLaunchTarget> = {
  event_core: {
    label: "Dashboard",
    href: (tenantSlug) => `/${tenantSlug}/dashboard`,
  },
  sales_pos: {
    label: "POS",
    href: (tenantSlug) => `/${tenantSlug}/pos`,
  },
};

export function getTenantModuleLaunchTarget(moduleKey: string): TenantModuleLaunchTarget | null {
  return launchTargets[moduleKey] ?? null;
}
