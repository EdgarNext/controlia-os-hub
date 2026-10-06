"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ReportPeriodFilters({ from, to, view }: { from?: string; to?: string; view: "active" | "historical" }) {
  const router = useRouter();
  const [draftFrom, setDraftFrom] = useState(from ?? "");
  const [draftTo, setDraftTo] = useState(to ?? "");
  const [isPending, startTransition] = useTransition();

  function apply() {
    if (!draftFrom || !draftTo || draftFrom > draftTo) return;
    const params = new URLSearchParams({ from: draftFrom, to: draftTo, view });
    startTransition(() => router.push(`?${params.toString()}`));
  }

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm text-foreground">Desde<input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} className="h-10 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3" /></label>
        <label className="grid gap-1 text-sm text-foreground">Hasta<input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} className="h-10 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3" /></label>
        <button type="button" onClick={apply} disabled={isPending || !draftFrom || !draftTo || draftFrom > draftTo} className="h-10 rounded-[var(--radius-base)] bg-primary px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{isPending ? "Aplicando…" : "Aplicar"}</button>
      </div>
      {draftFrom && draftTo && draftFrom > draftTo ? <p className="mt-2 text-xs text-danger">La fecha inicial debe ser anterior o igual a la fecha final.</p> : null}
    </section>
  );
}
