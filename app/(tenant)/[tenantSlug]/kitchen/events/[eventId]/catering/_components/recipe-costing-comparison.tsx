import type { ChefRecipeRow } from "@/lib/kitchen/event-catering/chef-costing";

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function RecipeCostingComparison({ recipes }: { recipes: ChefRecipeRow[] }) {
  if (recipes.length === 0) return null;

  return (
    <div className="space-y-3">
      {recipes.map((recipe) => (
        <article key={recipe.planRecipe.id} className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">{recipe.recipeName}</h4>
              <p className="mt-1 text-xs text-muted">
                Porciones: {recipe.plannedServings.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </p>
            </div>
            {recipe.priceVariationAmount != null && Math.abs(recipe.priceVariationAmount) >= 0.01 ? (
              <span className="text-xs text-muted">
                Variación: {formatMoney(recipe.priceVariationAmount)} ({formatPercent(recipe.priceVariationPercent)})
              </span>
            ) : null}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricMini label="Costo inicial" value={formatMoney(recipe.initialCostTotal)} />
            <MetricMini label="Costo actualizado" value={formatMoney(recipe.updatedCostTotal)} />
            <MetricMini label="Inicial por porción" value={formatMoney(recipe.initialCostPerPortion)} />
            <MetricMini label="Actualizado por porción" value={formatMoney(recipe.updatedCostPerPortion)} />
          </div>
        </article>
      ))}
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-base)] border border-border bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
