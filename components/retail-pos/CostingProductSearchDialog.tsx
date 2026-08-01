"use client";

import { AlertCircle, Check, Loader2, Search, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";
import { fetchCostingProducts, normalizeCostingSearchClientQuery } from "@/lib/retail-pos/costing-search-client";
import type { RetailPosCostingProductSearchResult } from "@/shared/types/retail-pos";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CostingProductSearchDialogProps = {
  tenantSlug: string;
  open: boolean;
  supplierId?: string | null;
  supplierName?: string | null;
  supplierOnly: boolean;
  excludedProductIds?: string[];
  onOpenChange(open: boolean): void;
  onSupplierOnlyChange?(supplierOnly: boolean): void;
  onSelect(product: RetailPosCostingProductSearchResult): void;
};

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

function formatMoney(cents: number) {
  return moneyFormatter.format(cents / 100);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function CostingProductSearchDialog({
  tenantSlug,
  open,
  supplierId = null,
  supplierName = null,
  supplierOnly,
  excludedProductIds = [],
  onOpenChange,
  onSupplierOnlyChange,
  onSelect,
}: CostingProductSearchDialogProps) {
  const dialogId = useId();
  const inputId = `${dialogId}-input`;
  const listboxId = `${dialogId}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);
  const cacheRef = useRef(new Map<string, RetailPosCostingProductSearchResult[]>());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RetailPosCostingProductSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrySequence, setRetrySequence] = useState(0);

  const normalizedQuery = normalizeCostingSearchClientQuery(query);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open || !results[activeIndex]) return;
    document.getElementById(`${dialogId}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, dialogId, open, results]);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setResults([]);
    setActiveIndex(0);
    setError(null);
    setLoading(false);

    if (!open || normalizedQuery.length < 2) return;

    const cacheKey = `${normalizedQuery}|${supplierId ?? ""}|${supplierOnly ? "strict" : "all"}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setResults(cached);
      return;
    }

    let active = true;
    const sequence = ++requestSequenceRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const loadingTimer = window.setTimeout(() => {
      if (active) setLoading(true);
    }, 100);
    const debounceTimer = window.setTimeout(async () => {
      try {
        const nextResults = await fetchCostingProducts({
          tenantSlug,
          query,
          supplierId,
          supplierOnly,
          limit: 20,
          signal: controller.signal,
        });
        if (!active || sequence !== requestSequenceRef.current) return;
        cacheRef.current.set(cacheKey, nextResults);
        if (cacheRef.current.size > 50) {
          const oldestKey = cacheRef.current.keys().next().value;
          if (oldestKey) cacheRef.current.delete(oldestKey);
        }
        setResults(nextResults);
        setActiveIndex(0);
        setError(null);
      } catch (nextError) {
        if (!active || isAbortError(nextError) || controller.signal.aborted) return;
        setResults([]);
        setError("No fue posible buscar productos.");
      } finally {
        window.clearTimeout(loadingTimer);
        if (active && sequence === requestSequenceRef.current) setLoading(false);
      }
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(debounceTimer);
      window.clearTimeout(loadingTimer);
      controller.abort();
    };
  }, [normalizedQuery, open, query, retrySequence, supplierId, supplierOnly, tenantSlug]);

  function selectResult(product: RetailPosCostingProductSearchResult) {
    onSelect(product);
    setQuery("");
    setResults([]);
    setActiveIndex(0);
    setError(null);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const activeResult = results[activeIndex];
      if (activeResult) selectResult(activeResult);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
    }
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  const hasSupplier = Boolean(supplierId);
  const isStrictSupplierSearch = hasSupplier && supplierOnly;
  const activeResult = results[activeIndex];

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg-veil px-3 py-8 sm:px-6 sm:py-16"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
        aria-describedby={`${dialogId}-help`}
        onKeyDown={handleDialogKeyDown}
        className="fixed left-1/2 top-1/2 flex h-[min(720px,calc(100dvh-32px))] w-[min(760px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[var(--radius-base)] border border-border bg-surface shadow-[var(--shadow-raise)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id={`${dialogId}-title`} className="text-base font-semibold text-foreground">
              Agregar producto
            </h2>
            <p id={`${dialogId}-help`} className="mt-1 text-xs text-muted">
              {isStrictSupplierSearch ? `Solo productos de ${supplierName ?? "este proveedor"}.` : "Busca en todo el catálogo."} Usa ↑ ↓ y Enter para seleccionar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label="Cerrar selector"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-hidden px-4 py-4 sm:px-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              ref={inputRef}
              id={inputId}
              role="combobox"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Buscar por descripción o SKU…"
              aria-expanded={results.length > 0}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeResult ? `${dialogId}-option-${activeIndex}` : undefined}
              className="h-12 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 pl-10 pr-10 text-sm text-foreground outline-none placeholder:text-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary"
              autoComplete="off"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {isStrictSupplierSearch ? (
            <button
              type="button"
              onClick={() => {
                abortRef.current?.abort();
                onSupplierOnlyChange?.(false);
              }}
              className="text-left text-xs font-medium text-primary hover:underline"
            >
              Buscar en todo el catálogo
            </button>
          ) : null}

          <div className="min-h-16 min-w-0 flex-1 overflow-y-auto rounded-[var(--radius-base)] border border-border bg-surface-2">
            {!normalizedQuery || normalizedQuery.length < 2 ? (
              <p className="px-3 py-4 text-sm text-muted">Escribe al menos dos caracteres.</p>
            ) : loading ? (
              <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted" role="status" aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Buscando productos…
              </p>
            ) : error ? (
              <div className="flex items-center justify-between gap-3 px-3 py-4" role="alert">
                <p className="flex items-center gap-2 text-sm text-danger">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" /> {error}
                </p>
                <Button type="button" variant="secondary" className="shrink-0 px-3 py-1.5 text-xs" onClick={() => setRetrySequence((current) => current + 1)}>
                  Reintentar
                </Button>
              </div>
            ) : results.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">
                {isStrictSupplierSearch ? "No se encontraron productos de este proveedor." : "No encontramos productos con esa descripción."}
              </p>
            ) : (
              <ul id={listboxId} role="listbox" aria-label="Resultados de productos" className="max-h-[min(45vh,24rem)] overflow-y-auto">
                {results.map((product, index) => {
                  const isActive = index === activeIndex;
                  const isExcluded = excludedProductIds.includes(product.productId);
                  return (
                    <li key={product.productId} id={`${dialogId}-option-${index}`} role="option" aria-selected={isActive}>
                      <button
                        type="button"
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectResult(product)}
                        className={cn(
                          "w-full border-b border-border px-3 py-3 text-left last:border-b-0",
                          isActive ? "bg-primary/10" : "hover:bg-surface",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="line-clamp-2 min-w-0 text-sm font-medium text-foreground">{product.name}</span>
                          {isExcluded ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Ya agregado" /> : null}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                          {product.sku ? <span>SKU: {product.sku}</span> : null}
                          {product.barcode ? <span>Código: {product.barcode}</span> : null}
                          {product.brand ? <span>{product.brand}</span> : null}
                          {product.categoryName ? <span>{product.categoryName}</span> : null}
                          {product.supplierName ? <span>{product.supplierName}</span> : null}
                          {product.salesUnitLabel || product.salesUnitCode ? <span>Unidad: {product.salesUnitLabel ?? product.salesUnitCode}</span> : null}
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <span><span className="block text-muted">Costo</span><strong>{formatMoney(product.costCents)}</strong></span>
                          <span><span className="block text-muted">P. público</span><strong>{formatMoney(product.publicPriceCents)}</strong></span>
                          <span><span className="block text-muted">P. mayoreo</span><strong>{formatMoney(product.wholesalePriceCents)}</strong></span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
          <p className="text-xs text-muted">Enter agrega · Escape cierra</p>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Terminar
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
