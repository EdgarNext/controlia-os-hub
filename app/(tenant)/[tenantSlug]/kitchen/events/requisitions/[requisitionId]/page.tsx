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

  const [requisition, lines, supplierSummary, suppliers, receipts] = await Promise.all([
    getCateringRequisition(result.tenant.tenantSlug, requisitionId),
    listCateringRequisitionLines(result.tenant.tenantSlug, requisitionId),
    getCateringRequisitionSupplierSummary(result.tenant.tenantSlug, requisitionId),
    listKitchenInventorySuppliers(result.tenant.tenantId),
    listPurchaseReceiptsForRequisition(result.tenant.tenantSlug, requisitionId),
  ]);

  const purchaseOptionsByLine = new Map(
    (
      await Promise.all(
        lines.map(async (line) => [
          line.id,
          await listPurchaseOptionsForRequisitionLine(result.tenant.tenantSlug, line.id),
        ] as const),
      )
    ).map(([lineId, options]) => [lineId, options]),
  );

  if (!requisition) {
    return <StatePanel kind="empty" title="Requisición no encontrada" message="La requisición no existe en este tenant." />;
  }

  const accessMap = await getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "event_catering");
  const canManage = hasModulePageAccess(accessMap.requisitions ?? "none", "manage");
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
  const linesBySupplier = new Map<string, typeof lines>();
  for (const line of lines) {
    const key = line.supplier_id ?? "__no_supplier__";
    const current = linesBySupplier.get(key) ?? [];
    current.push(line);
    linesBySupplier.set(key, current);
  }

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
        <p className="mt-1 text-xs text-muted">
          Totales: preliminar ${totals.preliminary.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ·
          cotizado ${totals.quoted.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          {requisition.status === "approved"
            ? ` · aprobado $${totals.approved.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : ""}
        </p>
        <p className="mt-1 text-xs text-muted">Estado operativo: {purchaseReadyStatus}</p>
        {canManage ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {isDraft ? (
              <form action={markCateringRequisitionReviewedAction}>
                <input type="hidden" name="tenantSlug" value={tenantSlug} />
                <input type="hidden" name="requisitionId" value={requisition.id} />
                <button type="submit" className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1 text-xs">
                  Marcar revisada
                </button>
              </form>
            ) : null}
            {isReviewed ? (
              <form action={approveCateringRequisitionAction}>
                <input type="hidden" name="tenantSlug" value={tenantSlug} />
                <input type="hidden" name="requisitionId" value={requisition.id} />
                <button type="submit" className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1 text-xs">
                  Aprobar
                </button>
              </form>
            ) : null}
            {(isDraft || isReviewed) ? (
              <form action={cancelCateringRequisitionAction}>
                <input type="hidden" name="tenantSlug" value={tenantSlug} />
                <input type="hidden" name="requisitionId" value={requisition.id} />
                <button type="submit" className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1 text-xs">
                  Cancelar
                </button>
              </form>
            ) : null}
            {requisition.status === "approved" ? (
              <form action={createPurchaseReceiptFromRequisitionAction}>
                <input type="hidden" name="tenantSlug" value={tenantSlug} />
                <input type="hidden" name="requisitionId" value={requisition.id} />
                <button type="submit" className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1 text-xs">
                  Crear recepción
                </button>
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
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-2 py-1">Recepción</th>
                  <th className="px-2 py-1">Status</th>
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
                    <td className="px-2 py-1 text-foreground">{receipt.status}</td>
                    <td className="px-2 py-1 text-muted">{receipt.kitchen_inventory_suppliers?.name ?? "—"}</td>
                    <td className="px-2 py-1 text-foreground">
                      ${Number(receipt.total_received_cost ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-1 text-muted">{receipt.received_at ? new Date(receipt.received_at).toLocaleString("es-MX") : "—"}</td>
                    <td className="px-2 py-1">
                      <a
                        href={`/${tenantSlug}/kitchen/events/requisitions/${requisition.id}/receipts/${receipt.id}`}
                        className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs"
                      >
                        Ver recepción
                      </a>
                    </td>
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
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-2 py-1">Proveedor</th>
                  <th className="px-2 py-1">Líneas</th>
                  <th className="px-2 py-1">Preliminar</th>
                  <th className="px-2 py-1">Cotizado</th>
                  <th className="px-2 py-1">Aprobado</th>
                  <th className="px-2 py-1">Pend. cotizar</th>
                  <th className="px-2 py-1">Sin opción compra</th>
                  <th className="px-2 py-1">Sin proveedor</th>
                  <th className="px-2 py-1">Estado</th>
                </tr>
              </thead>
              <tbody>
                {supplierSummary.map((row) => (
                  <tr key={row.supplier_id ?? "no-supplier"} className="border-t border-border">
                    <td className="px-2 py-1 text-foreground">{row.supplier_name}</td>
                    <td className="px-2 py-1 text-foreground">{row.line_count}</td>
                    <td className="px-2 py-1 text-foreground">${row.preliminary_total.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1 text-foreground">${row.quoted_total.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1 text-foreground">${row.approved_total.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1 text-muted">{row.lines_without_quote}</td>
                    <td className="px-2 py-1 text-muted">{row.lines_without_purchase_option}</td>
                    <td className="px-2 py-1 text-muted">{row.lines_without_supplier}</td>
                    <td className="px-2 py-1 text-foreground">
                      {row.status_summary === "complete" ? "Completo" : row.status_summary === "missing_quote" ? "Falta precio" : row.status_summary === "missing_supplier" ? "Falta proveedor" : "Falta opción compra"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-foreground">Líneas de requisición por proveedor</h2>
          <div className="mt-3 space-y-4">
            {Array.from(linesBySupplier.entries()).map(([supplierKey, supplierLines]) => (
              <div key={supplierKey} className="rounded border border-border p-3">
                <p className="text-xs font-semibold text-foreground">
                  {supplierLines[0]?.kitchen_inventory_suppliers?.name ?? "Sin proveedor asignado"}
                </p>
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted">
                        <th className="px-2 py-1">Insumo</th>
                        <th className="px-2 py-1">Faltante</th>
                        <th className="px-2 py-1">Comprar</th>
                        <th className="px-2 py-1">Presentación actual</th>
                        <th className="px-2 py-1">Cambiar presentación</th>
                        <th className="px-2 py-1">Unidad compra</th>
                        <th className="px-2 py-1">Precio preliminar</th>
                        <th className="px-2 py-1">Precio cotizado</th>
                        <th className="px-2 py-1">Total cotizado</th>
                        <th className="px-2 py-1">Advertencias</th>
                        <th className="px-2 py-1">Proveedor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierLines.map((line) => (
                        <tr key={line.id} className="border-t border-border">
                          <td className="px-2 py-1 text-foreground">{line.kitchen_inventory_items?.name ?? line.item_id.slice(0, 8)}</td>
                          <td className="px-2 py-1 text-foreground">{Number(line.requested_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {line.kitchen_inventory_units?.code ?? "ud"}</td>
                          <td className="px-2 py-1 text-foreground">{line.requested_purchase_quantity != null ? Number(line.requested_purchase_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "—"}</td>
                          <td className="px-2 py-1 text-muted">
                            {line.purchase_units?.code
                              ? `${line.purchase_units.code} · ${Number(line.expected_inventory_quantity ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} eq`
                              : "—"}
                          </td>
                          <td className="px-2 py-1 text-foreground">
                            {canQuote ? (
                              <form action={updateRequisitionLinePurchaseOptionAction} className="flex items-center gap-1">
                                <input type="hidden" name="tenantSlug" value={tenantSlug} />
                                <input type="hidden" name="requisitionId" value={requisition.id} />
                                <input type="hidden" name="lineId" value={line.id} />
                                <select
                                  name="purchaseOptionId"
                                  defaultValue={line.purchase_option_id ?? ""}
                                  className="h-8 min-w-[260px] rounded border border-border bg-surface px-2 text-xs"
                                >
                                  <option value="" disabled>Selecciona presentación</option>
                                  {(purchaseOptionsByLine.get(line.id) ?? []).map((option) => (
                                    <option key={option.purchase_option_id} value={option.purchase_option_id}>
                                      {`${option.supplier_name} · ${option.purchase_unit?.code ?? "ud"} · precio ${option.current_supplier_price != null ? `$${option.current_supplier_price.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : "fallback"} · comprar ${option.calculated_purchase_quantity != null ? option.calculated_purchase_quantity.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "—"} · eq ${option.expected_inventory_quantity != null ? option.expected_inventory_quantity.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "—"} · sobrante ${option.expected_surplus_quantity != null ? option.expected_surplus_quantity.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "—"} · costo ${option.estimated_total_cost != null ? `$${option.estimated_total_cost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}${option.is_default ? " · default" : ""}${option.is_current_selection ? " · actual" : ""}`}
                                    </option>
                                  ))}
                                </select>
                                <button type="submit" className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs">Cambiar</button>
                              </form>
                            ) : (
                              "Bloqueada por estatus"
                            )}
                          </td>
                          <td className="px-2 py-1 text-muted">{line.purchase_units?.code ?? "—"}</td>
                          <td className="px-2 py-1 text-foreground">${Number(line.preliminary_unit_price ?? line.estimated_unit_cost ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                          <td className="px-2 py-1 text-foreground">${Number(line.quoted_unit_price ?? line.preliminary_unit_price ?? line.estimated_unit_cost ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                          <td className="px-2 py-1 text-foreground">${Number(line.quoted_total_cost ?? line.preliminary_total_cost ?? line.estimated_total_cost ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-2 py-1 text-warning">{line.purchase_warning ?? "—"}</td>
                          <td className="px-2 py-1 text-foreground">
                            {canQuote ? (
                              <form action={updateCateringRequisitionLineSupplierAction} className="flex items-center gap-1">
                                <input type="hidden" name="tenantSlug" value={tenantSlug} />
                                <input type="hidden" name="requisitionId" value={requisition.id} />
                                <input type="hidden" name="lineId" value={line.id} />
                                <select
                                  name="supplierId"
                                  defaultValue={line.supplier_id ?? ""}
                                  className="h-8 rounded border border-border bg-surface px-2 text-xs"
                                >
                                  <option value="">Sin proveedor</option>
                                  {suppliers.map((supplier) => (
                                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                  ))}
                                </select>
                                <button type="submit" className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs">Guardar</button>
                              </form>
                            ) : (
                              line.kitchen_inventory_suppliers?.name ?? "Sin proveedor"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-foreground">Detalle completo de líneas</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-2 py-1">Insumo</th>
                  <th className="px-2 py-1">Faltante</th>
                  <th className="px-2 py-1">Comprar</th>
                  <th className="px-2 py-1">Equivalente inv.</th>
                  <th className="px-2 py-1">Sobrante esp.</th>
                  <th className="px-2 py-1">Unidad</th>
                  <th className="px-2 py-1">Proveedor sugerido</th>
                  <th className="px-2 py-1">Warning</th>
                  <th className="px-2 py-1">Precio preliminar</th>
                  <th className="px-2 py-1">Costo preliminar</th>
                  <th className="px-2 py-1">Precio cotizado</th>
                  <th className="px-2 py-1">Costo cotizado</th>
                  <th className="px-2 py-1">Costo aprobado</th>
                  <th className="px-2 py-1">Acción</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-t border-border">
                    <td className="px-2 py-1 text-foreground">{line.kitchen_inventory_items?.name ?? line.item_id.slice(0, 8)}</td>
                    <td className="px-2 py-1 text-foreground">
                      {canManage && isDraft ? (
                        <form action={updateCateringRequisitionLineAction} className="flex items-center gap-1">
                          <input type="hidden" name="tenantSlug" value={tenantSlug} />
                          <input type="hidden" name="requisitionId" value={requisition.id} />
                          <input type="hidden" name="lineId" value={line.id} />
                          <input
                            name="requestedQuantity"
                            type="number"
                            min="0.0001"
                            step="0.0001"
                            defaultValue={String(line.requested_quantity)}
                            className="h-8 w-28 rounded border border-border bg-surface px-2 text-xs"
                          />
                          <button type="submit" className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs">
                            Guardar
                          </button>
                        </form>
                      ) : (
                        Number(line.requested_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                      )}
                    </td>
                    <td className="px-2 py-1 text-foreground">
                      {line.requested_purchase_quantity != null
                        ? `${Number(line.requested_purchase_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${line.purchase_units?.code ?? ""}`.trim()
                        : "—"}
                    </td>
                    <td className="px-2 py-1 text-foreground">
                      {line.expected_inventory_quantity != null
                        ? Number(line.expected_inventory_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                        : "—"}
                    </td>
                    <td className="px-2 py-1 text-foreground">
                      {line.expected_surplus_quantity != null
                        ? Number(line.expected_surplus_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                        : "—"}
                    </td>
                    <td className="px-2 py-1 text-muted">{line.kitchen_inventory_units?.code ?? "ud"}</td>
                    <td className="px-2 py-1 text-muted">{line.kitchen_inventory_suppliers?.name ?? "—"}</td>
                    <td className="px-2 py-1 text-warning">{line.purchase_warning ?? "—"}</td>
                    <td className="px-2 py-1 text-foreground">${Number(line.preliminary_unit_price ?? line.estimated_unit_cost ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                    <td className="px-2 py-1 text-foreground">${Number(line.preliminary_total_cost ?? line.estimated_total_cost ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1 text-foreground">
                      {canQuote ? (
                        <form action={updateCateringRequisitionLineQuoteAction} className="flex items-center gap-1">
                          <input type="hidden" name="tenantSlug" value={tenantSlug} />
                          <input type="hidden" name="requisitionId" value={requisition.id} />
                          <input type="hidden" name="lineId" value={line.id} />
                          <input type="hidden" name="supplierId" value={line.supplier_id ?? ""} />
                          <input
                            name="quotedUnitPrice"
                            type="number"
                            min="0.0001"
                            step="0.0001"
                            defaultValue={String(line.quoted_unit_price ?? line.preliminary_unit_price ?? line.estimated_unit_cost ?? 0)}
                            className="h-8 w-28 rounded border border-border bg-surface px-2 text-xs"
                          />
                          <button type="submit" className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs">
                            Cotizar
                          </button>
                        </form>
                      ) : (
                        `$${Number(line.quoted_unit_price ?? line.preliminary_unit_price ?? line.estimated_unit_cost ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                      )}
                    </td>
                    <td className="px-2 py-1 text-foreground">${Number(line.quoted_total_cost ?? line.preliminary_total_cost ?? line.estimated_total_cost ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1 text-foreground">${Number(line.approved_total_cost ?? line.quoted_total_cost ?? line.preliminary_total_cost ?? line.estimated_total_cost ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1 text-muted">{canQuote ? "Editable (draft/reviewed)" : "Bloqueada por estatus"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </>
      )}
    </div>
  );
}
