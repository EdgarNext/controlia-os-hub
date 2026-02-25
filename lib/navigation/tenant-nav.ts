import type { NavSection } from "./platform-nav";

export function getTenantNav(tenantSlug: string): NavSection[] {
  return [
    {
      id: "tenant-workspace",
      label: "Tenant Workspace",
      items: [
        { href: `/${tenantSlug}/dashboard`, label: "Dashboard", iconKey: "reports", match: "prefix" },
        { href: `/${tenantSlug}/venue`, label: "Venue", iconKey: "catalog", match: "prefix" },
        { href: `/${tenantSlug}/events`, label: "Events", iconKey: "reports", match: "prefix" },
        { href: `/${tenantSlug}/users`, label: "Users", iconKey: "users", match: "prefix" },
        { href: `/${tenantSlug}/catalog`, label: "Catalog", iconKey: "catalog", match: "prefix" },
        { href: `/${tenantSlug}/reports`, label: "Reports", iconKey: "reports", match: "prefix" },
        { href: `/${tenantSlug}/pos`, label: "POS", iconKey: "pos", match: "prefix" },
      ],
    },
  ];
}
