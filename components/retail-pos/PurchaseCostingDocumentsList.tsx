"use client";

import { FilePlus2, Loader2, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { RetailPosPurchaseCostingSummary } from "@/shared/types/retail-pos";
import { formatMoney } from "@/lib/retail-pos/purchase-costing-ui";

type Props = { tenantSlug: string; rows: RetailPosPurchaseCostingSummary[]; page: number; pageCount: number; invoiceReference?: string };

export function PurchaseCostingDocumentsList({ tenantSlug, rows, page, pageCount, invoiceReference }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState(invoiceReference ?? "");

  async function createDocument() {
    setCreating(true);
    try {
      const response = await fetch(`/api/tenant/${encodeURIComponent(tenantSlug)}/retail-pos/purchase-costings`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ defaultPublicMarkupBps: 0, defaultWholesaleMarkupBps: 0 }), cache: "no-store" });
      const body = await response.json() as { id?: string; error?: string };
      if (!response.ok || !body.id) throw new Error(body.error ?? "No fue posible crear el costeo.");
      router.push(`/${tenantSlug}/retail/costing/${body.id}`);
    } catch (error) { window.alert(error instanceof Error ? error.message : "No fue posible crear el costeo."); setCreating(false); }
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const params = new URLSearchParams(); if (query.trim()) params.set("invoiceReference", query.trim()); router.push(`/${tenantSlug}/retail/costing${params.size ? `?${params.toString()}` : ""}`); }

  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><form onSubmit={submitSearch} className="flex min-w-[min(100%,420px)] flex-1 gap-2"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar referencia de factura" className="h-10 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 pl-9 pr-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary" /></div><Button type="submit" variant="secondary">Buscar</Button></form><Button type="button" onClick={createDocument} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}Nuevo costeo</Button></div>
    {rows.length === 0 ? <div className="rounded-[var(--radius-base)] border border-dashed border-border bg-surface p-10 text-center"><FilePlus2 className="mx-auto h-8 w-8 text-muted" aria-hidden="true" /><h2 className="mt-3 font-semibold">Todavía no hay documentos de costeo.</h2><p className="mt-1 text-sm text-muted">Crea un borrador para comenzar a capturar una factura.</p><Button type="button" className="mt-4" onClick={createDocument} disabled={creating}>Crear primer costeo</Button></div> : <div className="overflow-x-auto rounded-[var(--radius-base)] border border-border bg-surface"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-border bg-surface-2 text-xs text-muted"><tr><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3">Referencia</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Productos</th><th className="px-4 py-3">Total neto</th><th className="px-4 py-3">Actualización</th><th className="px-4 py-3" /></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-border last:border-0 hover:bg-surface-2"><td className="px-4 py-3">{row.supplierName ?? "Sin proveedor"}</td><td className="px-4 py-3">{row.invoiceReference ?? "Sin referencia"}</td><td className="px-4 py-3">{row.invoiceDate ? new Date(`${row.invoiceDate}T00:00:00`).toLocaleDateString("es-MX") : "—"}</td><td className="px-4 py-3"><span className="rounded-full bg-surface-2 px-2 py-1 text-xs">{row.status === "draft" ? "Borrador" : row.status === "calculated" ? "Calculado" : row.status === "applied" ? "Aplicado" : "Anulado"}</span></td><td className="px-4 py-3">{row.lineCount}</td><td className="px-4 py-3 font-medium">{formatMoney(row.netTotalCents)}</td><td className="px-4 py-3 text-xs text-muted">{new Date(row.updatedAt).toLocaleString("es-MX")}</td><td className="px-4 py-3 text-right"><Button type="button" variant="ghost" onClick={() => router.push(`/${tenantSlug}/retail/costing/${row.id}`)}>Abrir</Button></td></tr>)}</tbody></table></div>}
    {pageCount > 1 ? <div className="flex items-center justify-between text-sm"><span className="text-muted">Página {page} de {pageCount}</span><div className="flex gap-2"><Button type="button" variant="secondary" disabled={page <= 1} onClick={() => router.push(`/${tenantSlug}/retail/costing?page=${page - 1}${invoiceReference ? `&invoiceReference=${encodeURIComponent(invoiceReference)}` : ""}`)}>Anterior</Button><Button type="button" variant="secondary" disabled={page >= pageCount} onClick={() => router.push(`/${tenantSlug}/retail/costing?page=${page + 1}${invoiceReference ? `&invoiceReference=${encodeURIComponent(invoiceReference)}` : ""}`)}>Siguiente</Button></div></div> : null}
  </div>;
}
