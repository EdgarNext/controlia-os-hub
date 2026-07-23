"use client";

import { FilterX, Search, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { KitchenCatalogStatus } from "@/lib/kitchen/inventory/catalog-status";
import { getKitchenCatalogStatusMeta } from "@/lib/kitchen/inventory/catalog-status";
import type { KitchenInventorySupplier } from "@/lib/kitchen/inventory/types";
import { useCatalogNavigation } from "./catalog-navigation-shell";

const statuses: Array<{ value: KitchenCatalogStatus; label: string }> = [
  { value: "ready", label: "Listo" }, { value: "price_pending", label: "Precio pendiente" },
  { value: "no_purchase_option", label: "Sin presentación" }, { value: "requires_review", label: "Requiere revisión" },
  { value: "retired", label: "Retirado" }, { value: "zero_cost_configured", label: "Costo cero permitido" },
];

export function CatalogFilters({ suppliers }: { suppliers: KitchenInventorySupplier[] }) {
  const pathname = usePathname(); const searchParams = useSearchParams(); const { navigate } = useCatalogNavigation();
  const queryFromUrl = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(queryFromUrl);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const legacyScope = searchParams.get("scope");
  const hasFilters = Boolean(queryFromUrl || searchParams.get("status") || searchParams.get("supplier"));

  useEffect(() => { setQuery(queryFromUrl); }, [queryFromUrl]);
  useEffect(() => {
    if (!legacyScope) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("scope");
    navigate(`${pathname}?${next}`);
  }, [legacyScope, navigate, pathname, searchParams]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function replaceParams(updates: Record<string, string>, resetPage = true) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("scope");
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    if (resetPage) next.delete("page");
    const nextUrl = next.toString() ? `${pathname}?${next}` : pathname;
    navigate(nextUrl);
  }

  function handleQuery(value: string) {
    setQuery(value); if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => replaceParams({ q: value }), 380);
  }

  function removeFilter(key: string) { replaceParams({ [key]: "" }); if (key === "q") setQuery(""); }
  function clearFilters() { setQuery(""); const next = new URLSearchParams(searchParams.toString()); ["q", "status", "supplier", "page", "scope"].forEach((key) => next.delete(key)); navigate(next.toString() ? `${pathname}?${next}` : pathname); }
  const statusValue = searchParams.get("status") ?? ""; const supplier = suppliers.find((option) => option.id === searchParams.get("supplier")); const chips = [{ key: "q", label: "Búsqueda", value: queryFromUrl }, { key: "status", label: "Estado", value: statusValue ? getKitchenCatalogStatusMeta(statusValue as KitchenCatalogStatus).label : "" }, { key: "supplier", label: "Proveedor", value: supplier?.name ?? "" }].filter((chip) => chip.value);
  return <section className="rounded-[var(--radius-base)] border border-border bg-surface px-3 py-3">
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[min(100%,18rem)] flex-1 space-y-1"><Label htmlFor="catalog-search">Buscar insumo</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" /><Input id="catalog-search" value={query} onChange={(event) => handleQuery(event.target.value)} placeholder="Buscar insumo por nombre" className="h-10 pl-9 pr-9" />{query ? <button type="button" aria-label="Limpiar búsqueda" onClick={() => handleQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"><X className="h-4 w-4" /></button> : null}</div></div>
      <div className="min-w-36 space-y-1"><Label htmlFor="catalog-status">Estado</Label><select id="catalog-status" value={searchParams.get("status") ?? ""} onChange={(event) => replaceParams({ status: event.target.value })} className="h-10 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm"><option value="">Todos los activos</option>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></div>
      <div className="min-w-44 space-y-1"><Label htmlFor="catalog-supplier">Proveedor</Label><select id="catalog-supplier" value={searchParams.get("supplier") ?? ""} onChange={(event) => replaceParams({ supplier: event.target.value })} className="h-10 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm"><option value="">Todos</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
      <div className="min-w-32 space-y-1"><Label htmlFor="catalog-sort">Ordenar</Label><select id="catalog-sort" value={`${searchParams.get("sort") ?? "name"}:${searchParams.get("order") ?? "asc"}`} onChange={(event) => { const [sort, order] = event.target.value.split(":"); replaceParams({ sort: sort === "name" && order === "asc" ? "" : sort, order: sort === "name" && order === "asc" ? "" : order }); }} className="h-10 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm"><option value="name:asc">Nombre A–Z</option><option value="name:desc">Nombre Z–A</option><option value="cost:asc">Costo menor</option><option value="cost:desc">Costo mayor</option><option value="updated_at:desc">Más recientes</option></select></div>
      <div className="min-w-24 space-y-1"><Label htmlFor="catalog-page-size">Por página</Label><select id="catalog-page-size" value={searchParams.get("pageSize") ?? "25"} onChange={(event) => replaceParams({ pageSize: event.target.value === "25" ? "" : event.target.value })} className="h-10 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm"><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></div>
    </div>
    {hasFilters ? <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3" aria-label="Filtros activos">{chips.map((chip) => <span key={chip.key} title={chip.value} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-foreground"><span className="max-w-56 truncate">{chip.label}: {chip.value}</span><button type="button" onClick={() => removeFilter(chip.key)} aria-label={`Quitar filtro ${chip.label}`} className="rounded-full p-0.5 text-muted hover:bg-surface hover:text-foreground"><X className="h-3.5 w-3.5" aria-hidden="true" /></button></span>)}<button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-foreground"><FilterX className="h-3.5 w-3.5" aria-hidden="true" />Limpiar todo</button></div> : null}
  </section>;
}
