import { RefreshCw } from "lucide-react";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import {
  cancelPurchaseReceiptAction,
  markPurchaseReceiptReceivedAction,
  updatePurchaseReceiptLinesBulkAction,
} from "@/lib/kitchen/event-catering/actions";
import { getCateringRequisition, getPurchaseReceipt, listPurchaseReceiptLines } from "@/lib/kitchen/event-catering/queries";
import { listKitchenInventoryLocations } from "@/lib/kitchen/inventory/queries";
import { KitchenCriticalActionGroup } from "../../../../../_components/kitchen-critical-action-group";
import { KitchenFormPendingFieldset } from "../../../../../_components/kitchen-form-pending-fieldset";
import { KitchenSubmitButton } from "../../../../../_components/kitchen-submit-button";
import { resolveKitchenPage } from "../../../../../_lib/page-access";

type KitchenCateringReceiptDetailPageProps = {
  params: Promise<{ tenantSlug: string; requisitionId: string; receiptId: string }>;
};

function resolveReceiptRequisitionLineTotal(line: NonNullable<Awaited<ReturnType<typeof listPurchaseReceiptLines>>[number]["event_catering_requisition_lines"]>) {
  const approvedTotal = Number(line.approved_total_cost ?? 0);
  if (approvedTotal > 0) return approvedTotal;
  const quotedTotal = Number(line.quoted_total_cost ?? 0);
  if (quotedTotal > 0) return quotedTotal;
  const preliminaryTotal = Number(line.preliminary_total_cost ?? 0);
  if (preliminaryTotal > 0) return preliminaryTotal;
  const estimatedTotal = Number(line.estimated_total_cost ?? 0);
  if (estimatedTotal > 0) return estimatedTotal;
  const unitPrice = Number(line.approved_unit_price ?? line.quoted_unit_price ?? line.preliminary_unit_price ?? line.estimated_unit_cost ?? 0);
  const purchaseQuantity = Number(line.requested_purchase_quantity ?? 0);
  return purchaseQuantity > 0 ? purchaseQuantity * unitPrice : 0;
}

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

  const [receipt, requisition, accessMap] = await Promise.all([
    getPurchaseReceipt(result.tenant.tenantSlug, receiptId),
    getCateringRequisition(result.tenant.tenantSlug, requisitionId),
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "event_catering"),
  ]);

  if (!receipt || receipt.requisition_id !== requisitionId || !requisition) {
    return <StatePanel kind="empty" title="Recepción no encontrada" message="La recepción no existe en esta requisición." />;
  }

  const canManage = hasModulePageAccess(accessMap.requisitions ?? "none", "manage");
  const isDraft = receipt.status === "draft";
  const isCanceled = receipt.status === "canceled";
  const isReceived = receipt.status === "received";
  const statusLabel = isDraft ? "Borrador" : isReceived ? "Recibida" : isCanceled ? "Cancelada" : receipt.status;
  const planName = requisition.event_catering_plans?.name?.trim();
  const eventName = requisition.event_catering_plans?.events?.name?.trim();
  const receiptTitle = `Recepción de ${planName || "Plan"} - ${eventName || "Evento"}`;
  const lines = await listPurchaseReceiptLines(result.tenant.tenantSlug, receiptId);
  const hasLines = lines.length > 0;
  const locationsPromise = listKitchenInventoryLocations(result.tenant.tenantId);
  const receiptLinesTotal = lines.reduce((acc, line) => acc + Number(line.received_total_cost ?? 0), 0);
  const requisitionApprovedTotal = lines.reduce((acc, line) => {
    const requisitionLine = line.event_catering_requisition_lines;
    if (!requisitionLine) return acc;
    return acc + resolveReceiptRequisitionLineTotal(requisitionLine);
  }, 0);
  const totalVariation = receiptLinesTotal - requisitionApprovedTotal;

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">{receiptTitle}</h1>
        <p className="mt-1 text-xs text-muted">Referencia: {receipt.id.slice(0, 8)}</p>
        <p className="mt-2 text-sm text-muted">
          Estado: {statusLabel} · total=${Number(receipt.total_received_cost ?? 0).toLocaleString("es-MX", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        <div className="mt-3 grid gap-2 text-xs text-muted md:grid-cols-4">
          <div className="rounded border border-primary/20 bg-primary/10 p-2">
            <p>Total cotizado/aprobado</p>
            <p className="mt-1 font-semibold text-foreground">
              ${requisitionApprovedTotal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded border border-primary/20 bg-primary/10 p-2">
            <p>Total esperado recepción</p>
            <p className="mt-1 font-semibold text-foreground">
              ${receiptLinesTotal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded border border-primary/20 bg-primary/10 p-2">
            <p>{isDraft ? "Valor capturado en borrador" : "Total recibido actual"}</p>
            <p className="mt-1 font-semibold text-foreground">
              ${Number(receipt.total_received_cost ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded border border-primary/20 bg-primary/10 p-2">
            <p>Variación</p>
            <p className={totalVariation === 0 ? "mt-1 font-semibold text-foreground" : "mt-1 font-semibold text-warning"}>
              ${totalVariation.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        {isCanceled ? (
          <p className="mt-3 rounded border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-muted">
            Esta recepción fue cancelada. No actualizó inventario ni debe sumar como recibido.
          </p>
        ) : (
          <p className="mt-3 text-xs text-warning">
            Los precios vienen de la requisición. Recepción valida cantidades y ubicación; no modifica la compra autorizada. Al confirmar recepción se actualiza inventario con movimientos tipo purchase.
          </p>
        )}
        {isDraft && !hasLines ? (
          <p className="mt-3 rounded border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            Recepción inválida sin líneas. Solo puede cancelarse; no se permite marcarla como recibida.
          </p>
        ) : null}
        {canManage && isDraft ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <KitchenCriticalActionGroup
              className="flex flex-wrap items-center gap-2"
              buttonClassName="px-3 py-1 text-xs"
              actions={[
                ...(hasLines
                  ? [{
                      id: "mark-received",
                      action: markPurchaseReceiptReceivedAction,
                      fields: [
                        { name: "tenantSlug", value: tenantSlug },
                        { name: "receiptId", value: receipt.id },
                      ],
                      label: "Marcar como recibida",
                      pendingLabel: "Marcando recepción...",
                    }]
                  : []),
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

      <ReceiptLinesSection
        tenantSlug={tenantSlug}
        receiptId={receipt.id}
        canManage={canManage}
        isDraft={isDraft}
        lines={lines}
        locationsPromise={locationsPromise}
      />
    </div>
  );
}

async function ReceiptLinesSection({
  tenantSlug,
  receiptId,
  canManage,
  isDraft,
  lines,
  locationsPromise,
}: {
  tenantSlug: string;
  receiptId: string;
  canManage: boolean;
  isDraft: boolean;
  lines: Awaited<ReturnType<typeof listPurchaseReceiptLines>>;
  locationsPromise: ReturnType<typeof listKitchenInventoryLocations>;
}) {
  const locations = await locationsPromise;
  const receiptLinesTotal = lines.reduce((acc, line) => acc + Number(line.received_total_cost ?? 0), 0);

  if (lines.length === 0) {
    return <StatePanel kind="empty" title="Sin líneas" message="Esta recepción no tiene líneas para recibir." />;
  }

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Líneas de recepción</h2>
        {canManage && isDraft ? (
          <form id="bulk-receipt-lines-form" action={updatePurchaseReceiptLinesBulkAction}>
            <input type="hidden" name="tenantSlug" value={tenantSlug} />
            <input type="hidden" name="receiptId" value={receiptId} />
            <KitchenSubmitButton pendingLabel="Actualizando..." className="px-2 py-1 text-xs" title="Actualizar todas las líneas">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </KitchenSubmitButton>
          </form>
        ) : null}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="px-2 py-1">Insumo</th>
              <th className="px-2 py-1">Cotizado/aprobado</th>
              <th className="px-2 py-1">Unidad</th>
              <th className="px-2 py-1">Costo unitario inventario</th>
              <th className="px-2 py-1">Total recibido valuado</th>
              <th className="px-2 py-1">Acción</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const requisitionLine = line.event_catering_requisition_lines;
              const purchaseUnitCode = requisitionLine?.purchase_units?.code ?? "ud compra";
              const quotedUnitPrice = Number(
                requisitionLine?.approved_unit_price ??
                  requisitionLine?.quoted_unit_price ??
                  requisitionLine?.preliminary_unit_price ??
                  requisitionLine?.estimated_unit_cost ??
                  0,
              );
              const quotedQuantity = Number(requisitionLine?.requested_purchase_quantity ?? requisitionLine?.requested_quantity ?? 0);
              const quotedTotal = requisitionLine ? resolveReceiptRequisitionLineTotal(requisitionLine) : 0;
              const defaultPurchaseQuantity = Number(
                line.received_purchase_quantity ?? requisitionLine?.requested_purchase_quantity ?? 0,
              );
              const defaultLocationId =
                locations.find((location) => /almacen/i.test(location.name))?.id ??
                line.location_id ??
                locations[0]?.id ??
                "";
              return (
                <tr key={line.id} className="border-t border-border">
                  <td className="px-2 py-1 text-foreground">{line.kitchen_inventory_items?.name ?? line.item_id.slice(0, 8)}</td>
                  <td className="px-2 py-1 text-muted">
                    <div className="space-y-1">
                      <p>
                        ${quotedUnitPrice.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} / {purchaseUnitCode}
                      </p>
                      <p className="text-[11px]">
                        {quotedQuantity.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {purchaseUnitCode}
                        {" = $"}
                        {quotedTotal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </td>
                  <td className="px-2 py-1 text-muted">{purchaseUnitCode}</td>
                  <td className="px-2 py-1 text-foreground">
                    ${Number(line.received_unit_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    <span className="ml-1 text-muted">/ {line.kitchen_inventory_units?.code ?? "ud"}</span>
                  </td>
                  <td className="px-2 py-1 text-foreground">
                    ${Number(line.received_total_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-1">
                    {canManage && isDraft ? (
                        <KitchenFormPendingFieldset className="flex flex-nowrap items-center gap-2">
                          <input
                            name={`receivedPurchaseQuantity:${line.id}`}
                            form="bulk-receipt-lines-form"
                            type="number"
                            min="1"
                            step="1"
                            defaultValue={String(defaultPurchaseQuantity > 0 ? defaultPurchaseQuantity : 1)}
                            className="h-8 w-20 rounded border border-border bg-surface px-2 text-xs"
                            aria-label={`Cantidad en ${purchaseUnitCode}`}
                          />
                          <span className="text-xs text-muted">{purchaseUnitCode}</span>
                          <select
                            name={`locationId:${line.id}`}
                            form="bulk-receipt-lines-form"
                            defaultValue={defaultLocationId}
                            className="h-8 w-36 rounded border border-border bg-surface px-2 text-xs"
                          >
                            {locations.map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.name}
                              </option>
                            ))}
                          </select>
                        </KitchenFormPendingFieldset>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-primary/20 bg-primary/10 font-semibold text-foreground">
              <td className="px-2 py-1" colSpan={4}>Total recepción</td>
              <td className="px-2 py-1">
                ${receiptLinesTotal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-2 py-1">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
