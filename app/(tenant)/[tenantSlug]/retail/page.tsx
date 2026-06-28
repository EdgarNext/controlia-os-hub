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
          Tenant: {tenant.tenantName}. La integración tenant-facing de retail en el hub queda preparada desde esta
          fase con navegación y guard dedicados.
        </p>
      </header>

      <StatePanel
        kind="empty"
        title="Backoffice retail preparado"
        message="La experiencia completa de retail dentro del hub requiere una fase dedicada. Esta ruta evita mezclar retail con navegación de cafetería."
      />
    </div>
  );
}
