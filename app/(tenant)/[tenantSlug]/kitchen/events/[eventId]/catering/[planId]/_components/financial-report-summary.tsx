import { StatePanel } from "@/components/ui/state-panel";
import { getCateringPlanFinancialReport } from "@/lib/kitchen/event-catering/queries";

function money(value: number | null): string {
  return value == null ? "—" : `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function FinancialReportSummary({ tenantSlug, planId }: { tenantSlug: string; planId: string }) {
  const loaded = await loadReport(tenantSlug, planId);
  if (!loaded.report) return <StatePanel kind="error" title="No se pudo cargar el reporte financiero" message={loaded.error} />;
  const report = loaded.report;
    const pricing = report.pricing;
    return <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4" aria-labelledby="financial-report-title">
      <div><h2 id="financial-report-title" className="text-base font-semibold text-foreground">Reporte financiero</h2><p className="mt-1 text-sm text-muted">Costeo sugerido y ejecución operativa del servicio, con fuentes separadas.</p></div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4"><p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Costeo sugerido</p><div className="mt-3 grid gap-2 text-sm"><ReportRow label="Costo de alimentos" value={money(pricing.foodCost)} /><ReportRow label="Costo de personal extra" value={money(pricing.extraLaborCost)} /><ReportRow label="Costo base del servicio" value={money(pricing.serviceCostBasis)} /><ReportRow label="Margen objetivo" value={pricing.targetMarginPct == null ? "—" : `${pricing.targetMarginPct.toLocaleString("es-MX", { maximumFractionDigits: 2 })}%`} /><ReportRow label="Utilidad sugerida" value={money(pricing.suggestedProfit)} /><ReportRow label="Precio sugerido del servicio" value={money(pricing.suggestedServicePrice)} strong /><ReportRow label="Precio sugerido por persona" value={money(pricing.suggestedPricePerGuest)} /></div><p className="mt-3 text-xs text-muted">{pricing.source === "snapshot_v1" ? "Costeo congelado" : pricing.source === "current_preview" ? "Costeo actual" : "Precio sugerido no disponible para este histórico"}</p></div>
        <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4"><p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Ejecución operativa</p><div className="mt-3 grid gap-2 text-sm"><ReportRow label="Estimado inicial" value={money(report.summary.estimatedInitialCost)} /><ReportRow label="Requisicionado" value={money(report.summary.requisitionedCost)} /><ReportRow label="Recibido / comprado" value={money(report.summary.receivedCost)} /><ReportRow label="Consumido real" value={money(report.summary.consumedCost)} /><ReportRow label="Merma" value={money(report.summary.wasteCost)} /><ReportRow label="Inventario remanente" value={money(report.summary.remainingInventoryValue)} /><ReportRow label="Variación neta" value={money(report.summary.netConsumptionVariance)} /></div></div>
      </div>
    </section>;
}

async function loadReport(tenantSlug: string, planId: string) {
  try { return { report: await getCateringPlanFinancialReport(tenantSlug, planId), error: "" }; }
  catch (error) { return { report: null, error: error instanceof Error ? error.message : "Intenta recargar la vista." }; }
}

function ReportRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0"><span className={strong ? "font-medium text-foreground" : "text-muted"}>{label}</span><span className={strong ? "text-base font-semibold text-foreground" : "text-foreground"}>{value}</span></div>; }
