import Link from "next/link";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { StatePanel } from "@/components/ui/state-panel";
import {
  getCurrentTenantModulePageAccessMap,
  hasModulePageAccess,
} from "@/lib/auth/module-page-access";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";

type PosPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function PosPage({ params }: PosPageProps) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantContextBySlug(tenantSlug);
  const accessMap =
    tenant.enabledModuleKeys.includes("sales_pos")
      ? await getCurrentTenantModulePageAccessMap(tenant.tenantId, "sales_pos")
      : {};

  const links =
    tenant.posType === "simple"
      ? [
          {
            href: `/${tenant.tenantSlug}/pos/catalog/categories`,
            title: "Categorías",
            description: "Administra la taxonomía base compartida del catálogo de cafetería.",
            visible: hasModulePageAccess(accessMap.categories ?? "none", "read"),
          },
          {
            href: `/${tenant.tenantSlug}/pos/catalog/products`,
            title: "Productos simples",
            description: "Gestiona el catálogo clásico basado en catalog_items.",
            visible: hasModulePageAccess(accessMap.products ?? "none", "read"),
          },
        ].filter((link) => link.visible)
      : tenant.posType === "variants"
        ? [
            {
              href: `/${tenant.tenantSlug}/pos/catalog`,
              title: "Catálogo configurable",
              description: "Administra productos, variantes, modificadores y combos.",
              visible: hasModulePageAccess(accessMap.products ?? "none", "read"),
            },
            {
              href: `/${tenant.tenantSlug}/pos/reports`,
              title: "Reportes POS avanzado",
              description: "Consulta ventas y desempeño sobre sales_accounts.",
              visible: hasModulePageAccess(accessMap.reports ?? "none", "read"),
            },
            {
              href: `/${tenant.tenantSlug}/pos/inventory`,
              title: "Inventario POS",
              description: "Configura bindings POS→receta y simulación de consumo.",
              visible: hasModulePageAccess(accessMap.products ?? "none", "read"),
            },
          ].filter((link) => link.visible)
        : tenant.posType === "retail"
          ? [
              {
                href: `/${tenant.tenantSlug}/retail`,
                title: "Backoffice retail",
                description: "Punto de entrada del tenant retail dentro del hub.",
                visible: true,
              },
            ]
          : [
              {
                href: `/${tenant.tenantSlug}/pos/catalog`,
                title: "Catálogo configurable",
                description: "Compatibilidad temporal para tenants sin pos_type configurado.",
                visible: hasModulePageAccess(accessMap.products ?? "none", "read"),
              },
              {
                href: `/${tenant.tenantSlug}/pos/reports`,
                title: "Reportes POS",
                description: "Compatibilidad temporal para tenants sin pos_type configurado.",
                visible: hasModulePageAccess(accessMap.reports ?? "none", "read"),
              },
            ].filter((link) => link.visible);

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS"
        description="Punto de entrada del POS según el tipo activo configurado para este tenant."
      />

      {links.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-[var(--radius-base)] border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
            >
              <p className="text-sm font-semibold text-foreground">{link.title}</p>
              <p className="mt-2 text-sm text-muted">{link.description}</p>
            </Link>
          ))}
        </div>
      ) : (
        <StatePanel
          kind="permission"
          title="Sin acceso a POS"
          message="No tienes ninguna página habilitada dentro de la experiencia POS resuelta para este tenant."
        />
      )}
    </div>
  );
}
