import { Suspense } from "react";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import {
  cancelPurchaseReceiptAction,
  markPurchaseReceiptReceivedAction,
  updatePurchaseReceiptLineAction,
} from "@/lib/kitchen/event-catering/actions";
import { getPurchaseReceipt, listPurchaseReceiptLines } from "@/lib/kitchen/event-catering/queries";
import { listKitchenInventoryLocations } from "@/lib/kitchen/inventory/queries";
import { KitchenActionRowSkeleton, KitchenTableSkeleton } from "../../../../../_components/kitchen-loading-skeletons";
import { KitchenCriticalActionGroup } from "../../../../../_components/kitchen-critical-action-group";
import { KitchenFormPendingFieldset } from "../../../../../_components/kitchen-form-pending-fieldset";
import { KitchenSubmitButton } from "../../../../../_components/kitchen-submit-button";
import { resolveKitchenPage } from "../../../../../_lib/page-access";

type KitchenCateringReceiptDetailPageProps = {
  params: Promise<{ tenantSlug: string; requisitionId: string; receiptId: string }>;
};

export default async function KitchenCateringReceiptDetailPage({
  params,
}: KitchenCateringReceiptDetailPageProps) {
  const { tenantSlug, requisitionId, receiptId } = await params;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "requisitions");
  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para recepción"
        message="No tienes acceso al detalle de recepción de compras."
      />
    );
  }

  const [receipt, accessMap] = await Promise.all([
    getPurchaseReceipt(result.tenant.tenantSlug, receiptId),
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "event_catering"),
  ]);

  if (!receipt || receipt.requisition_id !== requisitionId) {
    return <StatePanel kind="empty" title="Recepción no encontrada" message="La recepción no existe en esta requisición." />;
  }

  const canManage = hasModulePageAccess(accessMap.requisitions ?? "none", "manage");
  const isDraft = receipt.status === "draft";
  const linesPromise = listPurchaseReceiptLines(result.tenant.tenantSlug, receiptId);
  const locationsPromise = listKitchenInventoryLocations(result.tenant.tenantId);

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">Recepción {receipt.id.slice(0, 8)}</h1>
        <p className="mt-2 text-sm text-muted">
          status={receipt.status} · total=${Number(receipt.total_received_cost ?? 0).toLocaleString("es-MX", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        <p className="mt-1 text-xs text-warning">Al confirmar recepción se actualiza inventario con movimientos tipo purchase.</p>
        {canManage && isDraft ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <KitchenCriticalActionGroup
              className="flex flex-wrap items-center gap-2"
              buttonClassName="px-3 py-1 text-xs"
              actions={[
                {
                  id: "mark-received",
                  action: markPurchaseReceiptReceivedAction,
                  fields: [
                    { name: "tenantSlug", value: tenantSlug },
                    { name: "receiptId", value: receipt.id },
                  ],
                  label: "Marcar como recibida",
                  pendingLabel: "Marcando recepción...",
                },
                {
                  id: "cancel-receipt",
                  action: cancelPurchaseReceiptAction,
                  fields: [
                    { name: "tenantSlug", value: tenantSlug },
                    { name: "receiptId", value: receipt.id },
                  ],
                  label: "Cancelar recepción",
                  pendingLabel: "Cancelando...",
                },
              ]}
            />
          </div>
        ) : null}
      </section>

      <Suspense fallback={<ReceiptLinesFallback />}>
        <ReceiptLinesSection
          tenantSlug={tenantSlug}
          receiptId={receipt.id}
          canManage={canManage}
          isDraft={isDraft}
          linesPromise={linesPromise}
          locationsPromise={locationsPromise}
        />
      </Suspense>
    </div>
  );
}

async function ReceiptLinesSection({
  tenantSlug,
  receiptId,
  canManage,
  isDraft,
  linesPromise,
  locationsPromise,
}: {
  tenantSlug: string;
  receiptId: string;
  canManage: boolean;
  isDraft: boolean;
  linesPromise: ReturnType<typeof listPurchaseReceiptLines>;
  locationsPromise: ReturnType<typeof listKitchenInventoryLocations>;
}) {
  const [lines, locations] = await Promise.all([linesPromise, locationsPromise]);

  if (lines.length === 0) {
    return <StatePanel kind="empty" title="Sin líneas" message="Esta recepción no tiene líneas para recibir." />;
  }

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">Líneas de recepción</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="px-2 py-1">Insumo</th>
              <th className="px-2 py-1">Cantidad recibida</th>
              <th className="px-2 py-1">Unidad</th>
              <th className="px-2 py-1">Ubicación inventario</th>
              <th className="px-2 py-1">Costo unitario</th>
              <th className="px-2 py-1">Total</th>
              <th className="px-2 py-1">Movimiento</th>
              <th className="px-2 py-1">Acción</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-t border-border">
                <td className="px-2 py-1 text-foreground">{line.kitchen_inventory_items?.name ?? line.item_id.slice(0, 8)}</td>
                <td className="px-2 py-1 text-foreground">
                  {Number(line.received_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </td>
                <td className="px-2 py-1 text-muted">{line.kitchen_inventory_units?.code ?? "ud"}</td>
                <td className="px-2 py-1 text-muted">{line.kitchen_inventory_locations?.name ?? "—"}</td>
                <td className="px-2 py-1 text-foreground">
                  ${Number(line.received_unit_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </td>
                <td className="px-2 py-1 text-foreground">
                  ${Number(line.received_total_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-2 py-1 text-muted">{line.inventory_movement_id ? line.inventory_movement_id.slice(0, 8) : "—"}</td>
                <td className="px-2 py-1">
                  {canManage && isDraft ? (
                    <form action={updatePurchaseReceiptLineAction} className="flex flex-wrap items-center gap-1">
                      <input type="hidden" name="tenantSlug" value={tenantSlug} />
                      <input type="hidden" name="receiptId" value={receiptId} />
                      <input type="hidden" name="lineId" value={line.id} />
                      <KitchenFormPendingFieldset className="flex flex-wrap items-center gap-1">
                        <input
                          name="receivedQuantity"
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          defaultValue={String(line.received_quantity)}
                          className="h-8 w-24 rounded border border-border bg-surface px-2 text-xs"
                        />
                        <input
                          name="receivedUnitCost"
                          type="number"
                          min="0"
                          step="0.0001"
                          defaultValue={String(line.received_unit_cost)}
                          className="h-8 w-24 rounded border border-border bg-surface px-2 text-xs"
                        />
                        <select
                          name="locationId"
                          defaultValue={line.location_id}
                          className="h-8 rounded border border-border bg-surface px-2 text-xs"
                        >
                          {locations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                            </option>
                          ))}
                        </select>
                        <KitchenSubmitButton pendingLabel="Guardando..." className="px-2 py-1 text-xs">
                          Guardar
                        </KitchenSubmitButton>
                      </KitchenFormPendingFieldset>
                    </form>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReceiptLinesFallback() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenActionRowSkeleton actions={2} />
      <KitchenTableSkeleton rows={8} columns={8} />
    </div>
  );
}
