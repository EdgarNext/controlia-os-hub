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
  const accessMap = await getCurrentTenantModulePageAccessMap(tenant.tenantId, "sales_pos");

  const links = [
    {
      href: `/${tenant.tenantSlug}/pos/devices`,
      title: "Dispositivos",
      description: "Gestiona kioscos y activación de equipos POS.",
      visible: hasModulePageAccess(accessMap.devices ?? "none", "read"),
    },
    {
      href: `/${tenant.tenantSlug}/pos/catalog`,
      title: "Catálogo POS v2",
      description: "Administra productos, variantes y modifiers canónicos del POS.",
      visible: hasModulePageAccess(accessMap.products ?? "none", "read"),
    },
    {
      href: `/${tenant.tenantSlug}/pos/users`,
      title: "Usuarios POS",
      description: "Crea y sincroniza cajeros y supervisores para login offline.",
      visible: tenant.isPlatformOwner || hasModulePageAccess(accessMap.users ?? "none", "read"),
    },
    {
      href: `/${tenant.tenantSlug}/pos/reports`,
      title: "Reportes",
      description: "Consulta ventas y estado de sincronización POS.",
      visible: hasModulePageAccess(accessMap.reports ?? "none", "read"),
    },
  ].filter((link) => link.visible);

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS"
        description="Operaciones Edge para dispositivos, catálogo y reportes de punto de venta."
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
          message="No tienes ninguna página habilitada dentro del módulo POS para este tenant."
        />
      )}
    </div>
  );
}
