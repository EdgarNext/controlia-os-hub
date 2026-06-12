import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import {
  filterKitchenInventoryDataQualityRows,
  getKitchenInventoryDataQualityData,
  listKitchenInventoryCategories,
  listKitchenInventorySuppliers,
  listKitchenInventoryUnits,
  listPurchaseOptions,
  listSupplierPrices,
} from "@/lib/kitchen/inventory/queries";
import type { KitchenInventoryDataQualityQueue } from "@/lib/kitchen/inventory/types";
import { KitchenPageHeader } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-page-header";
import { resolveKitchenPage } from "../../_lib/page-access";
import { InventoryDataQualityInteractive } from "../_components/inventory-data-quality-interactive";

type KitchenInventoryDataQualityPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ queue?: string; q?: string }>;
};

const QUEUES: Array<{ key: KitchenInventoryDataQualityQueue; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "todos_con_problemas", label: "Todos con problemas" },
  { key: "completos", label: "Completos" },
  { key: "sin_categoria", label: "Sin categoría" },
  { key: "sin_proveedor", label: "Sin proveedor" },
  { key: "costo_0", label: "Costo 0" },
  { key: "sin_purchase_option", label: "Sin opción compra" },
  { key: "sin_supplier_price", label: "Sin precio proveedor" },
  { key: "unidad_dudosa", label: "Unidad dudosa" },
  { key: "unidad_base_inconsistente", label: "Unidad base inconsistente" },
  { key: "costo_unitario_incongruente", label: "Costo incongruente" },
  { key: "test_sandbox", label: "TEST/sandbox" },
  { key: "con_balance", label: "Con balance" },
  { key: "sin_balance", label: "Sin balance" },
];

function resolveQueue(raw: string | undefined): KitchenInventoryDataQualityQueue {
  if (!raw) return "todos_con_problemas";
  const validKeys = new Set(QUEUES.map((queue) => queue.key));
  return validKeys.has(raw as KitchenInventoryDataQualityQueue)
    ? (raw as KitchenInventoryDataQualityQueue)
    : "todos_con_problemas";
}

