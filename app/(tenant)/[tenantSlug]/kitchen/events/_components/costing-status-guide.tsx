import { listChefCostingStatusPresentations } from "@/lib/kitchen/event-catering/costing-status";

export function CostingStatusGuide() {
  return (
    <details className="rounded-[var(--radius-base)] border border-border bg-surface px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        Guía de estados
      </summary>
      <div className="mt-3 grid gap-3 border-t border-border pt-3 md:grid-cols-2">
        {listChefCostingStatusPresentations().map((status) => (
          <div key={status.label} className="rounded-[var(--radius-base)] bg-surface-2 p-3 text-sm">
            <p className="font-medium text-foreground">{status.label}</p>
            <p className="mt-1 text-xs text-muted"><span className="font-medium text-foreground">Qué significa:</span> {status.meaning}</p>
            <p className="mt-1 text-xs text-muted"><span className="font-medium text-foreground">Qué hacer:</span> {status.suggestedAction}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
