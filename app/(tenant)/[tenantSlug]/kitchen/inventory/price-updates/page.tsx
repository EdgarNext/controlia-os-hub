import { Suspense } from "react";
import type { Metadata } from "next";
import { StatePanel } from "@/components/ui/state-panel";
import { KitchenPageHeader } from "../../_components/kitchen-page-header";
import { KitchenInventoryPriceUpdatesSkeleton } from "../../_components/kitchen-loading-skeletons";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { getKitchenInventoryPriceUpdateViewData } from "@/lib/kitchen/inventory/price-updates";
import { PriceUpdatesClient } from "../_components/price-updates-client";
import { PriceUpdatesFlowShell } from "../_components/price-updates-flow-shell";
import { resolveKitchenPage } from "../../_lib/page-access";

type KitchenInventoryPriceUpdatesPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export const metadata: Metadata = { title: "Actualizar precios por factura" };

export default async function KitchenInventoryPriceUpdatesPage({
  params,
}: KitchenInventoryPriceUpdatesPageProps) {
  const { tenantSlug } = await params;

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Cocina · Inventario"
        title="Actualizar precios por factura"
        description="Captura precios y nuevas presentaciones sin modificar existencias físicas; este flujo actualiza información de costeo al aplicar la factura."
      />
      <PriceUpdatesFlowShell>
        <Suspense fallback={<KitchenInventoryPriceUpdatesSkeleton />}>
          <PriceUpdatesContent tenantSlug={tenantSlug} />
        </Suspense>
      </PriceUpdatesFlowShell>
    </div>
  );
}

async function PriceUpdatesContent({ tenantSlug }: { tenantSlug: string }) {
  const result = await resolveKitchenPage(tenantSlug, "kitchen_inventory", "items");

  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos"
        message="No tienes acceso a Actualizar precios."
      />
    );
  }

  const [viewData, accessMap] = await Promise.all([
    getKitchenInventoryPriceUpdateViewData(result.tenant.tenantId),
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "kitchen_inventory"),
  ]);

  if (!hasModulePageAccess(accessMap.items ?? "none", "manage")) {
    return (
      <StatePanel
        kind="permission"
        title="Solo lectura"
        message="Solicita permisos manage sobre insumos para aplicar facturas de precios."
      />
    );
  }

  return (
    <PriceUpdatesClient
      tenantSlug={result.tenant.tenantSlug}
      suppliers={viewData.suppliers}
      units={viewData.units}
      items={viewData.items}
      suggestedItemIds={viewData.suggestedItemIds}
      upcomingEventsWithoutInitialSnapshot={viewData.upcomingEventsWithoutInitialSnapshot}
      recentBatches={viewData.recentBatches}
    />
  );
}
