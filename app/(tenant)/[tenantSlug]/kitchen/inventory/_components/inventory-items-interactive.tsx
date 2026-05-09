"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { StatePanel } from "@/components/ui/state-panel";
import { formatKitchenUnit, formatQuantityWithUnit } from "@/lib/kitchen/formatters";
import type { KitchenInventoryItemOperationalRow } from "@/lib/kitchen/inventory/types";

type InventoryItemsInteractiveProps = {
  rows: KitchenInventoryItemOperationalRow[];
  categories: Array<{ id: string; name: string }>;
  suppliers: Array<{ id: string; name: string }>;
  initialFilters: {
    q: string;
    categoryId: string;
    supplierId: string;
  };
};

export function InventoryItemsInteractive({
  rows,
  categories,
  suppliers,
  initialFilters,
}: InventoryItemsInteractiveProps) {
  const [qInput, setQInput] = useState(initialFilters.q);
  const [categoryId, setCategoryId] = useState(initialFilters.categoryId);
  const [supplierId, setSupplierId] = useState(initialFilters.supplierId);
  const [priceStatus, setPriceStatus] = useState<"" | "missing" | "with">("");

  const filteredRows = useMemo(() => {
    const q = qInput.trim().toLocaleLowerCase("es-MX");

    return rows.filter((row) => {
      if (categoryId && row.item.category_id !== categoryId) return false;
      if (supplierId && row.item.default_supplier_id !== supplierId) return false;
      if (priceStatus === "missing" && row.hasCurrentSupplierPrice) return false;
      if (priceStatus === "with" && !row.hasCurrentSupplierPrice) return false;

      if (!q) return true;

      const haystack = [
        row.item.name,
        row.item.normalized_name,
        row.item.sku ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("es-MX");

      return haystack.includes(q);
    });
  }, [rows, qInput, categoryId, supplierId, priceStatus]);

  const activeFilters = useMemo(() => {
    const list: Array<{ key: "q" | "categoryId" | "supplierId" | "priceStatus"; label: string }> = [];
    const q = qInput.trim();
    if (q) list.push({ key: "q", label: `Búsqueda: ${q}` });
    if (categoryId) {
      const name = categories.find((c) => c.id === categoryId)?.name ?? "Categoría";
      list.push({ key: "categoryId", label: `Categoría: ${name}` });
    }
    if (supplierId) {
      const name = suppliers.find((s) => s.id === supplierId)?.name ?? "Proveedor";
      list.push({ key: "supplierId", label: `Proveedor: ${name}` });
    }
    if (priceStatus === "missing") {
      list.push({ key: "priceStatus", label: "Sin precio proveedor" });
    }
    if (priceStatus === "with") {
      list.push({ key: "priceStatus", label: "Con precio proveedor" });
    }
    return list;
  }, [qInput, categoryId, supplierId, priceStatus, categories, suppliers]);

  const clearAll = () => {
    setQInput("");
    setCategoryId("");
    setSupplierId("");
    setPriceStatus("");
  };

  const clearOne = (key: "q" | "categoryId" | "supplierId" | "priceStatus") => {
    if (key === "q") setQInput("");
    if (key === "categoryId") setCategoryId("");
    if (key === "supplierId") setSupplierId("");
    if (key === "priceStatus") setPriceStatus("");
  };

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <>
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <label htmlFor="inventory-filter-q" className="text-xs text-muted">
              Buscar insumo
            </label>
            <input
              id="inventory-filter-q"
              value={qInput}
              onChange={(event) => setQInput(event.target.value)}
              placeholder="Nombre o SKU"
              className="mt-1 h-10 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="min-w-[220px]">
            <label htmlFor="inventory-filter-category" className="text-xs text-muted">
              Categoría
            </label>
            <select
              id="inventory-filter-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="mt-1 h-10 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[220px]">
            <label htmlFor="inventory-filter-supplier" className="text-xs text-muted">
              Proveedor
            </label>
            <select
              id="inventory-filter-supplier"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              className="mt-1 h-10 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
            >
              <option value="">Todos</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[220px]">
            <label htmlFor="inventory-filter-price-status" className="text-xs text-muted">
              Precio proveedor
            </label>
            <select
              id="inventory-filter-price-status"
              value={priceStatus}
              onChange={(event) => setPriceStatus(event.target.value as "" | "missing" | "with")}
              className="mt-1 h-10 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
            >
              <option value="">Todos</option>
              <option value="with">Con precio proveedor</option>
              <option value="missing">Sin precio proveedor</option>
            </select>
          </div>

          <button
            type="button"
            onClick={clearAll}
            className="h-10 rounded-[var(--radius-base)] border border-border bg-surface px-3 text-sm text-foreground"
          >
            Limpiar filtros
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">Resultados: {filteredRows.length.toLocaleString("es-MX")}</span>
        </div>

        {activeFilters.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeFilters.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => clearOne(chip.key)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-foreground"
              >
                {chip.label}
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {filteredRows.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Sin resultados"
          message="No encontramos insumos con los filtros actuales. Ajusta o limpia filtros."
        />
      ) : (
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1480px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="px-3 py-2">Insumo</th>
                  <th className="px-3 py-2">Categoría</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Existencia</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Costo unitario</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Valor inventario</th>
                  <th className="px-3 py-2 whitespace-nowrap">Ubicaciones</th>
                  <th className="px-3 py-2 whitespace-nowrap">Proveedor default</th>
                  <th className="px-3 py-2 whitespace-nowrap">Precio proveedor</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.item.id} className="border-t border-border">
                    <td className="px-3 py-2 text-foreground align-top">
                      <div className="max-w-[20ch] whitespace-normal break-words">{row.item.name}</div>
                    </td>
                    <td className="px-3 py-2 text-foreground whitespace-nowrap">{row.item.kitchen_inventory_categories?.name ?? "Sin categoría"}</td>
                    <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">
                      {formatQuantityWithUnit(row.totalBalance, row.item.kitchen_inventory_units?.code, 4)}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">
                      {row.currentUnitCost <= 0 && !row.isAllowedZeroCost ? (
                        <span className="text-danger">Sin costo</span>
                      ) : (
                        `${formatCurrency(row.currentUnitCost)} / ${formatKitchenUnit(row.item.kitchen_inventory_units?.code)}`
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{formatCurrency(row.estimatedValue)}</td>
                    <td className="px-3 py-2 text-foreground">
                      {row.locationCount === 0 ? "—" : `${row.locationCount} · ${row.locationNames.join(", ")}`}
                    </td>
                    <td className="px-3 py-2 text-foreground whitespace-nowrap">
                      {row.item.kitchen_inventory_suppliers?.name ?? "Sin proveedor"}
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {row.hasCurrentSupplierPrice && row.currentSupplierPrice ? (
                        <div className="space-y-0.5 whitespace-nowrap">
                          <div>Vigente</div>
                          <div className="text-xs text-muted">
                            {formatCurrency(Number(row.currentSupplierPrice.price_per_purchase_unit ?? 0))} /{" "}
                            {formatKitchenUnit(row.currentSupplierPrice.purchase_unit?.code)}
                          </div>
                        </div>
                      ) : (
                        "Sin precio proveedor"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {row.stateTags.slice(0, 3).map((tag) => {
                          const variant =
                            tag === "completo"
                              ? "success"
                              : tag === "costo_0"
                                ? "danger"
                                : tag === "test_sandbox"
                                  ? "warning"
                                  : "primary";
                          const label =
                            tag === "completo"
                              ? "Completo"
                              : tag === "sin_opcion_compra"
                                ? "Sin opción compra"
                                : tag === "sin_precio_proveedor"
                                  ? "Sin precio proveedor"
                                  : tag === "sin_proveedor"
                                    ? "Sin proveedor"
                                    : tag === "costo_0"
                                      ? "Costo 0"
                                      : tag === "test_sandbox"
                                        ? "TEST/sandbox"
                                        : "Unidad dudosa";
                          return (
                            <Badge key={`${row.item.id}:${tag}`} variant={variant}>
                              {label}
                            </Badge>
                          );
                        })}
                      </div>
                      {row.stateTags.length > 3 ? (
                        <div className="mt-1 text-xs text-muted">+{row.stateTags.length - 3} estado(s) adicional(es)</div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">Configurar compra permite convertir faltantes en unidades comprables.</p>
        </section>
      )}
    </>
  );
}
