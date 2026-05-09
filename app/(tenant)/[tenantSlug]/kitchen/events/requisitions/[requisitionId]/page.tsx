import { Suspense } from "react";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import {
  approveCateringRequisitionAction,
  createPurchaseReceiptFromRequisitionAction,
  cancelCateringRequisitionAction,
  markCateringRequisitionReviewedAction,
  updateRequisitionLinePurchaseOptionAction,
  updateCateringRequisitionLineAction,
  updateCateringRequisitionLineSupplierAction,
  updateCateringRequisitionLineQuoteAction,
} from "@/lib/kitchen/event-catering/actions";
import {
  getCateringRequisition,
  getCateringRequisitionSupplierSummary,
  listPurchaseOptionsForRequisitionLine,
  listPurchaseReceiptsForRequisition,
  listCateringRequisitionLines,
} from "@/lib/kitchen/event-catering/queries";
import { listKitchenInventorySuppliers } from "@/lib/kitchen/inventory/queries";
import { KitchenActionRowSkeleton, KitchenTableSkeleton } from "../../../_components/kitchen-loading-skeletons";
import { KitchenCriticalActionGroup } from "../../../_components/kitchen-critical-action-group";
import { KitchenFormPendingFieldset } from "../../../_components/kitchen-form-pending-fieldset";
import { KitchenSubmitButton } from "../../../_components/kitchen-submit-button";
import { resolveKitchenPage } from "../../../_lib/page-access";

type KitchenCateringRequisitionDetailPageProps = {
  params: Promise<{ tenantSlug: string; requisitionId: string }>;
};

export default async function KitchenCateringRequisitionDetailPage({
  params,
}: KitchenCateringRequisitionDetailPageProps) {
  const { tenantSlug, requisitionId } = await params;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "requisitions");
  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para requisición"
        message="No tienes acceso al detalle de requisiciones de catering."
      />
    );
  }

  const [requisition, accessMap] = await Promise.all([
    getCateringRequisition(result.tenant.tenantSlug, requisitionId),
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "event_catering"),
  ]);

  if (!requisition) {
    return <StatePanel kind="empty" title="Requisición no encontrada" message="La requisición no existe en este tenant." />;
  }

  const canManage = hasModulePageAccess(accessMap.requisitions ?? "none", "manage");
  const linesPromise = listCateringRequisitionLines(result.tenant.tenantSlug, requisitionId);
  const supplierSummaryPromise = getCateringRequisitionSupplierSummary(result.tenant.tenantSlug, requisitionId);
  const suppliersPromise = listKitchenInventorySuppliers(result.tenant.tenantId);
  const receiptsPromise = listPurchaseReceiptsForRequisition(result.tenant.tenantSlug, requisitionId);

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">Requisición {requisition.id.slice(0, 8)}</h1>
        <p className="mt-2 text-sm text-muted">
          status={requisition.status} · costo=${Number(requisition.estimated_total_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="mt-1 text-xs text-muted">
          Esta requisición es una sugerencia de compra. Aprobar no descuenta inventario ni crea compra real todavía.
        </p>
      </section>

      <Suspense fallback={<RequisitionContentFallback />}>
        <RequisitionContentSection
          tenantSlug={tenantSlug}
          requisition={requisition}
          canManage={canManage}
          linesPromise={linesPromise}
          supplierSummaryPromise={supplierSummaryPromise}
          suppliersPromise={suppliersPromise}
          receiptsPromise={receiptsPromise}
        />
      </Suspense>
    </div>
  );
}

