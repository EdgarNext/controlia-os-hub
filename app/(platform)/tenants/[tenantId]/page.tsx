import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getTenantModuleLaunchTarget } from "@/lib/navigation/module-launch";
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
      <Card className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Acceso rapido</p>
          <h2 className="text-base font-semibold">Abrir modulos habilitados</h2>
          <p className="text-sm text-muted">
            Entra al modulo del tenant sin escribir rutas manualmente.
          </p>
        </div>

        {modules.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {modules.map((moduleItem) => {
              if (!moduleItem.enabled) {
                return null;
              }

              const launchTarget = getTenantModuleLaunchTarget(moduleItem.module_key);
              if (!launchTarget) {
                return null;
              }

              return (
                <Link
                  key={moduleItem.id}
                  href={launchTarget.href(tenant.slug)}
                  className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                >
                  Abrir {launchTarget.label}
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">No hay modulos habilitados en este tenant.</p>
        )}
      </Card>

      {activeTab === "overview" ? (
        <Card>
          <h2 className="mb-4 text-base font-semibold">Datos generales</h2>
          <TenantOverviewEditor tenant={tenant} />
        </Card>
      ) : (
        <Card className="space-y-4">
          <h2 className="text-base font-semibold">Modulos (solo lectura)</h2>
          <TenantModulesReadOnly modules={modules} tenantSlug={tenant.slug} />
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
