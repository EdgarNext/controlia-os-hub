import {
  getCurrentTenantModulePageAccessMap,
  hasModulePageAccess,
} from "@/lib/auth/module-page-access";
import Link from "next/link";
import {
  listKitchenInventoryCategories,
  getKitchenInventoryOverviewStats,
  listKitchenInventoryItemOperationalRows,
  listKitchenInventorySuppliers,
} from "@/lib/kitchen/inventory/queries";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveKitchenPage } from "../../_lib/page-access";
import { Card } from "@/components/ui/card";
import { InventoryItemsInteractive } from "../_components/inventory-items-interactive";

type KitchenInventoryItemsPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ q?: string; category?: string; supplier?: string }>;
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

  const filters = {
    q: rawSearchParams.q?.trim() ?? "",
    categoryId: rawSearchParams.category?.trim() ?? "",
    supplierId: rawSearchParams.supplier?.trim() ?? "",
  };

  const [categories, suppliers, operationalRows, accessMap, overview] = await Promise.all([
    listKitchenInventoryCategories(result.tenant.tenantId),
    listKitchenInventorySuppliers(result.tenant.tenantId),
    listKitchenInventoryItemOperationalRows(result.tenant.tenantId),
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "kitchen_inventory"),
    getKitchenInventoryOverviewStats(result.tenant.tenantId),
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
  const uniqueSuppliers = dedupeById(suppliers);
  const canManageItems = hasModulePageAccess(accessMap.items ?? "none", "manage");

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">Insumos y existencias</h1>
        <p className="mt-2 text-sm text-muted">
          Catálogo operativo con existencia actual, costo unitario, valor inventario y estado de configuración de compra.
        </p>
        <p className="mt-2 text-sm text-muted">
          Carga inventario desde Excel en{" "}
          <Link
            href={`/${tenantSlug}/kitchen/inventory/imports`}
            className="underline underline-offset-2"
          >
            Importaciones
          </Link>
          .
        </p>
        {canManageItems ? (
          <p className="mt-2 text-sm text-muted">
            Alta y mantenimiento de catálogo en{" "}
            <Link href={`/${tenantSlug}/kitchen/inventory/setup`} className="underline underline-offset-2">
              Configuración de inventario
            </Link>
            .
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted">Insumos activos</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{overview.activeItemsCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Valor inventario</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            ${overview.totalInventoryValue.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Alertas stock bajo</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{overview.lowStockCount}</p>
        </Card>
      </section>

      <InventoryItemsInteractive
        rows={operationalRows}
        categories={uniqueCategories.map((category) => ({ id: category.id, name: category.name }))}
        suppliers={uniqueSuppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }))}
        initialFilters={filters}
      />
    </div>
  );
}
