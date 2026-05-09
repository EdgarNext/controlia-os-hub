import { Suspense } from "react";
import {
  getCurrentTenantModulePageAccessMap,
  hasModulePageAccess,
} from "@/lib/auth/module-page-access";
import { StatePanel } from "@/components/ui/state-panel";
import {
  CreateKitchenInventoryCategoryForm,
  CreateKitchenInventoryItemForm,
  CreateKitchenInventoryLocationForm,
  CreateKitchenInventorySupplierForm,
  CreateKitchenInventoryUnitForm,
} from "../_components/inventory-forms";
import { KitchenActionRowSkeleton, KitchenTableSkeleton } from "../../_components/kitchen-loading-skeletons";
import { KitchenPageHeader } from "../../_components/kitchen-page-header";
import { resolveKitchenPage } from "../../_lib/page-access";
import {
  listKitchenInventoryCategories,
  listKitchenInventorySuppliers,
  listKitchenInventoryUnits,
} from "@/lib/kitchen/inventory/queries";

type KitchenInventorySetupPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function KitchenInventorySetupPage({ params }: KitchenInventorySetupPageProps) {
  const { tenantSlug } = await params;
  const result = await resolveKitchenPage(tenantSlug, "kitchen_inventory", "items");

  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para configuración"
        message="No tienes acceso a la configuración de inventario."
      />
    );
  }

  const accessMap = await getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "kitchen_inventory");
  const canManageItems = hasModulePageAccess(accessMap.items ?? "none", "manage");

  if (!canManageItems) {
    return (
      <StatePanel
        kind="permission"
        title="Solo lectura"
        message="Solicita permisos manage para crear o editar catálogo de inventario."
      />
    );
  }

  const dataPromise = Promise.all([
    listKitchenInventoryCategories(result.tenant.tenantId),
    listKitchenInventoryUnits(result.tenant.tenantId),
    listKitchenInventorySuppliers(result.tenant.tenantId),
  ]);

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Inventario"
        title="Configuración de inventario"
        description="Administra catálogos base del módulo: insumos, categorías, unidades, proveedores y ubicaciones."
      />

      <Suspense fallback={<SetupContentFallback />}>
        <SetupContent tenantSlug={result.tenant.tenantSlug} dataPromise={dataPromise} />
      </Suspense>
    </div>
  );
}

async function SetupContent({
  tenantSlug,
  dataPromise,
}: {
  tenantSlug: string;
  dataPromise: ReturnType<typeof Promise.all<[
    ReturnType<typeof listKitchenInventoryCategories>,
    ReturnType<typeof listKitchenInventoryUnits>,
    ReturnType<typeof listKitchenInventorySuppliers>
  ]>>;
}) {
  const [categories, units, suppliers] = await dataPromise;

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

  const uniqueCategories = dedupeById(categories);
  const uniqueUnits = dedupeById(units);
  const uniqueSuppliers = dedupeById(suppliers);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <CreateKitchenInventoryItemForm
        tenantSlug={tenantSlug}
        categories={uniqueCategories}
        units={uniqueUnits}
        suppliers={uniqueSuppliers}
      />
      <CreateKitchenInventoryCategoryForm tenantSlug={tenantSlug} />
      <CreateKitchenInventoryUnitForm tenantSlug={tenantSlug} />
      <CreateKitchenInventorySupplierForm tenantSlug={tenantSlug} />
      <CreateKitchenInventoryLocationForm tenantSlug={tenantSlug} />
    </div>
  );
}

function SetupContentFallback() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenActionRowSkeleton actions={3} />
      <KitchenTableSkeleton rows={6} columns={4} />
    </div>
  );
}
