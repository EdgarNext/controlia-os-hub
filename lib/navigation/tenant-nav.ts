import { cache } from "react";
import {
  getCurrentTenantModulePageAccessMap,
  hasModulePageAccess,
} from "@/lib/auth/module-page-access";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { TenantRole } from "@/lib/repos/types";
import type { NavDomain, NavItem, NavSection } from "./platform-nav";

type TenantDomainKey = "venue" | "commercial" | "cafe" | "kitchen" | "admin";

type TenantNavItemConfig = {
  href: (tenantSlug: string) => string;
  label: string;
  iconKey: NavItem["iconKey"];
  match?: "exact" | "prefix";
  requiredRoles?: TenantRole[];
  moduleKeys: string[];
  pageKey?: string;
  children?: Array<{
    href: (tenantSlug: string) => string;
    label: string;
    match?: "exact" | "prefix";
    moduleKeys?: string[];
    pageKey?: string;
  }>;
};

type TenantNavDomainConfig = {
  key: TenantDomainKey;
  label: string;
  accentToken: string;
  moduleKeys: string[];
  items: TenantNavItemConfig[];
};

const tenantNavDomains: TenantNavDomainConfig[] = [
  {
    key: "venue",
    label: "Venue Operations",
    accentToken: "--nav-accent-venue",
    moduleKeys: ["event_core"],
    items: [
      { href: (tenantSlug) => `/${tenantSlug}/dashboard`, label: "Dashboard", iconKey: "reports", match: "prefix", moduleKeys: ["event_core"] },
      { href: (tenantSlug) => `/${tenantSlug}/venue`, label: "Salas y Layouts", iconKey: "catalog", match: "prefix", moduleKeys: ["event_core"] },
      { href: (tenantSlug) => `/${tenantSlug}/events`, label: "Eventos", iconKey: "reports", match: "prefix", moduleKeys: ["event_core"] },
    ],
  },
  {
    key: "commercial",
    label: "Comercial",
    accentToken: "--nav-accent-commercial",
    moduleKeys: ["event_core"],
    items: [
      { href: (tenantSlug) => `/${tenantSlug}/catalog`, label: "Catalogo", iconKey: "catalog", match: "prefix", moduleKeys: ["event_core"] },
      { href: (tenantSlug) => `/${tenantSlug}/reports`, label: "Reportes", iconKey: "reports", match: "prefix", moduleKeys: ["event_core"] },
    ],
  },
  {
    key: "cafe",
    label: "Cafeteria",
    accentToken: "--nav-accent-cafe",
    moduleKeys: ["sales_pos"],
    items: [
      {
        href: (tenantSlug) => `/${tenantSlug}/pos/devices`,
        label: "Dispositivos",
        iconKey: "devices",
        match: "prefix",
        moduleKeys: ["sales_pos"],
        pageKey: "devices",
      },
      {
        href: (tenantSlug) => `/${tenantSlug}/pos/catalog`,
        label: "Catálogo POS",
        iconKey: "products",
        match: "prefix",
        moduleKeys: ["sales_pos"],
        pageKey: "products",
      },
      {
        href: (tenantSlug) => `/${tenantSlug}/pos/catalog-v2`,
        label: "Catálogo V2",
        iconKey: "products",
        match: "prefix",
        moduleKeys: ["sales_pos"],
        pageKey: "products",
      },
      {
        href: (tenantSlug) => `/${tenantSlug}/pos/users`,
        label: "Usuarios POS",
        iconKey: "users",
        match: "prefix",
        moduleKeys: ["sales_pos"],
        pageKey: "users",
      },
      {
        href: (tenantSlug) => `/${tenantSlug}/pos/reports`,
        label: "Reportes POS",
        iconKey: "reports",
        match: "prefix",
        moduleKeys: ["sales_pos"],
        pageKey: "reports",
        children: [
          {
            href: (tenantSlug) => `/${tenantSlug}/pos/reports`,
            label: "Resumen",
            match: "exact",
          },
          {
            href: (tenantSlug) => `/${tenantSlug}/pos/reports/sales`,
            label: "Ventas",
            match: "prefix",
          },
          {
            href: (tenantSlug) => `/${tenantSlug}/pos/reports/products`,
            label: "Productos",
            match: "prefix",
          },
          {
            href: (tenantSlug) => `/${tenantSlug}/pos/reports/cashiers`,
            label: "Cajeros",
            match: "prefix",
          },
          {
            href: (tenantSlug) => `/${tenantSlug}/pos/reports/cashier-shift`,
            label: "Cortes",
            match: "prefix",
          },
          {
            href: (tenantSlug) => `/${tenantSlug}/pos/reports/alerts`,
            label: "Alertas",
            match: "prefix",
          },
        ],
      },
    ],
  },
  {
    key: "admin",
    label: "Admin",
    accentToken: "--nav-accent-admin",
    moduleKeys: ["event_core"],
    items: [
      {
        href: (tenantSlug) => `/${tenantSlug}/users`,
        label: "Usuarios",
        iconKey: "users",
        match: "prefix",
        moduleKeys: ["event_core"],
        requiredRoles: ["admin"],
      },
    ],
  },
  {
    key: "kitchen",
    label: "Cocina",
    accentToken: "--nav-accent-commercial",
    moduleKeys: ["kitchen_inventory", "kitchen_recipes", "event_catering"],
    items: [
      {
        href: (tenantSlug) => `/${tenantSlug}/kitchen/inventory`,
        label: "Inventario",
        iconKey: "catalog",
        match: "prefix",
        moduleKeys: ["kitchen_inventory"],
        pageKey: "overview",
        children: [
          {
            href: (tenantSlug) => `/${tenantSlug}/kitchen/inventory/items`,
            label: "Insumos",
            match: "prefix",
            moduleKeys: ["kitchen_inventory"],
            pageKey: "items",
          },
          {
            href: (tenantSlug) => `/${tenantSlug}/kitchen/inventory/movements`,
            label: "Movimientos",
            match: "prefix",
            moduleKeys: ["kitchen_inventory"],
            pageKey: "movements",
          },
          {
            href: (tenantSlug) => `/${tenantSlug}/kitchen/inventory/setup`,
            label: "Configuración",
            match: "prefix",
            moduleKeys: ["kitchen_inventory"],
            pageKey: "items",
          },
          {
            href: (tenantSlug) => `/${tenantSlug}/kitchen/inventory/presentaciones-precios`,
            label: "Presentaciones y Precios",
            match: "prefix",
            moduleKeys: ["kitchen_inventory"],
            pageKey: "items",
          },
        ],
      },
      {
        href: (tenantSlug) => `/${tenantSlug}/kitchen/recipes`,
        label: "Recetas y Costeo",
        iconKey: "products",
        match: "prefix",
        moduleKeys: ["kitchen_recipes"],
        pageKey: "overview",
      },
      {
        href: (tenantSlug) => `/${tenantSlug}/kitchen/events`,
        label: "Catering por Evento",
        iconKey: "reports",
        match: "prefix",
        moduleKeys: ["event_catering"],
        pageKey: "plans",
        children: [
          {
            href: (tenantSlug) => `/${tenantSlug}/kitchen/events`,
            label: "Eventos",
            match: "exact",
            moduleKeys: ["event_catering"],
            pageKey: "plans",
          },
          {
            href: (tenantSlug) => `/${tenantSlug}/kitchen/events/plans`,
            label: "Planes / Servicios",
            match: "prefix",
            moduleKeys: ["event_catering"],
            pageKey: "plans",
          },
          {
            href: (tenantSlug) => `/${tenantSlug}/kitchen/events/requisitions`,
            label: "Requisiciones",
            match: "prefix",
            moduleKeys: ["event_catering"],
            pageKey: "requisitions",
          },
          {
            href: (tenantSlug) => `/${tenantSlug}/kitchen/events/receipts`,
            label: "Recepciones",
            match: "prefix",
            moduleKeys: ["event_catering"],
            pageKey: "requisitions",
          },
          {
            href: (tenantSlug) => `/${tenantSlug}/kitchen/events/consumption`,
            label: "Consumo real",
            match: "prefix",
            moduleKeys: ["event_catering"],
            pageKey: "consumption",
          },
          {
            href: (tenantSlug) => `/${tenantSlug}/kitchen/events/corrections`,
            label: "Correcciones",
            match: "prefix",
            moduleKeys: ["event_catering"],
            pageKey: "requisitions",
          },
        ],
      },
      {
        href: (tenantSlug) => `/${tenantSlug}/kitchen/reports`,
        label: "Reportes Cocina",
        iconKey: "reports",
        match: "prefix",
        moduleKeys: ["kitchen_inventory"],
        pageKey: "reports",
      },
    ],
  },
];

