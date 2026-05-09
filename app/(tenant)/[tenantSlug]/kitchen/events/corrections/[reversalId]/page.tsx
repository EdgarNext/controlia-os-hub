import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { applyConsumptionReversalAction, applyReceiptReversalAction, cancelInventoryReversalDraftAction } from "@/lib/kitchen/event-catering/actions";
import { getInventoryReversal, getReversalTargetSummary, listInventoryReversalLines } from "@/lib/kitchen/event-catering/queries";
import { KitchenCriticalActionGroup } from "../../../_components/kitchen-critical-action-group";
import { resolveKitchenPage } from "../../../_lib/page-access";

type KitchenEventCorrectionDetailPageProps = {
  params: Promise<{ tenantSlug: string; reversalId: string }>;
};

export default async function KitchenEventCorrectionDetailPage({ params }: KitchenEventCorrectionDetailPageProps) {
  const { tenantSlug, reversalId } = await params;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "requisitions");
  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para correcciones"
        message="No tienes acceso al detalle de correcciones de catering."
      />
    );
  }

  const [reversal, lines] = await Promise.all([
    getInventoryReversal(result.tenant.tenantSlug, reversalId),
    listInventoryReversalLines(result.tenant.tenantSlug, reversalId),
  ]);
  const accessMap = await getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "event_catering");
  const canManageConsumption = hasModulePageAccess(accessMap.consumption ?? "none", "manage");
  const canManageRequisitions = hasModulePageAccess(accessMap.requisitions ?? "none", "manage");

  if (!reversal) {
    return <StatePanel kind="empty" title="Reversa no encontrada" message="No existe una reversa con ese identificador para este tenant." />;
  }
  const targetSummary = await getReversalTargetSummary(result.tenant.tenantSlug, reversal.target_type, reversal.target_id);

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">Reversa {reversal.id.slice(0, 8)}</h1>
        <p className="mt-1 text-xs text-muted">
          Tipo: {reversal.reversal_type} · Target: {reversal.target_type}:{" "}
          {reversal.target_id.slice(0, 8)} · Status: {reversal.status}
        </p>
        <p className="mt-1 text-xs text-muted">Motivo: {reversal.reason}</p>
        {reversal.status === "applied" ? (
          <p className="mt-1 text-xs text-muted">
            Aplicada: {reversal.applied_at ?? "—"} · Aplicada por: {reversal.applied_by ?? "—"}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted">
          Las reversas aplicadas crean movimientos compensatorios y conservan los movimientos originales para trazabilidad.
        </p>
        <p className="mt-1 text-xs text-muted">
          Target: {reversal.target_type}:{reversal.target_id.slice(0, 8)} · Movimientos target: {targetSummary?.movement_count ?? 0}
        </p>
        {reversal.reversal_type === "consumption" && reversal.status === "draft" ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted">
              Al aplicar, se crearán movimientos <code>adjustment_in</code> con <code>source_type=correction</code>. No se borran movimientos originales.
            </p>
            {canManageConsumption ? (
              <KitchenCriticalActionGroup
                className="flex flex-wrap items-center gap-2"
                buttonClassName="px-3 py-1.5 text-sm"
                actions={[
                  {
                    id: "apply-consumption-reversal",
                    action: applyConsumptionReversalAction,
                    fields: [
                      { name: "tenantSlug", value: tenantSlug },
                      { name: "reversalId", value: reversal.id },
                    ],
                    label: "Aplicar reversa de consumo",
                    pendingLabel: "Aplicando reversa...",
                  },
                  {
                    id: "cancel-consumption-reversal",
                    action: cancelInventoryReversalDraftAction,
                    fields: [
                      { name: "tenantSlug", value: tenantSlug },
                      { name: "reversalId", value: reversal.id },
                    ],
                    label: "Cancelar reversa",
                    pendingLabel: "Cancelando...",
                  },
                ]}
              />
            ) : (
              <p className="text-xs text-muted">No tienes permisos manage en consumption para aplicar esta reversa.</p>
            )}
          </div>
        ) : null}
        {reversal.reversal_type === "receipt" && reversal.status === "draft" ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted">
              Al aplicar, se crearán movimientos <code>adjustment_out</code> con <code>source_type=correction</code> y se reducirá inventario. No se borran movimientos originales.
            </p>
            {canManageRequisitions ? (
              <KitchenCriticalActionGroup
                className="flex flex-wrap items-center gap-2"
                buttonClassName="px-3 py-1.5 text-sm"
                actions={[
                  {
                    id: "apply-receipt-reversal",
                    action: applyReceiptReversalAction,
                    fields: [
                      { name: "tenantSlug", value: tenantSlug },
                      { name: "reversalId", value: reversal.id },
                    ],
                    label: "Aplicar reversa de recepción",
                    pendingLabel: "Aplicando reversa...",
                  },
                  {
                    id: "cancel-receipt-reversal",
                    action: cancelInventoryReversalDraftAction,
                    fields: [
                      { name: "tenantSlug", value: tenantSlug },
                      { name: "reversalId", value: reversal.id },
                    ],
                    label: "Cancelar reversa",
                    pendingLabel: "Cancelando...",
                  },
                ]}
              />
            ) : (
              <p className="text-xs text-muted">No tienes permisos manage en requisitions para aplicar esta reversa.</p>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Líneas de reversa</h2>
        {lines.length === 0 ? (
          <p className="mt-2 text-xs text-muted">Sin líneas registradas.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-2 py-1">Insumo</th>
                  <th className="px-2 py-1">Ubicación</th>
                  <th className="px-2 py-1">Unidad</th>
                  <th className="px-2 py-1">Cantidad</th>
                  <th className="px-2 py-1">Mov. original</th>
                  <th className="px-2 py-1">Mov. compensatorio</th>
                  <th className="px-2 py-1">Impacto</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-t border-border">
                    <td className="px-2 py-1 text-foreground">{line.kitchen_inventory_items?.name ?? line.item_id.slice(0, 8)}</td>
                    <td className="px-2 py-1 text-muted">{line.kitchen_inventory_locations?.name ?? line.location_id.slice(0, 8)}</td>
                    <td className="px-2 py-1 text-muted">{line.kitchen_inventory_units?.code ?? line.unit_id.slice(0, 8)}</td>
                    <td className="px-2 py-1 text-foreground">{line.quantity.toLocaleString("es-MX", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                    <td className="px-2 py-1 text-muted">
                      {line.original_movement_id.slice(0, 8)} ({line.original_movement?.movement_type ?? "—"}/{line.original_movement?.source_type ?? "—"})
                    </td>
                    <td className="px-2 py-1 text-muted">
                      {line.compensating_movement_id ? `${line.compensating_movement_id.slice(0, 8)} (${line.compensating_movement?.movement_type ?? "—"}/${line.compensating_movement?.source_type ?? "—"})` : "—"}
                    </td>
                    <td className="px-2 py-1 text-muted">
                      {line.compensating_movement?.movement_type === "adjustment_in"
                        ? "Aumenta inventario"
                        : line.compensating_movement?.movement_type === "adjustment_out"
                          ? "Reduce inventario"
                          : "Pendiente"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          Los movimientos originales permanecen auditables; la corrección solo agrega compensaciones trazables.
        </p>
      </section>
    </div>
  );
}
