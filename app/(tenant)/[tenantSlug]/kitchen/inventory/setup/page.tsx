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

  const [categories, units, suppliers, accessMap] = await Promise.all([
    listKitchenInventoryCategories(result.tenant.tenantId),
    listKitchenInventoryUnits(result.tenant.tenantId),
    listKitchenInventorySuppliers(result.tenant.tenantId),
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

  const uniqueCategories = dedupeById(categories);
  const uniqueUnits = dedupeById(units);
  const uniqueSuppliers = dedupeById(suppliers);

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

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">Configuración de inventario</h1>
        <p className="mt-2 text-sm text-muted">
          Administra catálogos base del módulo: insumos, categorías, unidades, proveedores y ubicaciones.
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <CreateKitchenInventoryItemForm
          tenantSlug={result.tenant.tenantSlug}
          categories={uniqueCategories}
          units={uniqueUnits}
          suppliers={uniqueSuppliers}
        />
        <CreateKitchenInventoryCategoryForm tenantSlug={result.tenant.tenantSlug} />
        <CreateKitchenInventoryUnitForm tenantSlug={result.tenant.tenantSlug} />
        <CreateKitchenInventorySupplierForm tenantSlug={result.tenant.tenantSlug} />
        <CreateKitchenInventoryLocationForm tenantSlug={result.tenant.tenantSlug} />
      </div>
    </div>
  );
}
