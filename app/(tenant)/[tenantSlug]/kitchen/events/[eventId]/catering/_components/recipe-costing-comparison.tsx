import type { ChefRecipeRow } from "@/lib/kitchen/event-catering/chef-costing";
import { hasComparableCostValues, hasMaterialCostVariation } from "./cost-breakdown-presentation";

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

export function RecipeCostingComparison({ recipes }: { recipes: ChefRecipeRow[] }) {
  if (recipes.length === 0) return null;

  return (
    <div className="divide-y divide-border border-y border-border">
      {recipes.map((recipe) => {
        const currentCost = recipe.updatedCostTotal ?? recipe.initialCostTotal;
        const currentCostPerPortion = recipe.updatedCostPerPortion ?? recipe.initialCostPerPortion;
        const hasVariation = hasMaterialCostVariation(recipe.initialCostTotal, recipe.updatedCostTotal, recipe.priceVariationAmount);
        const noChange = hasComparableCostValues(recipe.initialCostTotal, recipe.updatedCostTotal) && !hasVariation;
        const variationIsIncrease = (recipe.priceVariationAmount ?? 0) > 0;

        return (
          <article key={recipe.planRecipe.id} className="grid gap-3 py-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(7rem,0.8fr)_minmax(8rem,0.9fr)_minmax(8rem,0.9fr)_minmax(11rem,1.1fr)] lg:items-center">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-medium text-foreground">{recipe.recipeName}</h4>
              <p className="mt-1 text-xs text-muted">
                {recipe.plannedServings.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} porciones
              </p>
            </div>
            <Value label="Costo vigente" value={formatMoney(currentCost)} />
            <Value label="Costo / porción" value={formatMoney(currentCostPerPortion)} />
            <Value label="Inicial" value={noChange ? "—" : formatMoney(recipe.initialCostTotal)} muted={noChange} />
            <div className="lg:text-right">
              <p className="text-xs text-muted">Variación</p>
              {noChange ? <p className="mt-1 text-xs text-muted">Sin cambios</p> : hasVariation ? (
                <p className={variationIsIncrease ? "mt-1 text-sm font-medium text-warning" : "mt-1 text-sm font-medium text-success"}>
                  {formatSignedMoney(recipe.priceVariationAmount)} · {formatPercent(recipe.priceVariationPercent)}
                </p>
              ) : <p className="mt-1 text-sm text-muted">—</p>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Value({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return <div><p className="text-xs text-muted">{label}</p><p className={muted ? "mt-1 text-sm text-muted" : "mt-1 text-sm font-medium text-foreground"}>{value}</p></div>;
}
