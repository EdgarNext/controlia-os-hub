import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import {
  listKitchenInventoryItems,
  listKitchenInventorySuppliers,
  listKitchenInventoryUnits,
  listPurchaseOptions,
  listSupplierPrices,
} from "@/lib/kitchen/inventory/queries";
import {
  CreateUnifiedPurchaseAndPriceForm,
  PurchaseOptionsAndPricesTable,
} from "../_components/inventory-forms";
import { resolveKitchenPage } from "../../_lib/page-access";

type KitchenInventoryPresentacionesPreciosPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function KitchenInventoryPresentacionesPreciosPage({
  params,
}: KitchenInventoryPresentacionesPreciosPageProps) {
  const { tenantSlug } = await params;
  const result = await resolveKitchenPage(tenantSlug, "kitchen_inventory", "items");

  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos"
        message="No tienes acceso a Presentaciones y Precios."
      />
    );
  }

  const [items, suppliers, units, purchaseOptions, supplierPrices, accessMap] = await Promise.all([
    listKitchenInventoryItems(result.tenant.tenantId),
    listKitchenInventorySuppliers(result.tenant.tenantId),
    listKitchenInventoryUnits(result.tenant.tenantId),
    listPurchaseOptions(result.tenant.tenantId),
    listSupplierPrices(result.tenant.tenantId),
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "kitchen_inventory"),
  ]);

  const dedupeById = <T extends { id: string }>(rows: T[]): T[] => {
    const seen = new Set<string>();
    const unique: T[] = [];
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      unique.push(row);
    }
    return unique;
  };

  const uniqueItems = dedupeById(items);
  const uniqueSuppliers = dedupeById(suppliers);
  const uniqueUnits = dedupeById(units);
  const canManageItems = hasModulePageAccess(accessMap.items ?? "none", "manage");

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">Presentaciones y Precios</h1>
        <p className="mt-2 text-sm text-muted">
          Define cómo se compra un insumo, con qué proveedor, a qué equivalencia de inventario y con qué precio vigente.
        </p>
      </section>

      {canManageItems ? (
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <CreateUnifiedPurchaseAndPriceForm
            tenantSlug={result.tenant.tenantSlug}
            items={uniqueItems}
            suppliers={uniqueSuppliers}
            units={uniqueUnits}
            purchaseOptions={purchaseOptions}
          />
        </section>
      ) : (
        <StatePanel
          kind="permission"
          title="Solo lectura"
          message="Solicita permisos manage para crear o editar presentaciones y precios."
        />
      )}

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <PurchaseOptionsAndPricesTable options={purchaseOptions} prices={supplierPrices} />
      </section>
    </div>
  );
}
