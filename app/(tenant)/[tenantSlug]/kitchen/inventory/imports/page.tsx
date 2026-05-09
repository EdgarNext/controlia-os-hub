import { Suspense } from "react";
import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { listKitchenInventoryImportBatches } from "@/lib/kitchen/inventory/import-queries";
import { KitchenTableSkeleton } from "../../_components/kitchen-loading-skeletons";
import { KitchenPageHeader } from "../../_components/kitchen-page-header";
import { resolveKitchenPage } from "../../_lib/page-access";
import { CreateInventoryImportBatchForm } from "../_components/import-forms";

type KitchenInventoryImportsPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function KitchenInventoryImportsPage({ params }: KitchenInventoryImportsPageProps) {
  const { tenantSlug } = await params;
  const result = await resolveKitchenPage(tenantSlug, "kitchen_inventory", "items");

  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos de importación"
        message="No tienes acceso a importaciones de inventario en este tenant."
      />
    );
  }

  const accessMap = await getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "kitchen_inventory");
  const canManage = hasModulePageAccess(accessMap.items ?? "none", "manage");
  const batchesPromise = listKitchenInventoryImportBatches(result.tenant.tenantId);

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Inventario"
        title="Importaciones de inventario"
        description="Flujo controlado: parsear Excel a staging, validar filas y aplicar con idempotencia."
      />

      {canManage ? <CreateInventoryImportBatchForm tenantSlug={result.tenant.tenantSlug} /> : null}

      <Suspense fallback={<KitchenTableSkeleton rows={8} columns={8} />}>
        <InventoryBatchesSection tenantSlug={tenantSlug} batchesPromise={batchesPromise} />
      </Suspense>
    </div>
  );
}

async function InventoryBatchesSection({
  tenantSlug,
  batchesPromise,
}: {
  tenantSlug: string;
  batchesPromise: ReturnType<typeof listKitchenInventoryImportBatches>;
}) {
  const batches = await batchesPromise;
  if (batches.length === 0) {
    return (
      <StatePanel
        kind="empty"
        title="Sin lotes de importación"
        message="Crea el primer batch para revisar el inventario antes de aplicarlo."
      />
    );
  }

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="py-2">Fecha</th>
              <th className="py-2">Archivo</th>
              <th className="py-2">Estado</th>
              <th className="py-2 text-right">Rows</th>
              <th className="py-2 text-right">Valid</th>
              <th className="py-2 text-right">Warning</th>
              <th className="py-2 text-right">Error</th>
              <th className="py-2 text-right">Applied</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr key={batch.id} className="border-t border-border">
                <td className="py-2 text-muted">{new Date(batch.created_at).toLocaleString("es-MX")}</td>
                <td className="py-2">
                  <Link
                    href={`/${tenantSlug}/kitchen/inventory/imports/${batch.id}`}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {batch.original_filename}
                  </Link>
                </td>
                <td className="py-2 text-foreground">{batch.status}</td>
                <td className="py-2 text-right text-foreground">{batch.total_rows}</td>
                <td className="py-2 text-right text-foreground">{batch.valid_rows}</td>
                <td className="py-2 text-right text-foreground">{batch.warning_rows}</td>
                <td className="py-2 text-right text-foreground">{batch.error_rows}</td>
                <td className="py-2 text-right text-foreground">{batch.applied_rows}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
