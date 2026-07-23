"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AsyncActivityIndicator } from "@/components/ui/async-activity-indicator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SupplierFilters() {
  const router = useRouter(); const pathname = usePathname(); const searchParams = useSearchParams(); const queryFromUrl = searchParams.get("q") ?? ""; const [query, setQuery] = useState(queryFromUrl); const [pending, startTransition] = useTransition(); const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFilters = Boolean(queryFromUrl || searchParams.get("status"));
  useEffect(() => { setQuery(queryFromUrl); }, [queryFromUrl]); useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  function replaceParams(updates: Record<string, string>) { const next = new URLSearchParams(searchParams.toString()); Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key)); next.delete("page"); startTransition(() => router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false })); }
  function updateQuery(value: string) { setQuery(value); if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = setTimeout(() => replaceParams({ q: value }), 380); }
  function clear() { setQuery(""); startTransition(() => router.replace(pathname, { scroll: false })); }
  return <section className="relative rounded-[var(--radius-base)] border border-border bg-surface px-3 py-3" aria-busy={pending}><div className="flex flex-wrap items-end gap-2"><div className="min-w-[min(100%,18rem)] flex-1 space-y-1"><Label htmlFor="supplier-search">Buscar proveedor</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" /><Input id="supplier-search" value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Buscar proveedor por nombre" className="h-10 pl-9 pr-9" />{query ? <button type="button" aria-label="Limpiar búsqueda" onClick={() => updateQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"><X className="h-4 w-4" /></button> : null}</div></div><div className="min-w-36 space-y-1"><Label htmlFor="supplier-status">Estado</Label><select id="supplier-status" value={searchParams.get("status") ?? "active"} onChange={(event) => replaceParams({ status: event.target.value === "active" ? "" : event.target.value })} className="h-10 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm"><option value="active">Activos</option><option value="inactive">Desactivados</option><option value="all">Todos</option></select></div>{hasFilters ? <button type="button" onClick={clear} className="inline-flex h-10 items-center gap-1 rounded px-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground"><X className="h-4 w-4" />Limpiar filtros</button> : null}</div><AsyncActivityIndicator active={pending} /></section>;
}
