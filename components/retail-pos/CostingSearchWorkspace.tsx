"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type {
  RetailPosBackofficeSupplier,
  RetailPosCostingProductSearchResult,
} from "@/shared/types/retail-pos";
import { CostingProductSearchDialog } from "./CostingProductSearchDialog";

type CostingSearchWorkspaceProps = {
  tenantSlug: string;
  suppliers: RetailPosBackofficeSupplier[];
};

type SelectedCostingProduct = RetailPosCostingProductSearchResult;

export function CostingSearchWorkspace({ tenantSlug, suppliers }: CostingSearchWorkspaceProps) {
  const [selectedProducts, setSelectedProducts] = useState<SelectedCostingProduct[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierOnly, setSupplierOnly] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const selectedIds = selectedProducts.map((product) => product.productId);
  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId) ?? null;

  function showNotice(message: string, productId?: string) {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    setNotice(message);
    setHighlightedProductId(productId ?? null);
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      setHighlightedProductId(null);
    }, 1800);
  }

  function handleSelect(product: RetailPosCostingProductSearchResult) {
    if (selectedProducts.some((selected) => selected.productId === product.productId)) {
      showNotice("El producto ya está agregado.", product.productId);
      return;
    }
    setSelectedProducts((current) => [...current, product]);
    setNotice(null);
  }

  function handleSupplierChange(value: string) {
    setSupplierId(value || null);
    setSupplierOnly(Boolean(value));
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <label htmlFor="costing-supplier" className="text-sm font-medium text-foreground">Proveedor opcional</label>
            <SearchableSelect
              id="costing-supplier"
              name="costingSupplier"
              options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
              placeholder="Todos los proveedores"
              emptyText="No hay proveedores"
              clearable
              defaultValue={supplierId ?? ""}
              onValueChange={handleSupplierChange}
              helpText={selectedSupplier ? "La búsqueda inicia limitada a este proveedor." : "La búsqueda consulta todo el catálogo."}
            />
          </div>
          <Button type="button" onClick={() => setDialogOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Agregar producto
          </Button>
        </div>
        {notice ? <p className="text-sm text-warning" role="status" aria-live="polite">{notice}</p> : null}
      </Card>

      <Card className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-semibold text-foreground">Productos seleccionados</h2>
            <p className="text-xs text-muted">{selectedProducts.length === 0 ? "Todavía no has agregado productos." : `${selectedProducts.length} producto${selectedProducts.length === 1 ? "" : "s"} en esta sesión.`}</p>
          </div>
        </div>

        {selectedProducts.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted sm:px-5">Usa Agregar producto para comenzar la captura.</div>
        ) : (
          <ul className="divide-y divide-border" aria-label="Productos seleccionados">
            {selectedProducts.map((product) => (
              <li
                key={product.productId}
                className={`flex items-start justify-between gap-3 px-4 py-3 transition-colors sm:px-5 ${highlightedProductId === product.productId ? "bg-warning/10" : ""}`}
              >
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium text-foreground">{product.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {[product.sku && `SKU: ${product.sku}`, product.supplierName, product.salesUnitLabel ?? product.salesUnitCode].filter(Boolean).join(" · ") || "Sin información secundaria"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span>Costo: <strong className="text-foreground">{(product.costCents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</strong></span>
                    <span>P. público: <strong className="text-foreground">{(product.publicPriceCents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</strong></span>
                    <span>P. mayoreo: <strong className="text-foreground">{(product.wholesalePriceCents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</strong></span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProducts((current) => current.filter((item) => item.productId !== product.productId))}
                  className="shrink-0 rounded p-2 text-muted hover:bg-danger/10 hover:text-danger"
                  aria-label={`Retirar ${product.name}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CostingProductSearchDialog
        tenantSlug={tenantSlug}
        open={dialogOpen}
        supplierId={supplierId}
        supplierName={selectedSupplier?.name ?? null}
        supplierOnly={supplierOnly}
        excludedProductIds={selectedIds}
        onOpenChange={setDialogOpen}
        onSupplierOnlyChange={setSupplierOnly}
        onSelect={handleSelect}
      />
    </div>
  );
}
