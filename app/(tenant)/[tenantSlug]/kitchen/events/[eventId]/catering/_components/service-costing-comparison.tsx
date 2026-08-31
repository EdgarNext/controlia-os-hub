import { CheckCircle2, ChevronDown } from "lucide-react";
import type { ChefServiceRow } from "@/lib/kitchen/event-catering/chef-costing";
import { CostingStatus } from "./costing-status";
import {
  getRecipeDisclosureLabels,
  hasComparableCostValues,
  hasMaterialContribution,
  hasMaterialCostVariation,
} from "./cost-breakdown-presentation";
import { RecipeCostingComparison } from "./recipe-costing-comparison";

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSignedMoney(value: number | null): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function ServiceCostingComparison({ services }: { services: ChefServiceRow[] }) {
  if (services.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Comparativo por servicio</h2>
        <p className="mt-1 text-sm text-muted">
          El costo vigente es la referencia principal; la variación explica qué cambió frente al costo inicial guardado.
        </p>
      </div>

      <div className="space-y-3">
        {services.map((service) => {
          const currentCost = service.updatedCostTotal ?? service.initialCostTotal;
          const currentCostPerPerson = service.updatedCostPerPerson ?? service.initialCostPerPerson;
          const hasVariation = hasMaterialCostVariation(service.initialCostTotal, service.updatedCostTotal, service.priceVariationAmount);
          const noChange = hasComparableCostValues(service.initialCostTotal, service.updatedCostTotal) && !hasVariation;
          const variationIsIncrease = (service.priceVariationAmount ?? 0) > 0;
          const disclosure = getRecipeDisclosureLabels(service.recipes.length);

          return (
            <article key={service.plan.id} className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">{service.plan.name?.trim() || "Servicio sin nombre"}</h3>
                  <p className="mt-1 text-sm text-muted">
                    Personas: {service.plan.planned_guest_count != null ? Number(service.plan.planned_guest_count).toLocaleString("es-MX") : "Sin definir"}
                  </p>
                </div>
                <CostingStatus label={service.costingLabel} />
              </div>

              <div className="mt-4 grid gap-4 border-y border-border py-4 sm:grid-cols-3">
                <Metric label={service.updatedCostTotal != null ? "Costo vigente" : "Último costo guardado"} value={formatMoney(currentCost)} prominent />
                <Metric label="Costo por persona" value={formatMoney(currentCostPerPerson)} />
                <Metric label="Recetas" value={service.recipesCount.toLocaleString("es-MX")} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {noChange ? (
                  <span className="inline-flex items-center gap-1.5 text-muted"><CheckCircle2 className="size-4 text-success" aria-hidden="true" />Sin cambios de precio</span>
                ) : hasVariation ? (
                  <span className={variationIsIncrease ? "text-warning" : "text-success"}>
                    Variación {formatSignedMoney(service.priceVariationAmount)} · {formatPercent(service.priceVariationPercent)}
                  </span>
                ) : (
                  <span className="text-muted">Variación no disponible</span>
                )}
                {hasVariation && service.initialCostTotal != null ? <span className="text-xs text-muted">Antes {formatMoney(service.initialCostTotal)}</span> : null}
                {hasMaterialContribution(service.contributionToEventVariation) ? (
                  <span className="text-xs text-muted">Explica {formatPercent(service.contributionToEventVariation)} de la variación del evento</span>
                ) : null}
              </div>

              {service.recipes.length > 0 ? (
                <details className="group mt-4 border-t border-border pt-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                    <span><span className="group-open:hidden">{disclosure.closed}</span><span className="hidden group-open:inline">{disclosure.open}</span></span>
                    <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="mt-3"><RecipeCostingComparison recipes={service.recipes} /></div>
                </details>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Metric({ label, value, prominent = false }: { label: string; value: string; prominent?: boolean }) {
  return <div><p className="text-xs text-muted">{label}</p><p className={prominent ? "mt-1 text-xl font-semibold tracking-tight text-foreground" : "mt-1 text-base font-semibold text-foreground"}>{value}</p></div>;
}
