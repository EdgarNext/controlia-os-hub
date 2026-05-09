import { Suspense } from "react";
import { ArrowRightLeft, RefreshCw } from "lucide-react";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import {
  approveCateringRequisitionAction,
  createPurchaseReceiptFromRequisitionAction,
  cancelCateringRequisitionAction,
  markCateringRequisitionReviewedAction,
  refreshCateringRequisitionQuotedPricesAction,
  updateRequisitionLinePurchaseOptionAction,
  updateCateringRequisitionLineAction,
} from "@/lib/kitchen/event-catering/actions";
import {
  getCateringRequisition,
  getCateringRequisitionSupplierSummary,
  listPurchaseOptionsForRequisitionLine,
  listPurchaseReceiptsForRequisition,
  listCateringRequisitionLines,
} from "@/lib/kitchen/event-catering/queries";
import { KitchenActionRowSkeleton, KitchenTableSkeleton } from "../../../_components/kitchen-loading-skeletons";
import { KitchenCriticalActionGroup } from "../../../_components/kitchen-critical-action-group";
import { KitchenFormPendingFieldset } from "../../../_components/kitchen-form-pending-fieldset";
import { KitchenSubmitButton } from "../../../_components/kitchen-submit-button";
import { resolveKitchenPage } from "../../../_lib/page-access";

type KitchenCateringRequisitionDetailPageProps = {
  params: Promise<{ tenantSlug: string; requisitionId: string }>;
};

