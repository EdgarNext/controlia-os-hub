import { notFound } from "next/navigation";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import {
  getKitchenInventoryImportBatch,
  listKitchenInventoryImportRows,
} from "@/lib/kitchen/inventory/import-queries";
import { resolveKitchenPage } from "../../../_lib/page-access";
import { ApplyInventoryImportBatchForm, ValidateInventoryImportBatchForm } from "../../_components/import-forms";

type KitchenInventoryImportBatchPageProps = {
  params: Promise<{ tenantSlug: string; batchId: string }>;
};

export default async function KitchenInventoryImportBatchPage({ params }: KitchenInventoryImportBatchPageProps) {
  const { tenantSlug, batchId } = await params;
  const result = await resolveKitchenPage(tenantSlug, "kitchen_inventory", "items");

  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos"
        message="No tienes acceso a este lote de importación."
      />
    );
  }

  const [batch, rows, accessMap] = await Promise.all([
    getKitchenInventoryImportBatch(result.tenant.tenantId, batchId),
    listKitchenInventoryImportRows(result.tenant.tenantId, batchId),
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "kitchen_inventory"),
  ]);

  if (!batch) {
    notFound();
  }

  const canManage = hasModulePageAccess(accessMap.items ?? "none", "manage");

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">Batch: {batch.original_filename}</h1>
        <p className="mt-2 text-sm text-muted">
          Estado {batch.status}. total={batch.total_rows}, valid={batch.valid_rows}, warning={batch.warning_rows}, error={batch.error_rows}, applied={batch.applied_rows}.
        </p>
      </section>

      {canManage ? (
        <div className="grid gap-3 md:grid-cols-2">
          <ValidateInventoryImportBatchForm tenantSlug={tenantSlug} batchId={batch.id} />
          <ApplyInventoryImportBatchForm tenantSlug={tenantSlug} batchId={batch.id} />
        </div>
      ) : null}

      {rows.length === 0 ? (
        <StatePanel kind="empty" title="Sin filas staging" message="Este batch todavía no tiene filas parseadas." />
      ) : (
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="py-2">Row</th>
                  <th className="py-2">Insumo</th>
                  <th className="py-2">Unidad</th>
                  <th className="py-2">Ubicación</th>
                  <th className="py-2 text-right">Existencia</th>
                  <th className="py-2 text-right">Costo</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Warnings</th>
                  <th className="py-2">Errores</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="py-2 text-muted">{row.row_number}</td>
                    <td className="py-2 text-foreground">{row.item_name ?? "—"}</td>
                    <td className="py-2 text-foreground">{row.unit_code ?? "—"}</td>
                    <td className="py-2 text-foreground">{row.location_name ?? "—"}</td>
                    <td className="py-2 text-right text-foreground">{row.quantity ?? "—"}</td>
                    <td className="py-2 text-right text-foreground">{row.unit_cost ?? "—"}</td>
                    <td className="py-2 text-foreground">{row.status}</td>
                    <td className="py-2 text-warning">{row.validation_warnings?.join("; ") || "—"}</td>
                    <td className="py-2 text-danger">{row.validation_errors?.join("; ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
