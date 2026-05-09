import { Suspense } from "react";
import Link from "next/link";
import {
  getCurrentTenantModulePageAccessMap,
  hasModulePageAccess,
} from "@/lib/auth/module-page-access";
import {
  getKitchenInventoryItemsInteractiveData,
} from "@/lib/kitchen/inventory/queries";
import { StatePanel } from "@/components/ui/state-panel";
import {
  KitchenActionRowSkeleton,
  KitchenCardGridSkeleton,
  KitchenTableSkeleton,
} from "../../_components/kitchen-loading-skeletons";
import { resolveKitchenPage } from "../../_lib/page-access";
import { InventoryItemsInteractive } from "../_components/inventory-items-interactive";
import { KitchenMetricCard } from "../../_components/kitchen-metric-card";
import { KitchenPageHeader } from "../../_components/kitchen-page-header";

type KitchenInventoryItemsPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ q?: string; category?: string; supplier?: string }>;
};

type InitialFilters = {
  q: string;
  categoryId: string;
  supplierId: string;
};

type InventoryItemsContentData = {
  interactiveData: Awaited<ReturnType<typeof getKitchenInventoryItemsInteractiveData>>;
  accessMap: Awaited<ReturnType<typeof getCurrentTenantModulePageAccessMap>>;
};

export default async function KitchenInventoryItemsPage({ params, searchParams }: KitchenInventoryItemsPageProps) {
  const { tenantSlug } = await params;
  const rawSearchParams = await searchParams;
  const result = await resolveKitchenPage(tenantSlug, "kitchen_inventory", "items");

  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para items"
        message="No tienes acceso a la página de items de inventario."
      />
    );
  }

  const initialFilters: InitialFilters = {
    q: rawSearchParams.q?.trim() ?? "",
    categoryId: rawSearchParams.category?.trim() ?? "",
    supplierId: rawSearchParams.supplier?.trim() ?? "",
  };

  const contentPromise: Promise<InventoryItemsContentData> = Promise.all([
    getKitchenInventoryItemsInteractiveData(result.tenant.tenantId),
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "kitchen_inventory"),
  ]).then(([interactiveData, accessMap]) => ({
    interactiveData,
    accessMap,
  }));

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Inventario"
        title="Insumos y Existencias"
        description="Catálogo operativo con existencia actual, costo unitario, valor inventario y estado de configuración de compra."
      />

      <Suspense fallback={<InventoryItemsContentFallback />}>
        <InventoryItemsContentSection
          tenantSlug={tenantSlug}
          initialFilters={initialFilters}
          dataPromise={contentPromise}
        />
      </Suspense>
    </div>
  );
}

async function InventoryItemsContentSection({
  tenantSlug,
  initialFilters,
  dataPromise,
}: {
  tenantSlug: string;
  initialFilters: InitialFilters;
  dataPromise: Promise<InventoryItemsContentData>;
}) {
  const { interactiveData, accessMap } = await dataPromise;
  const canManageItems = hasModulePageAccess(accessMap.items ?? "none", "manage");
  const clientRows = interactiveData.rows.map((row) => ({
    item: {
      id: row.item.id,
      name: row.item.name,
      normalized_name: row.item.normalized_name,
      sku: row.item.sku,
      category_id: row.item.category_id,
      default_supplier_id: row.item.default_supplier_id,
      unit_code: row.item.kitchen_inventory_units?.code ?? null,
      category_name: row.item.kitchen_inventory_categories?.name ?? null,
      supplier_name: row.item.kitchen_inventory_suppliers?.name ?? null,
    },
    totalBalance: row.totalBalance,
    locationCount: row.locationCount,
    locationNames: row.locationNames,
    estimatedValue: row.estimatedValue,
    currentUnitCost: row.currentUnitCost,
    isAllowedZeroCost: row.isAllowedZeroCost,
    hasCurrentSupplierPrice: row.hasCurrentSupplierPrice,
    currentSupplierPrice: row.currentSupplierPrice
      ? {
          price_per_purchase_unit: Number(row.currentSupplierPrice.price_per_purchase_unit ?? 0),
          purchase_unit_code: row.currentSupplierPrice.purchase_unit?.code ?? null,
        }
      : null,
    stateTags: row.stateTags,
  }));

  return (
    <>
      <KitchenPageHeader
        title="Operación de Insumos"
        metadata={
          <>
            Carga inventario desde{" "}
            <Link href={`/${tenantSlug}/kitchen/inventory/imports`} className="underline underline-offset-2">
              Importaciones
            </Link>
            .{canManageItems ? (
              <>
                {" "}Alta y mantenimiento en{" "}
                <Link href={`/${tenantSlug}/kitchen/inventory/setup`} className="underline underline-offset-2">
                  Configuración de inventario
                </Link>
                .
              </>
            ) : null}
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-3">
        <KitchenMetricCard label="Insumos activos" value={interactiveData.overview.activeItemsCount} />
        <KitchenMetricCard
          label="Valor inventario"
          value={`$${interactiveData.overview.totalInventoryValue.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <KitchenMetricCard
          label="Alertas stock bajo"
          value={interactiveData.overview.lowStockCount}
          tone={interactiveData.overview.lowStockCount > 0 ? "warning" : "default"}
        />
      </section>

      <InventoryItemsInteractive
        rows={clientRows}
        categories={interactiveData.filterOptions.categories}
        suppliers={interactiveData.filterOptions.suppliers}
        initialFilters={initialFilters}
      />
    </>
  );
}

function InventoryItemsContentFallback() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenCardGridSkeleton cards={3} />
      <KitchenActionRowSkeleton actions={3} />
      <KitchenTableSkeleton rows={8} columns={7} />
    </div>
  );
}
