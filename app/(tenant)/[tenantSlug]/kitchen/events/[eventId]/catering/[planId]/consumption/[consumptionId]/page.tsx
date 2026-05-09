import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { cancelConsumptionDraftAction, confirmConsumptionRecordAction } from "@/lib/kitchen/event-catering/actions";
import { getConsumptionDraftReadiness, getConsumptionLineAvailability, getConsumptionRecord, listConsumptionLines } from "@/lib/kitchen/event-catering/queries";
import { ConsumptionLineEditor } from "../_components/consumption-line-editor";
import { resolveKitchenPage } from "../../../../../../_lib/page-access";

type KitchenConsumptionDetailPageProps = {
  params: Promise<{ tenantSlug: string; eventId: string; planId: string; consumptionId: string }>;
};

export default async function KitchenConsumptionDetailPage({ params }: KitchenConsumptionDetailPageProps) {
  const { tenantSlug, eventId, planId, consumptionId } = await params;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "consumption");
  if (!result.ok) {
    return <StatePanel kind="permission" title="Sin permisos" message="No tienes acceso al detalle de consumo." />;
  }

  const [record, lines, availabilityRows, accessMap] = await Promise.all([
    getConsumptionRecord(result.tenant.tenantSlug, consumptionId),
    listConsumptionLines(result.tenant.tenantSlug, consumptionId),
    getConsumptionLineAvailability(result.tenant.tenantSlug, consumptionId),
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "event_catering"),
  ]);
  const canManage = hasModulePageAccess(accessMap.consumption ?? "none", "manage");

  if (!record || record.event_id !== eventId || record.plan_id !== planId) {
    return <StatePanel kind="empty" title="Consumo no encontrado" message="El consumo no existe para este plan/evento." />;
  }

  const isDraft = record.status === "draft";
  const availabilityByLine = new Map(availabilityRows.map((row) => [row.line_id, row]));
  const readiness = getConsumptionDraftReadiness(record.status, availabilityRows);
  const readinessText =
    readiness.reason === "ready"
      ? "Listo para confirmar"
      : readiness.reason === "pending_location"
        ? "Pendiente de ubicación"
        : readiness.reason === "insufficient_stock"
          ? "Stock insuficiente"
          : readiness.reason === "invalid_quantity"
            ? "Cantidad inválida"
            : "Sin consumo capturado";
  const consumedTotal = lines.reduce((acc, line) => acc + Number(line.consumed_quantity ?? 0), 0);
  const wasteTotal = lines.reduce((acc, line) => acc + Number(line.waste_quantity ?? 0), 0);

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">Consumo {record.id.slice(0, 8)}</h1>
        <p className="mt-1 text-xs text-muted">status={record.status}</p>
        <p className="mt-1 text-xs text-warning">
          Al confirmar consumo se descontará inventario y se crearán movimientos de salida.
        </p>
        {record.status === "confirmed" ? (
          <p className="mt-1 text-xs text-emerald-600">
            Consumo confirmado: inventario impactado. consumido={consumedTotal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ·
            merma={wasteTotal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
          </p>
        ) : null}
        <div className="mt-3 rounded border border-border bg-surface-2 p-3 text-xs text-muted">
          <p className="font-semibold text-foreground">Estado draft: {readinessText}</p>
          <p className="mt-1">
            Líneas con salida: {readiness.positive_output_count} · faltan ubicación: {readiness.missing_location_count} · stock insuficiente:{" "}
            {readiness.insufficient_stock_count}
          </p>
          {canManage && isDraft ? (
            <form action={confirmConsumptionRecordAction} className="mt-2">
              <input type="hidden" name="tenantSlug" value={tenantSlug} />
              <input type="hidden" name="consumptionId" value={record.id} />
              <button
                type="submit"
                disabled={!readiness.ready_to_confirm}
                className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-70"
              >
                {readiness.ready_to_confirm ? "Confirmar consumo" : "Confirmar consumo (bloqueado)"}
              </button>
            </form>
          ) : null}
        </div>
        {canManage && isDraft ? (
          <form action={cancelConsumptionDraftAction} className="mt-3">
            <input type="hidden" name="tenantSlug" value={tenantSlug} />
            <input type="hidden" name="consumptionId" value={record.id} />
            <button type="submit" className="inline-flex rounded border border-border bg-surface px-3 py-1 text-xs">
              Cancelar draft
            </button>
          </form>
        ) : null}
      </section>

      {lines.length === 0 ? (
        <StatePanel kind="empty" title="Sin líneas" message="No hay líneas de consumo en este registro." />
      ) : (
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-2 py-1">Insumo</th>
                  <th className="px-2 py-1">Planificado</th>
                  <th className="px-2 py-1">Disponible</th>
                  <th className="px-2 py-1">Consumido</th>
                  <th className="px-2 py-1">Merma</th>
                  <th className="px-2 py-1">Sobrante</th>
                  <th className="px-2 py-1">Salida total</th>
                  <th className="px-2 py-1">Costo unit.</th>
                  <th className="px-2 py-1">Ubicación</th>
                  <th className="px-2 py-1">Disp. ubicación</th>
                  <th className="px-2 py-1">Estado</th>
                  <th className="px-2 py-1">Mov. consumo</th>
                  <th className="px-2 py-1">Mov. merma</th>
                  <th className="px-2 py-1">Acción</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const availability = availabilityByLine.get(line.id) ?? null;
                  const totalOut = Number(line.consumed_quantity) + Number(line.waste_quantity);
                  const stateLabel =
                    totalOut <= 0
                      ? "Sin salida"
                      : availability?.missing_location
                        ? "Falta ubicación"
                        : availability && !availability.has_sufficient_balance
                          ? "Stock insuficiente"
                          : "OK";
                  const stateClass =
                    stateLabel === "OK"
                      ? "text-success"
                      : stateLabel === "Sin salida"
                        ? "text-muted"
                        : "text-warning";
                  return (
                  <tr key={line.id} className="border-t border-border">
                    <td className="px-2 py-1 text-foreground">{line.kitchen_inventory_items?.name ?? line.item_id.slice(0, 8)}</td>
                    <td className="px-2 py-1 text-muted">{Number(line.planned_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {line.kitchen_inventory_units?.code ?? "ud"}</td>
                    <td className="px-2 py-1 text-muted">{Number(line.available_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                    <td className="px-2 py-1 text-foreground">{Number(line.consumed_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                    <td className="px-2 py-1 text-foreground">{Number(line.waste_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                    <td className="px-2 py-1 text-foreground">{Number(line.leftover_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                    <td className="px-2 py-1 text-foreground">{Number(totalOut).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                    <td className="px-2 py-1 text-foreground">{Number(line.unit_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                    <td className="px-2 py-1 text-muted">{line.kitchen_inventory_locations?.name ?? "Sin ubicación"}</td>
                    <td className="px-2 py-1 text-muted">
                      {availability
                        ? Number(availability.available_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                        : "0.00"}
                    </td>
                    <td className={`px-2 py-1 ${stateClass}`}>{stateLabel}</td>
                    <td className="px-2 py-1 text-muted">{line.consumption_movement_id ? line.consumption_movement_id.slice(0, 8) : "—"}</td>
                    <td className="px-2 py-1 text-muted">{line.waste_movement_id ? line.waste_movement_id.slice(0, 8) : "—"}</td>
                    <td className="px-2 py-1">
                      {canManage && isDraft ? (
                        <ConsumptionLineEditor tenantSlug={tenantSlug} consumptionId={record.id} line={line} availability={availability} />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
