export const OPERATIONAL_IDENTITY_VERSION = 1;

type OperationalRecipe = {
  plan_recipe_id: string;
  recipe_id: string;
  recipe_version_id: string;
  planned_servings: number;
  multiplier: number;
};

type OperationalService = {
  plan_id: string;
  planned_guest_count: number | null;
  recipes: OperationalRecipe[];
};

export type OperationalConfigurationPayload = {
  event_id: string;
  services: OperationalService[];
};

type SnapshotRecord = Record<string, unknown>;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as SnapshotRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is SnapshotRecord {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function buildOperationalConfigurationPayload(
  event: { id: string },
  plans: Array<{ id: string; planned_guest_count: number | null; status: string }>,
  planRecipes: Array<{
    id: string;
    plan_id: string;
    recipe_id: string;
    recipe_version_id: string;
    planned_servings: number;
    multiplier: number;
  }>,
): OperationalConfigurationPayload {
  return {
    event_id: event.id,
    services: plans
      .filter((plan) => plan.status !== "canceled")
      .map((plan) => ({
        plan_id: plan.id,
        planned_guest_count: plan.planned_guest_count == null ? null : Number(plan.planned_guest_count),
        recipes: planRecipes
          .filter((recipe) => recipe.plan_id === plan.id)
          .map((recipe) => ({
            plan_recipe_id: recipe.id,
            recipe_id: recipe.recipe_id,
            recipe_version_id: recipe.recipe_version_id,
            planned_servings: Number(recipe.planned_servings ?? 0),
            multiplier: Number(recipe.multiplier ?? 0),
          }))
          .sort((left, right) => left.plan_recipe_id.localeCompare(right.plan_recipe_id)),
      }))
      .sort((left, right) => left.plan_id.localeCompare(right.plan_id)),
  };
}

/** Extracts the operational projection from both legacy and versioned snapshot payloads. */
export function operationalPayloadFromSnapshotConfiguration(
  payload: Record<string, unknown> | null,
): OperationalConfigurationPayload | null {
  if (!payload || typeof payload.event_id !== "string" || !Array.isArray(payload.services)) return null;
  const services: OperationalService[] = [];

  for (const rawService of payload.services) {
    if (!isRecord(rawService) || typeof rawService.plan_id !== "string" || !Array.isArray(rawService.recipes)) return null;
    const guestCount = rawService.planned_guest_count == null ? null : toFiniteNumber(rawService.planned_guest_count);
    if (rawService.planned_guest_count != null && guestCount == null) return null;
    const recipes: OperationalRecipe[] = [];
    for (const rawRecipe of rawService.recipes) {
      if (
        !isRecord(rawRecipe) ||
        typeof rawRecipe.plan_recipe_id !== "string" ||
        typeof rawRecipe.recipe_id !== "string" ||
        typeof rawRecipe.recipe_version_id !== "string"
      ) {
        return null;
      }
      const plannedServings = toFiniteNumber(rawRecipe.planned_servings);
      const multiplier = toFiniteNumber(rawRecipe.multiplier);
      if (plannedServings == null || multiplier == null) return null;
      recipes.push({
        plan_recipe_id: rawRecipe.plan_recipe_id,
        recipe_id: rawRecipe.recipe_id,
        recipe_version_id: rawRecipe.recipe_version_id,
        planned_servings: plannedServings,
        multiplier,
      });
    }
    services.push({ plan_id: rawService.plan_id, planned_guest_count: guestCount, recipes: recipes.sort((a, b) => a.plan_recipe_id.localeCompare(b.plan_recipe_id)) });
  }

  return { event_id: payload.event_id, services: services.sort((a, b) => a.plan_id.localeCompare(b.plan_id)) };
}

export function hasSameOperationalConfiguration(
  current: OperationalConfigurationPayload,
  snapshotPayload: Record<string, unknown> | null,
): boolean {
  const snapshot = operationalPayloadFromSnapshotConfiguration(snapshotPayload);
  return snapshot != null && stableStringify(current) === stableStringify(snapshot);
}
