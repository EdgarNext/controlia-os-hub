export type RouteMeta = {
  label: string;
};

const exactRouteMeta: Record<string, RouteMeta> = {
  "/": { label: "Home" },
  "/tenants": { label: "Tenants" },
  "/lab": { label: "Lab" },
  "/no-access": { label: "No Access" },
  "/auth/login": { label: "Login" },
  "/auth/forbidden": { label: "Forbidden" },
};

const reservedRootSegments = new Set(["tenants", "lab", "auth", "no-access"]);

export function getExactRouteMeta(pathname: string) {
  return exactRouteMeta[pathname] ?? null;
}

export function getSegmentLabel(segment: string) {
  if (segment === "tenants") return "Tenants";
  if (segment === "users") return "Users";
  if (segment === "venue") return "Venue";
  if (segment === "rooms") return "Rooms";
  if (segment === "equipment") return "Equipment";
  if (segment === "events") return "Events";
  if (segment === "create") return "Create";
  if (segment === "dashboard") return "Dashboard";
  if (segment === "branding") return "Branding";
  if (segment === "lab") return "Lab";
  if (segment === "reports") return "Reports";
  if (segment === "catalog") return "Catalog";
  if (segment === "pos") return "POS";
  if (segment === "auth") return "Auth";

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) {
    return "Tenant";
  }

  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function getViewTitle(pathname: string) {
  const exact = getExactRouteMeta(pathname);
  if (exact) return exact.label;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Home";
  if (
    segments.length >= 4 &&
    segments[1] === "venue" &&
    segments[2] === "rooms" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segments[3])
  ) {
    return "Room Setup";
  }
  return getSegmentLabel(segments[segments.length - 1]);
}

export function getTenantSlugFromPathname(pathname: string) {
  const [root] = pathname.split("/").filter(Boolean);
  if (!root || reservedRootSegments.has(root)) {
    return null;
  }
  return root;
}