function resolveRequisitionLineFinancialTotal(line: Awaited<ReturnType<typeof listCateringRequisitionLines>>[number]) {
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
  const receiptsPromise = listPurchaseReceiptsForRequisition(result.tenant.tenantSlug, requisitionId);

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">
          Requisición - {requisition.event_catering_plans?.name ?? requisition.plan_id.slice(0, 8)} -{" "}
          {requisition.event_catering_plans?.events?.name ?? requisition.event_catering_plans?.event_id?.slice(0, 8) ?? "Evento"}
        </h1>
        <p className="mt-1 text-xs text-muted">Referencia: {requisition.id.slice(0, 8)}</p>
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
  receiptsPromise,
}: {
  tenantSlug: string;
  requisition: NonNullable<Awaited<ReturnType<typeof getCateringRequisition>>>;
  canManage: boolean;
  linesPromise: ReturnType<typeof listCateringRequisitionLines>;
  supplierSummaryPromise: ReturnType<typeof getCateringRequisitionSupplierSummary>;
  receiptsPromise: ReturnType<typeof listPurchaseReceiptsForRequisition>;
}) {
  const [lines, supplierSummary, receipts] = await Promise.all([
    linesPromise,
    supplierSummaryPromise,
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
  const existingDraftReceipt = receipts.find((receipt) => receipt.status === "draft");
  const existingReceivedReceipt = receipts.find((receipt) => receipt.status === "received");
  const draftReceipts = receipts.filter((receipt) => receipt.status === "draft");
  const receivedReceipts = receipts.filter((receipt) => receipt.status === "received");
  const canceledReceipts = receipts.filter((receipt) => receipt.status === "canceled");
  const totals = lines.reduce(
    (acc, line) => {
      const preliminaryTotal = Number(line.preliminary_total_cost ?? 0) > 0
        ? Number(line.preliminary_total_cost)
        : Number(line.estimated_total_cost ?? 0);
      const quotedTotal = Number(line.quoted_total_cost ?? 0) > 0
        ? Number(line.quoted_total_cost)
        : preliminaryTotal;
      const approvedTotal = Number(line.approved_total_cost ?? 0) > 0
        ? Number(line.approved_total_cost)
        : quotedTotal;
      acc.preliminary += preliminaryTotal;
      acc.quoted += quotedTotal;
      acc.approved += approvedTotal;
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
  const supplierSummaryTotals = supplierSummary.reduce(
    (acc, row) => {
      acc.lineCount += row.line_count;
      acc.preliminary += row.preliminary_total;
      acc.quoted += row.quoted_total;
      acc.approved += row.approved_total;
      acc.withoutQuote += row.lines_without_quote;
      acc.withoutPurchaseOption += row.lines_without_purchase_option;
      acc.withoutSupplier += row.lines_without_supplier;
      return acc;
    },
    {
      lineCount: 0,
      preliminary: 0,
      quoted: 0,
      approved: 0,
      withoutQuote: 0,
      withoutPurchaseOption: 0,
      withoutSupplier: 0,
    },
  );
  const receiptExpectedTotal = lines.reduce((acc, line) => {
    const requestedQuantity = Number(line.requested_quantity ?? 0);
    const expectedInventoryQuantity = Number(line.expected_inventory_quantity ?? requestedQuantity);
    if (expectedInventoryQuantity <= 0) return acc;
    return acc + resolveRequisitionLineFinancialTotal(line);
  }, 0);
  const hasReceivableLines =
    lines.length > 0 &&
    lines.every((line) => {
      const requestedQuantity = Number(line.requested_quantity ?? 0);
      const expectedInventoryQuantity = Number(line.expected_inventory_quantity ?? requestedQuantity);
      return line.item_id != null && line.unit_id != null && requestedQuantity > 0 && expectedInventoryQuantity > 0 && resolveRequisitionLineFinancialTotal(line) > 0;
    }) &&
    receiptExpectedTotal > 0;
  const canCreateReceipt =
    canManage &&
    requisition.status === "approved" &&
    !existingDraftReceipt &&
    !existingReceivedReceipt &&
    hasReceivableLines;

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
                key={requisition.status}
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
              existingDraftReceipt ? (
                <div className="flex flex-wrap items-center gap-2">
                  <KitchenSubmitButton variant="secondary" disabled className="px-3 py-1 text-xs">
                    Crear recepción
                  </KitchenSubmitButton>
                  <a
                    href={`/${tenantSlug}/kitchen/events/requisitions/${requisition.id}/receipts/${existingDraftReceipt.id}`}
                    className="text-xs text-primary underline underline-offset-2"
                  >
                    Abrir recepción draft existente
                  </a>
                </div>
              ) : existingReceivedReceipt ? (
                <div className="flex flex-wrap items-center gap-2">
                  <KitchenSubmitButton variant="secondary" disabled className="px-3 py-1 text-xs">
                    Recepción ya confirmada
                  </KitchenSubmitButton>
                  <a
                    href={`/${tenantSlug}/kitchen/events/requisitions/${requisition.id}/receipts/${existingReceivedReceipt.id}`}
                    className="text-xs text-primary underline underline-offset-2"
                  >
                    Ver recepción recibida
                  </a>
                </div>
              ) : !hasReceivableLines ? (
                <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs text-warning">
                  No se puede crear recepción: líneas o total inválidos
                </span>
              ) : (
                <form action={createPurchaseReceiptFromRequisitionAction}>
                  <input type="hidden" name="tenantSlug" value={tenantSlug} />
                  <input type="hidden" name="requisitionId" value={requisition.id} />
                  <KitchenSubmitButton
                    variant="secondary"
                    pendingLabel="Creando recepción..."
                    disabled={!canCreateReceipt}
                    className="px-3 py-1 text-xs"
                  >
                    Crear recepción
                  </KitchenSubmitButton>
                </form>
              )
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Recepciones de compra</h2>
        {receipts.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No hay recepciones registradas para esta requisición.</p>
        ) : (
          <div className="mt-3 space-y-4">
            <ReceiptGroup title="Draft activa" receipts={draftReceipts} tenantSlug={tenantSlug} requisitionId={requisition.id} emptyLabel="Sin recepción draft." />
            <ReceiptGroup title="Recibidas" receipts={receivedReceipts} tenantSlug={tenantSlug} requisitionId={requisition.id} emptyLabel="Sin recepciones recibidas." />
            <ReceiptGroup
              title="Canceladas / historial"
              receipts={canceledReceipts}
              tenantSlug={tenantSlug}
              requisitionId={requisition.id}
              emptyLabel="Sin recepciones canceladas."
              muted
            />
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
                <tfoot>
                  <tr className="border-t border-primary/20 bg-primary/10 font-semibold text-foreground">
                    <td className="px-2 py-1">Totales</td>
                    <td className="px-2 py-1">{supplierSummaryTotals.lineCount}</td>
                    <td className="px-2 py-1">${supplierSummaryTotals.preliminary.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1">${supplierSummaryTotals.quoted.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1">${supplierSummaryTotals.approved.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1">{supplierSummaryTotals.withoutQuote}</td>
                    <td className="px-2 py-1">{supplierSummaryTotals.withoutPurchaseOption}</td>
                    <td className="px-2 py-1">{supplierSummaryTotals.withoutSupplier}</td>
                    <td className="px-2 py-1">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">Líneas de requisición</h2>
              {canQuote ? (
                <form id="bulk-quote-refresh-form" action={refreshCateringRequisitionQuotedPricesAction}>
                  <input type="hidden" name="tenantSlug" value={tenantSlug} />
                  <input type="hidden" name="requisitionId" value={requisition.id} />
                  <KitchenSubmitButton pendingLabel="Actualizando..." variant="secondary" className="px-2 py-1 text-xs">
                    Actualizar Precios
                  </KitchenSubmitButton>
                </form>
              ) : null}
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead><tr className="text-left text-muted"><th className="px-2 py-1">Insumo</th><th className="px-2 py-1">Faltante</th><th className="px-2 py-1">Ajustes</th><th className="px-2 py-1">Cantidad cotizada</th><th className="px-2 py-1">Presentación</th><th className="px-2 py-1">Cotización</th></tr></thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-t border-border">
                      <td className="px-2 py-1 text-foreground">{line.kitchen_inventory_items?.name ?? line.item_id.slice(0, 8)}</td>
                      <td className="px-2 py-1 text-foreground">{Number(line.requested_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {line.kitchen_inventory_units?.code ?? "ud"}</td>
                      <td className="px-2 py-1 text-foreground">
                        {canManage && isDraft ? (
                          <form action={updateCateringRequisitionLineAction} className="flex items-center gap-1">
                            <input type="hidden" name="tenantSlug" value={tenantSlug} />
                            <input type="hidden" name="requisitionId" value={requisition.id} />
                            <input type="hidden" name="lineId" value={line.id} />
                            <KitchenFormPendingFieldset className="flex items-center gap-1">
                              <input name="requestedQuantity" type="number" min="0.0001" step="0.0001" defaultValue={String(line.requested_quantity)} className="h-8 w-24 rounded border border-border bg-surface px-2 text-xs" />
                              <KitchenSubmitButton
                                pendingLabel="Guardando..."
                                className="px-2 py-1 text-xs"
                                aria-label="Actualizar faltante"
                                title="Actualizar faltante"
                              >
                                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                              </KitchenSubmitButton>
                            </KitchenFormPendingFieldset>
                          </form>
                        ) : "—"}
                      </td>
                      <td className="px-2 py-1 text-foreground">
                        {line.requested_purchase_quantity != null
                          ? `${Number(line.requested_purchase_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${line.purchase_units?.code ?? ""}`.trim()
                          : "—"}
                      </td>
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
                              <KitchenSubmitButton
                                pendingLabel="Actualizando..."
                                className="px-2 py-1 text-xs"
                                aria-label="Cambiar presentación"
                                title="Cambiar presentación"
                              >
                                <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
                              </KitchenSubmitButton>
                            </KitchenFormPendingFieldset>
                          </form>
                        ) : (line.kitchen_inventory_suppliers?.name ?? "Sin proveedor")}
                      </td>
                      <td className="px-2 py-1 text-foreground">
                        {canQuote ? (
                          <div className="space-y-1">
                            <p className="text-[11px] text-muted">
                              Precio actual: $
                              {Number(
                                line.quoted_unit_price ?? line.preliminary_unit_price ?? line.estimated_unit_cost ?? 0,
                              ).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                            </p>
                            <input
                              name={`quotedUnitPrice:${line.id}`}
                              form="bulk-quote-refresh-form"
                              type="number"
                              min="0"
                              step="0.0001"
                              defaultValue={String(line.quoted_unit_price ?? line.preliminary_unit_price ?? line.estimated_unit_cost ?? 0)}
                              className="h-8 w-28 rounded border border-border bg-surface px-2 text-xs"
                              aria-label="Precio nuevo"
                            />
                            {line.price_source === "quoted_bulk_refresh" ? (
                              <p className="text-[11px] font-semibold text-emerald-600">
                                Precio aplicado: $
                                {Number(line.quoted_unit_price ?? 0).toLocaleString("es-MX", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 4,
                                })}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-[11px] text-muted">
                              Precio aplicado: $
                              {Number(
                                line.approved_unit_price ?? line.quoted_unit_price ?? line.preliminary_unit_price ?? line.estimated_unit_cost ?? 0,
                              ).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                            </p>
                            <p className="text-[11px] text-muted">Verificado al revisar</p>
                          </div>
                        )}
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

function ReceiptGroup({
  title,
  receipts,
  tenantSlug,
  requisitionId,
  emptyLabel,
  muted = false,
}: {
  title: string;
  receipts: Awaited<ReturnType<typeof listPurchaseReceiptsForRequisition>>;
  tenantSlug: string;
  requisitionId: string;
  emptyLabel: string;
  muted?: boolean;
}) {
  const labelStatus = (status: string) => {
    if (status === "draft") return "Borrador";
    if (status === "received") return "Recibida";
    if (status === "canceled") return "Cancelada";
    return status;
  };

  return (
    <div className={muted ? "rounded border border-primary/20 bg-primary/10 p-3" : ""}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        <span className="rounded-full border border-border bg-surface px-2 py-1 text-[11px] text-muted">{receipts.length}</span>
      </div>
      {receipts.length === 0 ? (
        <p className="mt-2 text-xs text-muted">{emptyLabel}</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-2 py-1">Recepción</th>
                <th className="px-2 py-1">Estado</th>
                <th className="px-2 py-1">Proveedor</th>
                <th className="px-2 py-1">Total</th>
                <th className="px-2 py-1">Recibida</th>
                <th className="px-2 py-1">Acción</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.id} className="border-t border-border">
                  <td className="px-2 py-1 text-foreground">{receipt.id.slice(0, 8)}</td>
                  <td className="px-2 py-1 text-foreground">
                    {labelStatus(receipt.status)}
                    {receipt.status === "canceled" ? (
                      <span className="ml-2 text-[11px] text-muted">No afecta inventario</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1 text-muted">{receipt.kitchen_inventory_suppliers?.name ?? "—"}</td>
                  <td className="px-2 py-1 text-foreground">
                    ${Number(receipt.total_received_cost ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-1 text-muted">{receipt.received_at ? new Date(receipt.received_at).toLocaleString("es-MX") : "—"}</td>
                  <td className="px-2 py-1">
                    <a
                      href={`/${tenantSlug}/kitchen/events/requisitions/${requisitionId}/receipts/${receipt.id}`}
                      className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs"
                    >
                      {receipt.status === "draft" ? "Continuar" : receipt.status === "canceled" ? "Ver historial" : "Ver recepción"}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
