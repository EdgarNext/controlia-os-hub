import { cache } from "react";
import {
  getCurrentTenantModulePageAccessMap,
  hasModulePageAccess,
} from "@/lib/auth/module-page-access";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { TenantRole } from "@/lib/repos/types";
import type { NavDomain, NavItem, NavSection } from "./platform-nav";

type TenantDomainKey = "venue" | "commercial" | "cafe" | "admin";

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
    const accessMap = await getCurrentTenantModulePageAccessMap(tenantId, item.moduleKeys[0]);
    const currentLevel = accessMap[item.pageKey] ?? "none";

    if (!hasModulePageAccess(currentLevel, "read")) {
      return null;
    }
  }

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

const getTenantNavCached = cache(
  async (
    tenantId: string,
    tenantSlug: string,
    role: TenantRole,
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
                buildItem(tenantSlug, tenantId, role, enabledModules, domain.accentToken, item),
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
  context: Pick<TenantContext, "tenantId" | "tenantSlug" | "tenantRole" | "enabledModuleKeys">,
): Promise<NavSection[]> {
  const enabledModuleKeysSignature = [...context.enabledModuleKeys].sort().join(",");
  return getTenantNavCached(
    context.tenantId,
    context.tenantSlug,
    context.tenantRole,
    enabledModuleKeysSignature,
  );
}
