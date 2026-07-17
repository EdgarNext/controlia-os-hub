"use client";

import { ActionFeedbackForm } from "@/app/(tenant)/[tenantSlug]/kitchen/events/_components/action-feedback-form";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { addReadyRecipeToCateringPlanWithFeedbackAction } from "@/lib/kitchen/event-catering/actions";
import { KitchenSubmitButton } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-submit-button";

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
    <ActionFeedbackForm
      action={addReadyRecipeToCateringPlanWithFeedbackAction}
      className="space-y-2 rounded-[var(--radius-base)] border border-border bg-surface p-4"
    >
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
          label: `${recipe.recipe_name} · versión activa · $${Number(recipe.snapshot_total_cost).toLocaleString("es-MX", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} base`,
        }))}
      />
      <div className="space-y-1">
        <label htmlFor="plannedServings" className="text-sm font-medium text-muted">
          Porciones para esta receta
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
          Usamos las personas del servicio como sugerencia. Puedes ajustar si esta receta aplica solo a una parte del servicio.
        </p>
      </div>
      <KitchenSubmitButton pendingLabel="Agregando receta...">Agregar receta</KitchenSubmitButton>
    </ActionFeedbackForm>
  );
}
