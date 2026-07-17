import { AlertTriangle, CalendarRange, Coins, Sparkles } from "lucide-react";

type EventCostingSummaryCardsProps = {
  upcomingEvents: number;
  requiresAttention: number;
  withNewPrices: number;
  costed: number;
};

export function EventCostingSummaryCards({
  upcomingEvents,
  requiresAttention,
  withNewPrices,
  costed,
}: EventCostingSummaryCardsProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={CalendarRange} label="Próximos eventos" value={upcomingEvents.toLocaleString("es-MX")} tone="primary" />
      <MetricCard icon={AlertTriangle} label="Requieren atención" value={requiresAttention.toLocaleString("es-MX")} tone="warning" />
      <MetricCard icon={Sparkles} label="Con precios nuevos" value={withNewPrices.toLocaleString("es-MX")} tone="info" />
      <MetricCard icon={Coins} label="Costeados" value={costed.toLocaleString("es-MX")} tone="success" />
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CalendarRange;
  label: string;
  value: string;
  tone: "primary" | "warning" | "info" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning"
      : tone === "info"
        ? "text-primary"
        : tone === "success"
          ? "text-success"
          : "text-primary";
  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2">
            <Icon className={`h-4 w-4 ${toneClass}`} aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-muted">{label}</p>
        </div>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
      </div>
    </section>
  );
}
