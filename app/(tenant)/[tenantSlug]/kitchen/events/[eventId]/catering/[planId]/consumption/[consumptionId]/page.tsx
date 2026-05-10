import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import {
  applyPlannedQuantitiesToConsumptionAction,
  autoAssignConsumptionLocationsAction,
  bulkAssignConsumptionLocationAction,
  cancelConsumptionDraftAction,
  confirmConsumptionRecordAction,
} from "@/lib/kitchen/event-catering/actions";
import { getConsumptionDraftReadiness, getConsumptionLineAvailability, getConsumptionRecord, listConsumptionLines } from "@/lib/kitchen/event-catering/queries";
import { listKitchenInventoryLocations } from "@/lib/kitchen/inventory/queries";
import { ConsumptionLineEditor } from "../_components/consumption-line-editor";
import { resolveKitchenPage } from "../../../../../../_lib/page-access";
import { KitchenSubmitButton } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-submit-button";

type KitchenConsumptionDetailPageProps = {
  params: Promise<{ tenantSlug: string; eventId: string; planId: string; consumptionId: string }>;
};

function formatQuantity(value: number) {
  return value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function summarizeQuantitiesByUnit(
  lines: Awaited<ReturnType<typeof listConsumptionLines>>,
  quantitySelector: (line: Awaited<ReturnType<typeof listConsumptionLines>>[number]) => number,
) {
  const totals = new Map<string, number>();
  for (const line of lines) {
    const unitCode = line.kitchen_inventory_units?.code ?? "ud";
    totals.set(unitCode, (totals.get(unitCode) ?? 0) + quantitySelector(line));
  }
  return [...totals.entries()]
    .filter(([, value]) => value > 0)
    .map(([unitCode, value]) => `${formatQuantity(value)} ${unitCode}`);
}

export default async function KitchenConsumptionDetailPage({ params }: KitchenConsumptionDetailPageProps) {
  const { tenantSlug, eventId, planId, consumptionId } = await params;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "consumption");
  if (!result.ok) {
    return <StatePanel kind="permission" title="Sin permisos" message="No tienes acceso al detalle de consumo." />;
  }

  const [record, lines, availabilityRows, accessMap, locations] = await Promise.all([
    getConsumptionRecord(result.tenant.tenantSlug, consumptionId),
    listConsumptionLines(result.tenant.tenantSlug, consumptionId),
    getConsumptionLineAvailability(result.tenant.tenantSlug, consumptionId),
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "event_catering"),
    listKitchenInventoryLocations(result.tenant.tenantId),
  ]);
  const canManage = hasModulePageAccess(accessMap.consumption ?? "none", "manage");

  if (!record || record.event_id !== eventId || record.plan_id !== planId) {
    return <StatePanel kind="empty" title="Consumo no encontrado" message="El consumo no existe para este plan/evento." />;
  }

  const isDraft = record.status === "draft";
  const statusLabel = record.status === "draft" ? "Pendiente de confirmar" : record.status === "confirmed" ? "Confirmado" : "Cancelado";
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
  const consumedTotalsByUnit = summarizeQuantitiesByUnit(lines, (line) => Number(line.consumed_quantity ?? 0));
  const wasteTotalsByUnit = summarizeQuantitiesByUnit(lines, (line) => Number(line.waste_quantity ?? 0));
  const leftoverTotalsByUnit = summarizeQuantitiesByUnit(lines, (line) => Number(line.leftover_quantity ?? 0));
  const readyLineCount = availabilityRows.filter((row) => row.total_out_quantity > 0 && !row.missing_location && row.has_sufficient_balance).length;
  const adjustedLineCount = lines.filter((line) => Number(line.waste_quantity ?? 0) > 0 || Number(line.leftover_quantity ?? 0) > 0).length;
  const planName = record.event_catering_plans?.name?.trim() || "Servicio de catering";
  const eventName = record.events?.name?.trim() || "Evento";
  const eventDate = record.events?.starts_at ? new Date(record.events.starts_at).toLocaleDateString("es-MX") : null;

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Consumo · {planName} · {eventName}</h1>
            <p className="mt-1 text-xs text-muted">Evento: {eventDate ?? "Fecha pendiente"} · {statusLabel}</p>
            <p className="mt-1 text-[11px] text-muted">ID técnico: {record.id.slice(0, 8)}</p>
          </div>
          <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-foreground">{statusLabel}</span>
        </div>
        <p className="mt-3 text-xs text-warning">
          El consumo preparado no descuenta inventario. Al confirmar, se registrarán salidas reales de inventario y mermas.
        </p>
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded border border-border bg-muted/20 p-2">
            <p className="text-muted">Líneas listas</p>
            <p className="mt-1 font-semibold text-foreground">{readyLineCount}/{lines.length}</p>
          </div>
          <div className="rounded border border-border bg-muted/20 p-2">
            <p className="text-muted">Total a consumir</p>
            <div className="mt-1 font-semibold text-foreground">
              {consumedTotalsByUnit.length === 0 ? "0.00" : consumedTotalsByUnit.map((total) => <p key={total}>{total}</p>)}
            </div>
          </div>
          <div className="rounded border border-border bg-muted/20 p-2">
            <p className="text-muted">Merma</p>
            <div className="mt-1 font-semibold text-foreground">
              {wasteTotalsByUnit.length === 0 ? "0.00" : wasteTotalsByUnit.map((total) => <p key={total}>{total}</p>)}
            </div>
          </div>
          <div className="rounded border border-border bg-muted/20 p-2">
            <p className="text-muted">Sobrante</p>
            <div className="mt-1 font-semibold text-foreground">
              {leftoverTotalsByUnit.length === 0 ? "0.00" : leftoverTotalsByUnit.map((total) => <p key={total}>{total}</p>)}
            </div>
          </div>
          <div className="rounded border border-border bg-muted/20 p-2">
            <p className="text-muted">Sin ubicación</p>
            <p className="mt-1 font-semibold text-foreground">{readiness.missing_location_count}</p>
          </div>
          <div className="rounded border border-border bg-muted/20 p-2">
            <p className="text-muted">Sin stock</p>
            <p className="mt-1 font-semibold text-foreground">{readiness.insufficient_stock_count}</p>
          </div>
        </div>
        {record.status === "confirmed" ? (
          <p className="mt-1 text-xs text-emerald-600">
            Consumo confirmado: inventario impactado con salidas y mermas registradas.
          </p>
        ) : null}
        <div className="mt-3 rounded border border-border bg-surface-2 p-3 text-xs text-muted">
          <p className="font-semibold text-foreground">Estado operativo: {readinessText}</p>
          <p className="mt-1">
            Líneas con salida: {readiness.positive_output_count} · ajustes registrados: {adjustedLineCount} · faltan ubicación:{" "}
            {readiness.missing_location_count} · stock insuficiente: {readiness.insufficient_stock_count}
          </p>
          {canManage && isDraft ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <form action={confirmConsumptionRecordAction}>
                <input type="hidden" name="tenantSlug" value={tenantSlug} />
                <input type="hidden" name="consumptionId" value={record.id} />
                <KitchenSubmitButton pendingLabel="Confirmando..." disabled={!readiness.ready_to_confirm} className="px-3 py-1 text-xs">
                  {readiness.ready_to_confirm ? "Confirmar salida de inventario" : "Confirmar salida (bloqueado)"}
                </KitchenSubmitButton>
              </form>
              <form action={applyPlannedQuantitiesToConsumptionAction}>
                <input type="hidden" name="tenantSlug" value={tenantSlug} />
                <input type="hidden" name="consumptionId" value={record.id} />
                <KitchenSubmitButton pendingLabel="Aplicando..." variant="secondary" className="px-2 py-1 text-xs">
                  Restaurar cantidades planeadas
                </KitchenSubmitButton>
              </form>
              <form action={autoAssignConsumptionLocationsAction}>
                <input type="hidden" name="tenantSlug" value={tenantSlug} />
                <input type="hidden" name="consumptionId" value={record.id} />
                <KitchenSubmitButton pendingLabel="Auto-asignando..." variant="secondary" className="px-2 py-1 text-xs">
                  Auto-asignar ubicaciones
                </KitchenSubmitButton>
              </form>
            </div>
          ) : null}
          {canManage && isDraft ? (
            <p className="mt-2 text-[11px] text-muted">
              Si hay un error después de confirmar, deberá corregirse desde Correcciones.
            </p>
          ) : null}
        </div>
        {canManage && isDraft ? (
          <details className="mt-3 rounded border border-border bg-muted/10 p-3 text-xs">
            <summary className="cursor-pointer font-medium text-foreground">Acciones de excepción</summary>
            <div className="mt-3 flex flex-wrap items-center gap-2">
            <form action={bulkAssignConsumptionLocationAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="tenantSlug" value={tenantSlug} />
              <input type="hidden" name="consumptionId" value={record.id} />
              <input type="hidden" name="applyTo" value="missing_location" />
              <select name="locationId" defaultValue="" className="h-8 rounded border border-border bg-surface px-2 text-xs">
                <option value="" disabled>Ubicación para pendientes</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
              <KitchenSubmitButton pendingLabel="Asignando..." variant="secondary" className="px-3 py-1 text-xs">
                Asignar a líneas pendientes
              </KitchenSubmitButton>
            </form>
            <form action={cancelConsumptionDraftAction}>
              <input type="hidden" name="tenantSlug" value={tenantSlug} />
              <input type="hidden" name="consumptionId" value={record.id} />
              <KitchenSubmitButton pendingLabel="Cancelando..." variant="secondary" className="px-3 py-1 text-xs">
                Cancelar consumo preparado
              </KitchenSubmitButton>
            </form>
            </div>
          </details>
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
                  <th className="px-2 py-1">Requerido / planeado</th>
                  <th className="px-2 py-1">Cantidad a consumir</th>
                  <th className="px-2 py-1">Stock en ubicación</th>
                  <th className="px-2 py-1">Ubicación asignada</th>
                  <th className="px-2 py-1">Ajustar</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const availability = availabilityByLine.get(line.id) ?? null;
                  const totalOut = Number(line.consumed_quantity) + Number(line.waste_quantity);
                  const hasAdjustment = Number(line.waste_quantity) > 0 || Number(line.leftover_quantity) > 0;
                  const unitCode = line.kitchen_inventory_units?.code ?? "ud";
                  const locationName = line.kitchen_inventory_locations?.name ?? null;
                  const stockLabel = availability
                    ? line.location_id
                      ? `${formatQuantity(availability.physical_balance)} ${unitCode} en ${locationName ?? "ubicación asignada"}`
                      : `${formatQuantity(availability.physical_balance)} ${unitCode} total`
                    : `0.00 ${unitCode}`;
                  return (
                  <tr key={line.id} className="border-t border-border">
                    <td className="px-2 py-1 text-foreground">
                      {line.kitchen_inventory_items?.name ?? line.item_id.slice(0, 8)}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {totalOut <= 0 ? <span className="rounded-full bg-muted/30 px-2 py-0.5 text-[11px] text-muted">Sin consumo</span> : null}
                        {availability?.missing_location ? <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] text-warning">Sin ubicación</span> : null}
                        {availability && !availability.has_sufficient_balance ? (
                          <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] text-danger">Stock insuficiente</span>
                        ) : null}
                        {hasAdjustment ? <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] text-warning">Ajustado</span> : null}
                      </div>
                    </td>
                    <td className="px-2 py-1 text-muted">{formatQuantity(Number(line.planned_quantity))} {unitCode}</td>
                    <td className="px-2 py-1 text-foreground">
                      {formatQuantity(Number(line.consumed_quantity))} {unitCode}
                      {hasAdjustment ? (
                        <p className="text-[11px] text-muted">
                          merma {Number(line.waste_quantity).toLocaleString("es-MX", { maximumFractionDigits: 4 })} · sobrante{" "}
                          {Number(line.leftover_quantity).toLocaleString("es-MX", { maximumFractionDigits: 4 })}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-1 text-muted">
                      <span>{stockLabel}</span>
                      {availability && availability.has_sufficient_balance && !availability.missing_location ? (
                        <span className="ml-2 rounded-full bg-success/10 px-2 py-0.5 text-[11px] text-success">Suficiente</span>
                      ) : null}
                      {availability && !availability.has_sufficient_balance ? (
                        <div className="mt-1 text-[11px] text-warning">
                          <p>Disponible para este consumo: {formatQuantity(availability.available_quantity)} {unitCode}</p>
                          <p>Apartado para otros planes: {formatQuantity(availability.reserved_other_plans)} {unitCode}</p>
                          <p>Requiere: {formatQuantity(totalOut)} {unitCode}</p>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-1 text-muted">{locationName ?? "Sin ubicación"}</td>
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
