"use client";

import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { addReadyRecipeToCateringPlanAction } from "@/lib/kitchen/event-catering/actions";

type ReadyRecipeOption = {
  recipe_id: string;
  recipe_name: string;
  snapshot_total_cost: number;
};

export function AddReadyRecipeToPlanForm({
  tenantSlug,
  planId,
  suggestedServings,
  recipes,
}: {
  tenantSlug: string;
  planId: string;
  suggestedServings: number | null;
  recipes: ReadyRecipeOption[];
}) {
  return (
    <form action={addReadyRecipeToCateringPlanAction} className="space-y-2 rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="planId" value={planId} />
      <p className="text-sm font-semibold text-foreground">Agregar receta ready</p>
      <SearchableSelect
        name="recipeId"
        label="Receta"
        placeholder="Selecciona receta ready"
        required
        options={recipes.map((recipe) => ({
          value: recipe.recipe_id,
          label: `${recipe.recipe_name} · costo base $${Number(recipe.snapshot_total_cost).toLocaleString("es-MX", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
        }))}
      />
      <div className="space-y-1">
        <label htmlFor="plannedServings" className="text-sm font-medium text-muted">
          Base de cálculo para esta receta
        </label>
        <input
          id="plannedServings"
          name="plannedServings"
          type="number"
          min="0.0001"
          step="0.0001"
          defaultValue={suggestedServings != null && suggestedServings > 0 ? String(suggestedServings) : undefined}
          placeholder="Personas/porciones planeadas para esta receta"
          className="h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary"
          required
        />
        <p className="text-xs text-muted">
          Usamos los invitados/base del plan como sugerencia. Puedes ajustar si esta receta aplica solo a parte del evento.
        </p>
      </div>
      <Button type="submit">Agregar receta</Button>
    </form>
  );
}
