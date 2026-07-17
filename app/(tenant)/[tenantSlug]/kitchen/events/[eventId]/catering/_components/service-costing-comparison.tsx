import type { ChefServiceRow } from "@/lib/kitchen/event-catering/chef-costing";
import { CostingStatus } from "./costing-status";
import { RecipeCostingComparison } from "./recipe-costing-comparison";

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function ServiceCostingComparison({ services }: { services: ChefServiceRow[] }) {
  if (services.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Comparativo por servicio</h2>
        <p className="mt-1 text-sm text-muted">
          Cada servicio conserva su configuración actual y compara el costo inicial guardado contra el costo actualizado con precios vigentes.
        </p>
      </div>

      <div className="space-y-3">
        {services.map((service) => (
          <article key={service.plan.id} className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {service.plan.name?.trim() || "Servicio sin nombre"}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Personas:{" "}
                  {service.plan.planned_guest_count != null
                    ? Number(service.plan.planned_guest_count).toLocaleString("es-MX")
                    : "Sin definir"}
                </p>
              </div>
              <CostingStatus label={service.costingLabel} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricMini label="Costo inicial guardado" value={formatMoney(service.initialCostTotal)} />
              <MetricMini label="Costo actualizado vigente" value={formatMoney(service.updatedCostTotal)} />
              <MetricMini label="Variación por precio" value={formatMoney(service.priceVariationAmount)} />
              <MetricMini label="Variación porcentual" value={formatPercent(service.priceVariationPercent)} />
              <MetricMini label="Actualizado por persona" value={formatMoney(service.updatedCostPerPerson)} />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <MetricMini
                label="Contribución a la variación del evento"
                value={formatPercent(service.contributionToEventVariation)}
              />
              <MetricMini label="Recetas" value={service.recipesCount.toLocaleString("es-MX")} />
            </div>

            <div className="mt-4">
              <RecipeCostingComparison recipes={service.recipes} />
            </div>
          </article>
        ))}
      </div>
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
