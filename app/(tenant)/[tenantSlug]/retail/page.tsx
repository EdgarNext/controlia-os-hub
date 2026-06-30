import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";

type RetailPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function RetailTenantPage({ params }: RetailPageProps) {
  const { tenantSlug } = await params;
  const tenant = await resolveRetailPosTypePageContext(tenantSlug, "catalog", "read");

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Retail POS</h1>
        <p className="text-sm text-muted">
          Tenant: {tenant.tenantName}. Este tenant usa el dominio retail POS dedicado dentro del hub.
        </p>
      </header>

      <Card className="space-y-3 border-border/80 bg-surface">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Backoffice retail</p>
          <h2 className="text-lg font-semibold text-foreground">Entrada correcta para el catálogo retail</h2>
          <p className="max-w-2xl text-sm text-muted">
            El catálogo operativo de este tenant vive en `retail_pos` y no comparte rutas ni tablas con `sales_pos`.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${tenant.tenantSlug}/retail/products`}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Abrir productos retail
          </Link>
        </div>
      </Card>

      <StatePanel
        kind="empty"
        title="Backoffice retail activo"
        message="La edición y alta de productos se implementará en la siguiente fase. Esta iteración deja lista la navegación y el acceso inicial."
      />
    </div>
  );
}
