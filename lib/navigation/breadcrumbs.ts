import { getExactRouteMeta, getSegmentLabel } from "./route-meta";

export type Crumb = {
  href: string;
  label: string;
};

export function buildBreadcrumbs(pathname: string, tenantName?: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [{ href: "/", label: "Home" }];
  }

  const crumbs: Crumb[] = [];
  let current = "";

  for (const [index, segment] of segments.entries()) {
    current += `/${segment}`;
    const exact = getExactRouteMeta(current);
    if (index === 0 && tenantName) {
      crumbs.push({ href: current, label: tenantName });
      continue;
    }

    const tenantRelativePath = segments.slice(1, index + 1).join("/");
    const tenantRouteLabels: Record<string, string> = {
      kitchen: "Cocina",
      "kitchen/catalog": "Catálogo de insumos",
      "kitchen/catalog/providers": "Proveedores",
      "kitchen/recipes": "Recetas y costeo",
      "kitchen/recipes/costing": "Tablero de costeo",
      "kitchen/recipes/imports": "Importaciones de recetario",
      "kitchen/events": "Eventos y costeo",
      "kitchen/inventory/price-updates": "Actualizar precios por factura",
      "kitchen/reports": "Dashboard gerencial de catering",
    };
    crumbs.push({ href: current, label: exact?.label ?? tenantRouteLabels[tenantRelativePath] ?? getSegmentLabel(segment) });
  }

  return crumbs;
}
