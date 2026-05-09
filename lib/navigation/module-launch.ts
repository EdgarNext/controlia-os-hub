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
};

export function getTenantModuleLaunchTarget(moduleKey: string): TenantModuleLaunchTarget | null {
  return launchTargets[moduleKey] ?? null;
}
