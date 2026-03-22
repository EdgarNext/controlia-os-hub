import { getTenantSlugFromPathname } from "./route-meta";

export type TenantDomainMeta = {
  key: "venue" | "commercial" | "cafe" | "admin";
  label: string;
  accentToken: string;
};

const tenantDomainMap: Record<TenantDomainMeta["key"], Omit<TenantDomainMeta, "key">> = {
  venue: { label: "Venue Operations", accentToken: "--nav-accent-venue" },
  commercial: { label: "Comercial", accentToken: "--nav-accent-commercial" },
  cafe: { label: "Cafeteria", accentToken: "--nav-accent-cafe" },
  admin: { label: "Admin", accentToken: "--nav-accent-admin" },
};

export function getTenantDomainMetaByPathname(pathname: string): TenantDomainMeta | null {
  const tenantSlug = getTenantSlugFromPathname(pathname);
  if (!tenantSlug) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  const rootSegment = segments[1];
  const domainKey: TenantDomainMeta["key"] | null =
    rootSegment === "dashboard" || rootSegment === "venue" || rootSegment === "events"
      ? "venue"
      : rootSegment === "catalog" || rootSegment === "reports"
        ? "commercial"
        : rootSegment === "pos"
          ? "cafe"
          : rootSegment === "users"
            ? "admin"
            : null;

  if (!domainKey) {
    return null;
  }

  return {
    key: domainKey,
    ...tenantDomainMap[domainKey],
  };
}
