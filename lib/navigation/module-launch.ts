export type TenantModuleLaunchTarget = {
  label: string;
  href: (tenantSlug: string) => string;
};

type LaunchContext = {
  tenantSlug: string;
  enabledModuleKeys: string[];
  moduleRoleByKey: Record<string, "admin" | "operator" | "viewer" | "none">;
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
  kitchen_inventory: {
    label: "Inventario Cocina",
    href: (tenantSlug) => `/${tenantSlug}/kitchen/inventory`,
  },
  kitchen_recipes: {
    label: "Recetas y Costeo",
    href: (tenantSlug) => `/${tenantSlug}/kitchen/recipes`,
  },
  event_catering: {
    label: "Eventos Catering",
    href: (tenantSlug) => `/${tenantSlug}/kitchen/events`,
  },
  retail_pos: {
    label: "Retail POS",
    href: (tenantSlug) => `/${tenantSlug}/retail`,
  },
};

export function getTenantModuleLaunchTarget(moduleKey: string): TenantModuleLaunchTarget | null {
  return launchTargets[moduleKey] ?? null;
}

const launchPriority = [
  "event_core",
  "sales_pos",
  "retail_pos",
  "kitchen_inventory",
  "kitchen_recipes",
  "event_catering",
] as const;

export function resolveTenantLaunchHref(context: LaunchContext): string {
  const enabledModules = new Set(context.enabledModuleKeys);

  for (const moduleKey of launchPriority) {
    if (!enabledModules.has(moduleKey)) {
      continue;
    }

    const moduleRole = context.moduleRoleByKey[moduleKey] ?? "none";
    if (moduleRole === "none") {
      continue;
    }

    const target = getTenantModuleLaunchTarget(moduleKey);
    if (target) {
      return target.href(context.tenantSlug);
    }
  }

  return "/no-access";
}