function getTenantEnabledDomainsModules(enabledModuleKeys: string[]): Set<string> {
  return new Set(enabledModuleKeys);
}

function hasAnyEnabledModule(moduleKeys: string[], enabledModules: Set<string>) {
  return moduleKeys.some((moduleKey) => enabledModules.has(moduleKey));
}

function canViewItemByRole(role: TenantRole, requiredRoles?: TenantRole[]) {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  return requiredRoles.includes(role);
}

async function buildItem(
  tenantSlug: string,
  tenantId: string,
  role: TenantRole,
  enabledModules: Set<string>,
  isPlatformOwner: boolean,
  accentToken: string,
  item: TenantNavItemConfig,
): Promise<NavItem | null> {
  if (!hasAnyEnabledModule(item.moduleKeys, enabledModules)) {
    return null;
  }

  if (!canViewItemByRole(role, item.requiredRoles)) {
    return null;
  }

  if (item.pageKey) {
    if (isPlatformOwner && item.pageKey === "users") {
      return {
        href: item.href(tenantSlug),
        label: item.label,
        iconKey: item.iconKey,
        match: item.match ?? "prefix",
        accentToken,
        children: item.children?.map((child) => ({
          href: child.href(tenantSlug),
          label: child.label,
          match: child.match ?? "prefix",
        })),
      };
    }

    const accessMap = await getCurrentTenantModulePageAccessMap(tenantId, item.moduleKeys[0]);
    const currentLevel = accessMap[item.pageKey] ?? "none";

    if (!hasModulePageAccess(currentLevel, "read")) {
      return null;
    }
  }

  let children: NavItem["children"] | undefined;
  if (item.children && item.children.length > 0) {
    const visibleChildren = await Promise.all(
      item.children.map(async (child) => {
        const childModules = child.moduleKeys ?? item.moduleKeys;
        if (!hasAnyEnabledModule(childModules, enabledModules)) return null;
        if (!child.pageKey) {
          return {
            href: child.href(tenantSlug),
            label: child.label,
            match: child.match ?? "prefix",
          };
        }
        const accessMap = await getCurrentTenantModulePageAccessMap(tenantId, childModules[0]);
        const currentLevel = accessMap[child.pageKey] ?? "none";
        if (!hasModulePageAccess(currentLevel, "read")) return null;
        return {
          href: child.href(tenantSlug),
          label: child.label,
          match: child.match ?? "prefix",
        };
      }),
    );
    children = visibleChildren.filter((child): child is NonNullable<typeof child> => child !== null);
  }

  return {
    href: item.href(tenantSlug),
    label: item.label,
    iconKey: item.iconKey,
    match: item.match ?? "prefix",
    accentToken,
    children,
  };
}