async function RequisitionContentSection({
  tenantSlug,
  requisition,
  canManage,
  linesPromise,
  supplierSummaryPromise,
  suppliersPromise,
  receiptsPromise,
}: {
  tenantSlug: string;
  requisition: NonNullable<Awaited<ReturnType<typeof getCateringRequisition>>>;
  canManage: boolean;
  linesPromise: ReturnType<typeof listCateringRequisitionLines>;
  supplierSummaryPromise: ReturnType<typeof getCateringRequisitionSupplierSummary>;
  suppliersPromise: ReturnType<typeof listKitchenInventorySuppliers>;
  receiptsPromise: ReturnType<typeof listPurchaseReceiptsForRequisition>;
}) {
  const [lines, supplierSummary, suppliers, receipts] = await Promise.all([
    linesPromise,
    supplierSummaryPromise,
    suppliersPromise,
    receiptsPromise,
  ]);

  const purchaseOptionsByLine = new Map(
    (
      await Promise.all(
        lines.map(async (line) => [
          line.id,
          await listPurchaseOptionsForRequisitionLine(tenantSlug, line.id),
        ] as const),
      )
    ).map(([lineId, options]) => [lineId, options]),
  );

  const isDraft = requisition.status === "draft";
  const isReviewed = requisition.status === "reviewed";
  const canQuote = canManage && (isDraft || isReviewed);
  const totals = lines.reduce(
    (acc, line) => {
      acc.preliminary += Number(line.preliminary_total_cost ?? line.estimated_total_cost ?? 0);
      acc.quoted += Number(line.quoted_total_cost ?? line.preliminary_total_cost ?? line.estimated_total_cost ?? 0);
      acc.approved += Number(line.approved_total_cost ?? line.quoted_total_cost ?? line.preliminary_total_cost ?? line.estimated_total_cost ?? 0);
      return acc;
    },
    { preliminary: 0, quoted: 0, approved: 0 },
  );
  const purchaseReadyStatus = (() => {
    const missingSupplier = lines.some((line) => line.supplier_id == null);
    const missingPurchaseOption = lines.some((line) => line.purchase_option_id == null && line.purchase_warning != null);
    const missingPricing = lines.some((line) => line.quoted_unit_price == null && line.preliminary_unit_price == null);
    const total = requisition.status === "approved" ? totals.approved : requisition.status === "reviewed" ? totals.quoted : totals.preliminary;
    if (missingSupplier) return "Pendiente de proveedor";
    if (missingPurchaseOption) return "Pendiente de unidad de compra";
    if (missingPricing) return "Pendiente de cotizar";
    if (total <= 0) return "Pendiente de cotizar";
    if (requisition.status === "reviewed" || requisition.status === "approved") return "Lista para compra";
    return "Pendiente de cotizar";
  })();

  return (
    <>
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <p className="text-xs text-muted">
          Totales: preliminar ${totals.preliminary.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ·
          cotizado ${totals.quoted.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          {requisition.status === "approved"
            ? ` · aprobado $${totals.approved.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : ""}
        </p>
        <p className="mt-1 text-xs text-muted">Estado operativo: {purchaseReadyStatus}</p>
        {canManage ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(isDraft || isReviewed) ? (
              <KitchenCriticalActionGroup
                className="flex flex-wrap items-center gap-2"
                buttonClassName="px-3 py-1 text-xs"
                actions={[
                  ...(isDraft
                    ? [{
                        id: "mark-reviewed",
                        action: markCateringRequisitionReviewedAction,
                        fields: [
                          { name: "tenantSlug", value: tenantSlug },
                          { name: "requisitionId", value: requisition.id },
                        ],
                        label: "Marcar revisada",
                        pendingLabel: "Guardando...",
                      }]
                    : []),
                  ...(isReviewed
                    ? [{
                        id: "approve",
                        action: approveCateringRequisitionAction,
                        fields: [
                          { name: "tenantSlug", value: tenantSlug },
                          { name: "requisitionId", value: requisition.id },
                        ],
                        label: "Aprobar",
                        pendingLabel: "Aprobando...",
                      }]
                    : []),
                  ...((isDraft || isReviewed)
                    ? [{
                        id: "cancel",
                        action: cancelCateringRequisitionAction,
                        fields: [
                          { name: "tenantSlug", value: tenantSlug },
                          { name: "requisitionId", value: requisition.id },
                        ],
                        label: "Cancelar",
                        pendingLabel: "Cancelando...",
                      }]
                    : []),
                ]}
              />
            ) : null}
            {requisition.status === "approved" ? (
              <form action={createPurchaseReceiptFromRequisitionAction}>
                <input type="hidden" name="tenantSlug" value={tenantSlug} />
                <input type="hidden" name="requisitionId" value={requisition.id} />
                <KitchenSubmitButton variant="secondary" pendingLabel="Creando recepción..." className="px-3 py-1 text-xs">
                  Crear recepción
                </KitchenSubmitButton>
              </form>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Recepciones de compra</h2>
        {receipts.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No hay recepciones registradas para esta requisición.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead><tr className="text-left text-muted"><th className="px-2 py-1">Recepción</th><th className="px-2 py-1">Status</th><th className="px-2 py-1">Proveedor</th><th className="px-2 py-1">Total</th><th className="px-2 py-1">Recibida</th><th className="px-2 py-1">Acción</th></tr></thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr key={receipt.id} className="border-t border-border">
                    <td className="px-2 py-1 text-foreground">{receipt.id.slice(0, 8)}</td>
                    <td className="px-2 py-1 text-foreground">{receipt.status}</td>
                    <td className="px-2 py-1 text-muted">{receipt.kitchen_inventory_suppliers?.name ?? "—"}</td>
                    <td className="px-2 py-1 text-foreground">${Number(receipt.total_received_cost ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1 text-muted">{receipt.received_at ? new Date(receipt.received_at).toLocaleString("es-MX") : "—"}</td>
                    <td className="px-2 py-1"><a href={`/${tenantSlug}/kitchen/events/requisitions/${requisition.id}/receipts/${receipt.id}`} className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs">Ver recepción</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {lines.length === 0 ? (
        <StatePanel kind="empty" title="Sin líneas" message="Esta requisición no tiene líneas registradas." />
      ) : (
        <>
          <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-foreground">Resumen por proveedor</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-xs"><thead><tr className="text-left text-muted"><th className="px-2 py-1">Proveedor</th><th className="px-2 py-1">Líneas</th><th className="px-2 py-1">Preliminar</th><th className="px-2 py-1">Cotizado</th><th className="px-2 py-1">Aprobado</th><th className="px-2 py-1">Pend. cotizar</th><th className="px-2 py-1">Sin opción compra</th><th className="px-2 py-1">Sin proveedor</th><th className="px-2 py-1">Estado</th></tr></thead>
                <tbody>
                  {supplierSummary.map((row) => (
                    <tr key={row.supplier_id ?? "no-supplier"} className="border-t border-border">
                      <td className="px-2 py-1 text-foreground">{row.supplier_name}</td><td className="px-2 py-1 text-foreground">{row.line_count}</td>
                      <td className="px-2 py-1 text-foreground">${row.preliminary_total.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-2 py-1 text-foreground">${row.quoted_total.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-2 py-1 text-foreground">${row.approved_total.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-2 py-1 text-muted">{row.lines_without_quote}</td><td className="px-2 py-1 text-muted">{row.lines_without_purchase_option}</td><td className="px-2 py-1 text-muted">{row.lines_without_supplier}</td>
                      <td className="px-2 py-1 text-foreground">{row.status_summary === "complete" ? "Completo" : row.status_summary === "missing_quote" ? "Falta precio" : row.status_summary === "missing_supplier" ? "Falta proveedor" : "Falta opción compra"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-foreground">Líneas de requisición</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead><tr className="text-left text-muted"><th className="px-2 py-1">Insumo</th><th className="px-2 py-1">Faltante</th><th className="px-2 py-1">Presentación</th><th className="px-2 py-1">Cotización</th><th className="px-2 py-1">Proveedor</th><th className="px-2 py-1">Acciones</th></tr></thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-t border-border">
                      <td className="px-2 py-1 text-foreground">{line.kitchen_inventory_items?.name ?? line.item_id.slice(0, 8)}</td>
                      <td className="px-2 py-1 text-foreground">{Number(line.requested_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {line.kitchen_inventory_units?.code ?? "ud"}</td>
                      <td className="px-2 py-1 text-foreground">
                        {canQuote ? (
                          <form action={updateRequisitionLinePurchaseOptionAction} className="flex items-center gap-1">
                            <input type="hidden" name="tenantSlug" value={tenantSlug} />
                            <input type="hidden" name="requisitionId" value={requisition.id} />
                            <input type="hidden" name="lineId" value={line.id} />
                            <KitchenFormPendingFieldset className="flex items-center gap-1">
                              <select name="purchaseOptionId" defaultValue={line.purchase_option_id ?? ""} className="h-8 min-w-[220px] rounded border border-border bg-surface px-2 text-xs">
                                <option value="" disabled>Selecciona presentación</option>
                                {(purchaseOptionsByLine.get(line.id) ?? []).map((option) => (
                                  <option key={option.purchase_option_id} value={option.purchase_option_id}>{`${option.supplier_name} · ${option.purchase_unit?.code ?? "ud"}`}</option>
                                ))}
                              </select>
                              <KitchenSubmitButton pendingLabel="Actualizando..." className="px-2 py-1 text-xs">Cambiar</KitchenSubmitButton>
                            </KitchenFormPendingFieldset>
                          </form>
                        ) : "Bloqueada por estatus"}
                      </td>
                      <td className="px-2 py-1 text-foreground">
                        {canQuote ? (
                          <form action={updateCateringRequisitionLineQuoteAction} className="flex items-center gap-1">
                            <input type="hidden" name="tenantSlug" value={tenantSlug} />
                            <input type="hidden" name="requisitionId" value={requisition.id} />
                            <input type="hidden" name="lineId" value={line.id} />
                            <input type="hidden" name="supplierId" value={line.supplier_id ?? ""} />
                            <KitchenFormPendingFieldset className="flex items-center gap-1">
                              <input name="quotedUnitPrice" type="number" min="0.0001" step="0.0001" defaultValue={String(line.quoted_unit_price ?? line.preliminary_unit_price ?? line.estimated_unit_cost ?? 0)} className="h-8 w-24 rounded border border-border bg-surface px-2 text-xs" />
                              <KitchenSubmitButton pendingLabel="Actualizando..." className="px-2 py-1 text-xs">Guardar</KitchenSubmitButton>
                            </KitchenFormPendingFieldset>
                          </form>
                        ) : `$${Number(line.quoted_unit_price ?? line.preliminary_unit_price ?? line.estimated_unit_cost ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}
                      </td>
                      <td className="px-2 py-1 text-foreground">
                        {canQuote ? (
                          <form action={updateCateringRequisitionLineSupplierAction} className="flex items-center gap-1">
                            <input type="hidden" name="tenantSlug" value={tenantSlug} />
                            <input type="hidden" name="requisitionId" value={requisition.id} />
                            <input type="hidden" name="lineId" value={line.id} />
                            <KitchenFormPendingFieldset className="flex items-center gap-1">
                              <select name="supplierId" defaultValue={line.supplier_id ?? ""} className="h-8 rounded border border-border bg-surface px-2 text-xs">
                                <option value="">Sin proveedor</option>
                                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                              </select>
                              <KitchenSubmitButton pendingLabel="Guardando..." className="px-2 py-1 text-xs">Guardar</KitchenSubmitButton>
                            </KitchenFormPendingFieldset>
                          </form>
                        ) : (line.kitchen_inventory_suppliers?.name ?? "Sin proveedor")}
                      </td>
                      <td className="px-2 py-1 text-foreground">
                        {canManage && isDraft ? (
                          <form action={updateCateringRequisitionLineAction} className="flex items-center gap-1">
                            <input type="hidden" name="tenantSlug" value={tenantSlug} />
                            <input type="hidden" name="requisitionId" value={requisition.id} />
                            <input type="hidden" name="lineId" value={line.id} />
                            <KitchenFormPendingFieldset className="flex items-center gap-1">
                              <input name="requestedQuantity" type="number" min="0.0001" step="0.0001" defaultValue={String(line.requested_quantity)} className="h-8 w-24 rounded border border-border bg-surface px-2 text-xs" />
                              <KitchenSubmitButton pendingLabel="Guardando..." className="px-2 py-1 text-xs">Actualizar</KitchenSubmitButton>
                            </KitchenFormPendingFieldset>
                          </form>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function RequisitionContentFallback() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenActionRowSkeleton actions={3} />
      <KitchenTableSkeleton rows={6} columns={7} />
      <KitchenTableSkeleton rows={8} columns={6} />
    </div>
  );
}
