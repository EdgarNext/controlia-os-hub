import { cache } from "react";
import {
  getCurrentTenantModulePageAccessMap,
  hasModulePageAccess,
} from "@/lib/auth/module-page-access";
import { hasTenantModuleRole } from "@/lib/auth/module-role-access";
import type { TenantPosType } from "@/lib/auth/tenant-pos-type";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { TenantRole } from "@/lib/repos/types";
import type { NavDomain, NavItem, NavSection } from "./platform-nav";

type TenantDomainKey = "venue" | "commercial" | "cafe" | "kitchen" | "admin" | "retail";

type TenantNavItemConfig = {
  href: (tenantSlug: string) => string;
  label: string;
  iconKey: NavItem["iconKey"];
  match?: "exact" | "prefix";
  requiresPlatformOwner?: boolean;
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

const venueNavDomain: TenantNavDomainConfig = {
  key: "venue",
  label: "Eventos y Salas",
  accentToken: "--nav-accent-venue",
  moduleKeys: ["event_core"],
  items: [
    { href: (tenantSlug) => `/${tenantSlug}/dashboard`, label: "Dashboard", iconKey: "reports", match: "prefix", moduleKeys: ["event_core"] },
    { href: (tenantSlug) => `/${tenantSlug}/venue`, label: "Salas y Layouts", iconKey: "catalog", match: "prefix", moduleKeys: ["event_core"] },
    { href: (tenantSlug) => `/${tenantSlug}/events`, label: "Eventos", iconKey: "reports", match: "prefix", moduleKeys: ["event_core"] },
  ],
};

const cafeSimpleNavDomain: TenantNavDomainConfig = {
  key: "cafe",
  label: "Cafeteria · POS Simple",
  accentToken: "--nav-accent-cafe",
  moduleKeys: ["sales_pos"],
  items: [
    {
      href: (tenantSlug) => `/${tenantSlug}/pos/catalog/categories`,
      label: "Categorias",
      iconKey: "categories",
      match: "prefix",
      moduleKeys: ["sales_pos"],
      pageKey: "categories",
    },
    {
      href: (tenantSlug) => `/${tenantSlug}/pos/catalog/products`,
      label: "Productos",
      iconKey: "products",
      match: "prefix",
      moduleKeys: ["sales_pos"],
      pageKey: "products",
    },
    {
      href: (tenantSlug) => `/${tenantSlug}/pos/reports?view=income`,
      label: "Reportes POS simple",
      iconKey: "reports",
      match: "prefix",
      moduleKeys: ["sales_pos"],
      pageKey: "reports",
    },
  ],
};

const cafeVariantsNavDomain: TenantNavDomainConfig = {
  key: "cafe",
  label: "Cafeteria · POS Configurable",
  accentToken: "--nav-accent-cafe",
  moduleKeys: ["sales_pos"],
  items: [
    {
      href: (tenantSlug) => `/${tenantSlug}/pos/catalog`,
      label: "Catalogo configurable",
      iconKey: "products",
      match: "prefix",
      moduleKeys: ["sales_pos"],
      pageKey: "products",
      children: [
        {
          href: (tenantSlug) => `/${tenantSlug}/pos/catalog/categories`,
          label: "Categorias",
          match: "prefix",
          pageKey: "categories",
        },
        {
          href: (tenantSlug) => `/${tenantSlug}/pos/catalog-v2/products`,
          label: "Productos y variantes",
          match: "prefix",
          pageKey: "products",
        },
        {
          href: (tenantSlug) => `/${tenantSlug}/pos/catalog-v2/modifiers`,
          label: "Modificadores y combos",
          match: "prefix",
          pageKey: "products",
        },
      ],
    },
    {
      href: (tenantSlug) => `/${tenantSlug}/pos/reports`,
      label: "Reportes POS avanzado",
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
    {
      href: (tenantSlug) => `/${tenantSlug}/pos/inventory`,
      label: "Inventario POS",
      iconKey: "products",
      match: "prefix",
      moduleKeys: ["sales_pos"],
      pageKey: "products",
    },
  ],
};

const cafeUnknownNavDomain: TenantNavDomainConfig = {
  key: "cafe",
  label: "Cafeteria · POS (Compatibilidad)",
  accentToken: "--nav-accent-cafe",
  moduleKeys: ["sales_pos"],
  items: [
    {
      href: (tenantSlug) => `/${tenantSlug}/pos/devices`,
      label: "Dispositivos",
      iconKey: "devices",
      match: "prefix",
      requiresPlatformOwner: true,
      moduleKeys: ["sales_pos"],
      pageKey: "devices",
    },
    {
      href: (tenantSlug) => `/${tenantSlug}/pos/catalog`,
      label: "Catalogo configurable",
      iconKey: "products",
      match: "prefix",
      moduleKeys: ["sales_pos"],
      pageKey: "products",
    },
    {
      href: (tenantSlug) => `/${tenantSlug}/pos/catalog-v2`,
      label: "Catalogo v2",
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
    {
      href: (tenantSlug) => `/${tenantSlug}/pos/inventory`,
      label: "Inventario POS",
      iconKey: "products",
      match: "prefix",
      moduleKeys: ["sales_pos"],
      pageKey: "products",
    },
  ],
};

const retailNavDomain: TenantNavDomainConfig = {
  key: "retail",
  label: "Retail · POS",
  accentToken: "--nav-accent-commercial",
  moduleKeys: ["retail_pos"],
  items: [
    {
      href: (tenantSlug) => `/${tenantSlug}/retail/reports`,
      label: "Reportes retail",
      iconKey: "reports",
      match: "prefix",
      moduleKeys: ["retail_pos"],
      pageKey: "catalog",
      children: [
        {
          href: (tenantSlug) => `/${tenantSlug}/retail/reports`,
          label: "Resumen",
          match: "exact",
        },
        {
          href: (tenantSlug) => `/${tenantSlug}/retail/reports/sales`,
          label: "Ventas",
          match: "prefix",
        },
        {
          href: (tenantSlug) => `/${tenantSlug}/retail/reports/cash`,
          label: "Caja",
          match: "prefix",
        },
        {
          href: (tenantSlug) => `/${tenantSlug}/retail/reports/products`,
          label: "Productos",
          match: "prefix",
        },
      ],
    },
    {
      href: (tenantSlug) => `/${tenantSlug}/retail/devices`,
      label: "Terminales",
      iconKey: "devices",
      match: "prefix",
      requiresPlatformOwner: true,
      moduleKeys: ["retail_pos"],
      pageKey: "settings",
    },
    {
      href: (tenantSlug) => `/${tenantSlug}/retail/products`,
      label: "Productos",
      iconKey: "products",
      match: "prefix",
      moduleKeys: ["retail_pos"],
      pageKey: "catalog",
    },
  ],
};

const kitchenNavDomain: TenantNavDomainConfig = {
  key: "kitchen",
  label: "Cocina",
  accentToken: "--nav-accent-commercial",
  moduleKeys: ["kitchen_inventory", "kitchen_recipes", "event_catering"],
  items: [
      {
        href: (tenantSlug) => `/${tenantSlug}/kitchen/recipes`,
        label: "Recetas",
        iconKey: "products",
        match: "prefix",
        moduleKeys: ["kitchen_recipes"],
        pageKey: "overview",
      },
      {
        href: (tenantSlug) => `/${tenantSlug}/kitchen/events`,
        label: "Eventos y costeo",
        iconKey: "reports",
        match: "prefix",
        moduleKeys: ["event_catering"],
        pageKey: "overview",
      },
      {
        href: (tenantSlug) => `/${tenantSlug}/kitchen/inventory/price-updates`,
        label: "Actualizar precios",
        iconKey: "catalog",
        match: "prefix",
        moduleKeys: ["kitchen_inventory"],
        pageKey: "items",
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
};

function getCafeNavDomainByPosType(posType: TenantPosType): TenantNavDomainConfig {
  if (posType === "simple") {
    return cafeSimpleNavDomain;
  }

  if (posType === "variants") {
    return cafeVariantsNavDomain;
  }

  return cafeUnknownNavDomain;
}

function getTenantEnabledDomainsModules(enabledModuleKeys: string[]): Set<string> {
  return new Set(enabledModuleKeys);
}

function hasAnyAccessibleModule(
  moduleKeys: string[],
  enabledModules: Set<string>,
  moduleRoleByKey: Record<string, "admin" | "operator" | "viewer" | "none">,
) {
  return moduleKeys.some(
    (moduleKey) => enabledModules.has(moduleKey) && hasTenantModuleRole(moduleRoleByKey[moduleKey]),
  );
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
  moduleRoleByKey: Record<string, "admin" | "operator" | "viewer" | "none">,
  isPlatformOwner: boolean,
  accentToken: string,
  item: TenantNavItemConfig,
): Promise<NavItem | null> {
  if (!hasAnyAccessibleModule(item.moduleKeys, enabledModules, moduleRoleByKey)) {
    return null;
  }

  if (item.requiresPlatformOwner && !isPlatformOwner) {
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
        if (!hasAnyAccessibleModule(childModules, enabledModules, moduleRoleByKey)) return null;
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
    moduleRoleSignature: string,
    posType: TenantPosType,
  ): Promise<NavSection[]> => {
    const enabledModules = getTenantEnabledDomainsModules(
      enabledModuleKeysSignature.split(",").filter(Boolean),
    );
    const moduleRoleByKey = moduleRoleSignature.split(",").reduce<
      Record<string, "admin" | "operator" | "viewer" | "none">
    >((accumulator, entry) => {
      const [moduleKey, moduleRole] = entry.split(":");
      if (moduleKey) {
        accumulator[moduleKey] =
          moduleRole === "admin" || moduleRole === "operator" || moduleRole === "viewer"
            ? moduleRole
            : "none";
      }
      return accumulator;
    }, {});
    const domainsSource = [
      venueNavDomain,
      enabledModules.has("sales_pos") ? getCafeNavDomainByPosType(posType) : null,
      enabledModules.has("retail_pos") ? retailNavDomain : null,
      kitchenNavDomain,
    ].filter((domain): domain is TenantNavDomainConfig => domain !== null);

    const domains = await Promise.all(
      domainsSource
        .filter((domain) => hasAnyAccessibleModule(domain.moduleKeys, enabledModules, moduleRoleByKey))
        .map(async (domain) => {
          const items = (
            await Promise.all(
              domain.items.map((item) =>
                buildItem(
                  tenantSlug,
                  tenantId,
                  role,
                  enabledModules,
                  moduleRoleByKey,
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
    | "tenantId"
    | "tenantSlug"
    | "tenantRole"
    | "enabledModuleKeys"
    | "moduleRoleByKey"
    | "isPlatformOwner"
    | "posType"
  >,
): Promise<NavSection[]> {
  const enabledModuleKeysSignature = [...context.enabledModuleKeys].sort().join(",");
  const moduleRoleSignature = Object.entries(context.moduleRoleByKey)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([moduleKey, moduleRole]) => `${moduleKey}:${moduleRole}`)
    .join(",");
  return getTenantNavCached(
    context.tenantId,
    context.tenantSlug,
    context.tenantRole,
    context.isPlatformOwner,
    enabledModuleKeysSignature,
    moduleRoleSignature,
    context.posType,
  );
}
