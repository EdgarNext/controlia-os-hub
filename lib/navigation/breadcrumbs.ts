import { getExactRouteMeta, getSegmentLabel } from "./route-meta";

export type Crumb = {
  href: string;
  label: string;
};

export function buildBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [{ href: "/", label: "Home" }];
  }

  const crumbs: Crumb[] = [];
  let current = "";

  for (const segment of segments) {
    current += `/${segment}`;
    const exact = getExactRouteMeta(current);
    crumbs.push({ href: current, label: exact?.label ?? getSegmentLabel(segment) });
  }

  return crumbs;
}