export default async function KitchenInventoryDataQualityPage({
  params,
  searchParams,
}: KitchenInventoryDataQualityPageProps) {
  const { tenantSlug } = await params;
  const rawSearchParams = await searchParams;
  const queue = resolveQueue(rawSearchParams.queue);
  const query = (rawSearchParams.q ?? "").trim().toLocaleLowerCase("es-MX");

  const result = await resolveKitchenPage(tenantSlug, "kitchen_inventory", "items");
  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para calidad de inventario"
        message="No tienes acceso al diagnóstico de calidad de inventario."
      />
    );
  }

  const [dataQualityData, categories, suppliers, units, purchaseOptions, supplierPrices] = await Promise.all([
    getKitchenInventoryDataQualityData(result.tenant.tenantId),
    listKitchenInventoryCategories(result.tenant.tenantId),
    listKitchenInventorySuppliers(result.tenant.tenantId),
    listKitchenInventoryUnits(result.tenant.tenantId),
    listPurchaseOptions(result.tenant.tenantId),
    listSupplierPrices(result.tenant.tenantId),
  ]);
  const queueRows = filterKitchenInventoryDataQualityRows(dataQualityData.rows, queue);
  const rows = query
    ? queueRows.filter((row) =>
        [row.item.name, row.item.normalized_name, row.item.sku ?? ""]
          .join(" ")
          .toLocaleLowerCase("es-MX")
          .includes(query),
      )
    : queueRows;

  const sortedRows = [...rows].sort((a, b) => {
    if (b.cleanupPriorityScore !== a.cleanupPriorityScore) return b.cleanupPriorityScore - a.cleanupPriorityScore;
    if (Number(b.totalBalance) !== Number(a.totalBalance)) return Number(b.totalBalance) - Number(a.totalBalance);
    return a.item.name.localeCompare(b.item.name, "es-MX");
  });

  const purchaseOptionsByItem: Record<
    string,
    Array<{
      id: string;
      label: string;
      isDefault: boolean;
      isActive: boolean;
      supplierId: string | null;
      supplierName: string | null;
      purchaseUnitId: string;
      purchaseUnitCode: string | null;
      quantityPerPurchaseUnit: number;
      minPurchaseQuantity: number;
      purchaseMultiple: number;
      notes: string | null;
    }>
  > = {};
  for (const option of purchaseOptions) {
    const bucket = purchaseOptionsByItem[option.item_id] ?? [];
    bucket.push({
      id: option.id,
      label: `${option.kitchen_inventory_suppliers?.name ?? "Sin proveedor"} · ${option.purchase_unit?.code ?? "ud"} x ${Number(option.quantity_per_purchase_unit).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 4 })}`,
      isDefault: option.is_default,
      isActive: option.is_active,
      supplierId: option.supplier_id,
      supplierName: option.kitchen_inventory_suppliers?.name ?? null,
      purchaseUnitId: option.purchase_unit_id,
      purchaseUnitCode: option.purchase_unit?.code ?? null,
      quantityPerPurchaseUnit: Number(option.quantity_per_purchase_unit ?? 0),
      minPurchaseQuantity: Number(option.min_purchase_quantity ?? 0),
      purchaseMultiple: Number(option.purchase_multiple ?? 0),
      notes: option.notes ?? null,
    });
    purchaseOptionsByItem[option.item_id] = bucket;
  }

  const currentPriceByItem: Record<
    string,
    Array<{
      id: string;
      supplierId: string;
      supplierName: string | null;
      purchaseUnitId: string;
      purchaseUnitLabel: string;
      pricePerPurchaseUnit: number;
    }>
  > = {};
  for (const price of supplierPrices) {
    if (!price.is_current) continue;
    const bucket = currentPriceByItem[price.item_id] ?? [];
    bucket.push({
      id: price.id,
      supplierId: price.supplier_id,
      supplierName: price.kitchen_inventory_suppliers?.name ?? null,
      purchaseUnitId: price.purchase_unit_id,
      pricePerPurchaseUnit: Number(price.price_per_purchase_unit ?? 0),
      purchaseUnitLabel: price.purchase_unit?.code ?? "ud",
    });
    currentPriceByItem[price.item_id] = bucket;
  }

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Inventario"
        title="Data Quality de Insumos"
        description="Diagnóstico read-only para priorizar limpieza de master data. Esta vista no modifica movimientos ni balances."
        metadata={
          <>
            Usa esta cola para priorizar correcciones y luego operar en{" "}
            <Link href={`/${tenantSlug}/kitchen/inventory/items`} className="underline underline-offset-2">
              Insumos
            </Link>
            .
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        <MetricCard label="Insumos activos" value={dataQualityData.summary.activeItems} tone="default" />
        <MetricCard label="Insumos completos" value={dataQualityData.summary.completeItems} tone="success" />
        <MetricCard label="Insumos con problemas" value={dataQualityData.summary.itemsWithIssues} tone="danger" />
        <MetricCard label="Sin categoría" value={dataQualityData.summary.withoutCategory} tone="warning" />
        <MetricCard label="Sin proveedor default" value={dataQualityData.summary.withoutDefaultSupplier} tone="warning" />
        <MetricCard label="Costo 0 o nulo" value={dataQualityData.summary.zeroOrNullCost} tone="danger" />
        <MetricCard
          label="Sin opción compra default"
          value={dataQualityData.summary.withoutDefaultPurchaseOption}
          tone="warning"
        />
        <MetricCard
          label="Sin precio proveedor current"
          value={dataQualityData.summary.withoutCurrentSupplierPrice}
          tone="warning"
        />
        <MetricCard label="Unidad dudosa" value={dataQualityData.summary.suspiciousUnit} tone="warning" />
        <MetricCard label="Unidad base inconsistente" value={dataQualityData.summary.baseUnitInconsistent} tone="danger" />
        <MetricCard label="Costo unitario incongruente" value={dataQualityData.summary.unitCostIncongruent} tone="danger" />
        <MetricCard label="TEST/sandbox" value={dataQualityData.summary.testSandbox} tone="danger" />
        <MetricCard label="Con balance" value={dataQualityData.summary.withBalance} tone="default" />
        <MetricCard label="Sin balance" value={dataQualityData.summary.withoutBalance} tone="default" />
      </section>

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="flex flex-wrap gap-2">
          {QUEUES.map((entry) => {
            const active = queue === entry.key;
            const href = `/${tenantSlug}/kitchen/inventory/data-quality?queue=${entry.key}`;
            return (
              <Link
                key={entry.key}
                href={href}
                className={`inline-flex rounded-full border px-3 py-1 text-xs transition-colors ${
                  active
                    ? "border-primary bg-surface text-foreground"
                    : "border-border bg-surface-2 text-foreground hover:bg-surface"
                }`}
              >
                {entry.label}
              </Link>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">
          Cola activa: <span className="text-foreground">{QUEUES.find((entry) => entry.key === queue)?.label}</span>. Resultados:{" "}
          <span className="text-foreground">{sortedRows.length.toLocaleString("es-MX")}</span>.
        </p>
      </section>

      {sortedRows.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Sin resultados en esta cola"
          message="No encontramos insumos para el filtro seleccionado. Cambia de cola o revisa búsqueda."
        />
      ) : (
        <InventoryDataQualityInteractive
          tenantSlug={tenantSlug}
          queue={queue}
          rows={sortedRows}
          categories={categories.filter((category) => category.is_active).map((category) => ({ id: category.id, name: category.name }))}
          suppliers={suppliers.filter((supplier) => supplier.is_active).map((supplier) => ({ id: supplier.id, name: supplier.name }))}
          purchaseUnits={units.filter((unit) => unit.is_active).map((unit) => ({ id: unit.id, code: unit.code, name: unit.name }))}
          purchaseOptionsByItem={purchaseOptionsByItem}
          currentPriceByItem={currentPriceByItem}
        />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-success/30"
      : tone === "warning"
        ? "border-warning/40"
        : tone === "danger"
          ? "border-danger/35"
          : "border-border";
  return (
    <article className={`rounded-[var(--radius-base)] border bg-surface p-3 ${toneClass}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value.toLocaleString("es-MX")}</p>
    </article>
  );
}
