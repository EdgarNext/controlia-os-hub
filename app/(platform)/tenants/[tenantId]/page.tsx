import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getTenantById, listTenantModules } from "@/lib/repos/tenantsRepo";
import { getTenantBranding } from "@/lib/repos/brandingRepo";
import { TenantModulesReadOnly } from "../components/TenantModulesReadOnly";
import { TenantOverviewEditor } from "../components/TenantOverviewEditor";

type TenantDetailPageProps = {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function TenantDetailPage({ params, searchParams }: TenantDetailPageProps) {
  const { tenantId } = await params;
  const { tab } = await searchParams;

  const [tenant, modules, branding] = await Promise.all([
    getTenantById(tenantId),
    listTenantModules(tenantId),
    getTenantBranding(tenantId),
  ]);

  if (!tenant) {
    notFound();
  }

  const activeTab = tab === "modules" ? "modules" : "overview";

  return (
    <div className="space-y-4">
      {activeTab === "overview" ? (
        <Card>
          <h2 className="mb-4 text-base font-semibold">Datos generales</h2>
          <TenantOverviewEditor tenant={tenant} />
        </Card>
      ) : (
        <Card className="space-y-4">
          <h2 className="text-base font-semibold">Modulos (solo lectura)</h2>
          <TenantModulesReadOnly modules={modules} />
        </Card>
      )}

      <Card>
        <h2 className="mb-2 text-base font-semibold">Snapshot de branding</h2>
        <p className="text-sm text-muted">
          Nombre visible: {branding?.display_name ?? "sin configurar"} | Logo: {branding?.logo_url ?? "sin URL"}
        </p>
      </Card>
    </div>
  );
}
