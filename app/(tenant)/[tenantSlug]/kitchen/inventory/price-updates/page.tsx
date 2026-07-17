import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { getKitchenInventoryPriceUpdateViewData } from "@/lib/kitchen/inventory/price-updates";
import { PriceUpdatesClient } from "../_components/price-updates-client";
import { resolveKitchenPage } from "../../_lib/page-access";

type KitchenInventoryPriceUpdatesPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function KitchenInventoryPriceUpdatesPage({
  params,
}: KitchenInventoryPriceUpdatesPageProps) {
  const { tenantSlug } = await params;
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
      items={viewData.items}
      suggestedItemIds={viewData.suggestedItemIds}
      upcomingEventsWithoutInitialSnapshot={viewData.upcomingEventsWithoutInitialSnapshot}
      recentBatches={viewData.recentBatches}
    />
  );
}
