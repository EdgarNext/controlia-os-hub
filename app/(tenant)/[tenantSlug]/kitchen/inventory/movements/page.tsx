import { Suspense } from "react";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import {
  listKitchenInventoryItems,
  listKitchenInventoryLocations,
  listKitchenInventoryRecentMovements,
  listKitchenInventoryUnits,
} from "@/lib/kitchen/inventory/queries";
import { StatePanel } from "@/components/ui/state-panel";
import { RecordKitchenInventoryMovementForm } from "../_components/inventory-forms";
import { KitchenActionRowSkeleton, KitchenTableSkeleton } from "../../_components/kitchen-loading-skeletons";
import { KitchenPageHeader } from "../../_components/kitchen-page-header";
import { resolveKitchenPage } from "../../_lib/page-access";
import { formatKitchenUnit, formatQuantityWithUnit } from "@/lib/kitchen/formatters";

type KitchenInventoryMovementsPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function KitchenInventoryMovementsPage({
  params,
}: KitchenInventoryMovementsPageProps) {
  const { tenantSlug } = await params;
  const result = await resolveKitchenPage(tenantSlug, "kitchen_inventory", "movements");

  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para movimientos"
        message="No tienes acceso a la página de movimientos de inventario."
      />
    );
  }

  const accessMap = await getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "kitchen_inventory");
  const canManage = hasModulePageAccess(accessMap.movements ?? "none", "manage");

  const formDataPromise = canManage
    ? Promise.all([
        listKitchenInventoryItems(result.tenant.tenantId),
        listKitchenInventoryLocations(result.tenant.tenantId),
        listKitchenInventoryUnits(result.tenant.tenantId),
      ])
    : null;
  const movementsPromise = listKitchenInventoryRecentMovements(result.tenant.tenantId, 80);

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Inventario"
        title="Movimientos"
        description="Ledger operacional de entradas, salidas, ajustes y mermas con bloqueo de inventario negativo por default."
      />

      {canManage && formDataPromise ? (
        <Suspense fallback={<KitchenActionRowSkeleton actions={2} />}>
          <MovementFormSection tenantSlug={result.tenant.tenantSlug} formDataPromise={formDataPromise} />
        </Suspense>
      ) : (
        <StatePanel
          kind="permission"
          title="Solo lectura"
          message="Tienes acceso de lectura. Solicita permisos de manage para registrar movimientos."
        />
      )}

      <Suspense fallback={<KitchenTableSkeleton rows={10} columns={8} />}>
        <MovementHistorySection movementsPromise={movementsPromise} />
      </Suspense>
    </div>
  );
}

async function MovementFormSection({
  tenantSlug,
  formDataPromise,
}: {
  tenantSlug: string;
  formDataPromise: Promise<
    [
      Awaited<ReturnType<typeof listKitchenInventoryItems>>,
      Awaited<ReturnType<typeof listKitchenInventoryLocations>>,
      Awaited<ReturnType<typeof listKitchenInventoryUnits>>
    ]
  >;
}) {
  const [items, locations, units] = await formDataPromise;
  return (
    <RecordKitchenInventoryMovementForm
      tenantSlug={tenantSlug}
      items={items}
      units={units}
      locations={locations}
    />
  );
}

async function MovementHistorySection({
  movementsPromise,
}: {
  movementsPromise: ReturnType<typeof listKitchenInventoryRecentMovements>;
}) {
  const movements = await movementsPromise;
  if (movements.length === 0) {
    return (
      <StatePanel
        kind="empty"
        title="Sin movimientos todavía"
        message="Registra un movimiento manual para inicializar saldos por ubicación."
      />
    );
  }

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">Historial reciente</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="py-2">Fecha</th>
              <th className="py-2">Insumo</th>
              <th className="py-2">Ubicación</th>
              <th className="py-2">Tipo</th>
              <th className="py-2">Unidad</th>
              <th className="py-2 text-right">Cantidad</th>
              <th className="py-2 text-right">Delta</th>
              <th className="py-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id} className="border-t border-border">
                <td className="py-2 text-muted">{new Date(movement.occurred_at).toLocaleString("es-MX")}</td>
                <td className="py-2 text-foreground">{movement.kitchen_inventory_items?.name ?? "Insumo"}</td>
                <td className="py-2 text-foreground">{movement.kitchen_inventory_locations?.name ?? "Ubicación"}</td>
                <td className="py-2 text-foreground">{movement.movement_type}</td>
                <td className="py-2 text-foreground">{formatKitchenUnit(movement.kitchen_inventory_units?.code)}</td>
                <td className="py-2 text-right text-foreground">{formatQuantityWithUnit(movement.quantity, movement.kitchen_inventory_units?.code, 4)}</td>
                <td className="py-2 text-right font-medium text-foreground">
                  {Number(movement.quantity_delta) > 0 ? "+" : ""}
                  {formatQuantityWithUnit(Math.abs(Number(movement.quantity_delta)), movement.kitchen_inventory_units?.code, 4)}
                </td>
                <td className="py-2 text-muted">{movement.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
