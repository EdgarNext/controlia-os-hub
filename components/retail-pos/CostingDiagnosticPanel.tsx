"use client";

import { useState } from "react";
import {
  COSTING_BROWSER_DIAG_BUILD,
  COSTING_BROWSER_DIAG_ID,
  type CostingDiagnosticEvent,
} from "@/lib/retail-pos/purchase-costing-diagnostics";

export function CostingDiagnosticPanel({
  events,
  document,
  revision,
  queueLength,
  onClear,
}: {
  events: CostingDiagnosticEvent[];
  document: unknown;
  revision: number;
  queueLength: number;
  onClear(): void;
}) {
  const [open, setOpen] = useState(true);

  async function copyDiagnostic() {
    await navigator.clipboard.writeText(
      JSON.stringify({ diagnostic: COSTING_BROWSER_DIAG_ID, build: COSTING_BROWSER_DIAG_BUILD, events }, null, 2),
    );
  }

  return (
    <aside className="fixed bottom-3 right-3 z-[60] w-[min(560px,calc(100vw-24px))] rounded border border-warning/50 bg-surface shadow-[var(--shadow-raise)]" aria-label="Diagnóstico de costeo">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <button type="button" className="text-left text-sm font-semibold" onClick={() => setOpen((value) => !value)}>
          Diagnóstico de costeo · {COSTING_BROWSER_DIAG_ID}
        </button>
        <span className="text-[10px] text-muted">{events.length}/100 · rev {revision} · cola {queueLength}</span>
      </div>
      {open ? (
        <div className="space-y-2 p-3">
          <p className="text-[10px] text-muted">build: {COSTING_BROWSER_DIAG_BUILD}</p>
          <pre className="max-h-64 overflow-auto rounded bg-surface-2 p-2 text-[10px] leading-4">{JSON.stringify({ document, events: events.slice(-20) }, null, 2)}</pre>
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded border border-border px-2 py-1 text-xs" onClick={onClear}>Limpiar eventos</button>
            <button type="button" className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground" onClick={copyDiagnostic}>Copiar JSON</button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
