import type { ChefServiceDetail } from "@/lib/kitchen/event-catering/chef-costing";
import { CostingStatus } from "../../_components/costing-status";

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function ServiceCostingSummary({ detail }: { detail: ChefServiceDetail }) {
  const isHistoricalView = detail.initialCostDisplay.semantic === "historical";

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Resumen económico del servicio</h2>
          <p className="mt-1 text-sm text-muted">
            Evento: {detail.event.name} · Personas del servicio:{" "}
            {detail.plan.planned_guest_count != null
              ? Number(detail.plan.planned_guest_count).toLocaleString("es-MX")
              : "Sin definir"}
          </p>
          {detail.latestUpdatedSnapshot ? (
            <p className="mt-1 text-sm text-muted">
              Último recosteo:{" "}
              {new Date(detail.latestUpdatedSnapshot.createdAt).toLocaleString("es-MX", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Mexico_City",
              })}
            </p>
          ) : null}
          {detail.configurationChanged ? (
            <p className="mt-2 text-sm text-primary">
              Este servicio cambió después del último costeo. Genera un nuevo costo inicial desde el evento.
            </p>
          ) : null}
        </div>
        <CostingStatus label={detail.costingLabel} />
      </div>

      {isHistoricalView ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <MetricMini label="Último costo guardado" value={formatMoney(detail.serviceCostTotal)} />
          <MetricMini label="Estado actual" value="Configuración anterior" />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricMini label="Costo inicial del servicio" value={formatMoney(detail.serviceCostTotal)} />
          <MetricMini label="Costo actualizado del servicio" value={formatMoney(detail.serviceUpdatedCostTotal)} />
          <MetricMini label="Variación por precio" value={formatMoney(detail.priceVariationAmount)} />
          <MetricMini label="Variación porcentual" value={formatPercent(detail.priceVariationPercent)} />
          <MetricMini label="Costo actualizado por persona" value={formatMoney(detail.serviceUpdatedCostPerPerson)} />
        </div>
      )}
    </section>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}