const getTenantNavCached = cache(
  async (
    tenantId: string,
    tenantSlug: string,
    role: TenantRole,
    isPlatformOwner: boolean,
    enabledModuleKeysSignature: string,
  ): Promise<NavSection[]> => {
    const enabledModules = getTenantEnabledDomainsModules(
      enabledModuleKeysSignature.split(",").filter(Boolean),
    );

    const domains = await Promise.all(
      tenantNavDomains
        .filter((domain) => hasAnyEnabledModule(domain.moduleKeys, enabledModules))
        .map(async (domain) => {
          const items = (
            await Promise.all(
              domain.items.map((item) =>
                buildItem(
                  tenantSlug,
                  tenantId,
                  role,
                  enabledModules,
                  isPlatformOwner,
                  domain.accentToken,
                  item,
                ),
              ),
            )
          ).filter((item): item is NavItem => item !== null);

          const navDomain: NavDomain = {
            key: domain.key,
            label: domain.label,
            accentToken: domain.accentToken,
            items,
          };

          return navDomain;
        }),
    );

    return [
      {
        id: "tenant-domains",
        label: "Operaciones",
        domains: domains.filter((domain) => domain.items.length > 0),
      },
    ];
  },
);

export async function getTenantNav(
  context: Pick<
    TenantContext,
    "tenantId" | "tenantSlug" | "tenantRole" | "enabledModuleKeys" | "isPlatformOwner"
  >,
): Promise<NavSection[]> {
  const enabledModuleKeysSignature = [...context.enabledModuleKeys].sort().join(",");
  return getTenantNavCached(
    context.tenantId,
    context.tenantSlug,
    context.tenantRole,
    context.isPlatformOwner,
    enabledModuleKeysSignature,
  );
}
