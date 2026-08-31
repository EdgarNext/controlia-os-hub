const MATERIAL_VARIATION_EPSILON = 0.01;

export function hasMaterialCostVariation(
  initialCost: number | null,
  currentCost: number | null,
  variationAmount: number | null,
): boolean {
  if (variationAmount != null) return Math.abs(variationAmount) >= MATERIAL_VARIATION_EPSILON;
  if (initialCost == null || currentCost == null) return false;
  return Math.abs(currentCost - initialCost) >= MATERIAL_VARIATION_EPSILON;
}

export function hasComparableCostValues(initialCost: number | null, currentCost: number | null): boolean {
  return initialCost != null && currentCost != null;
}

export function hasMaterialContribution(value: number | null): boolean {
  return value != null && Math.abs(value) >= MATERIAL_VARIATION_EPSILON;
}

export function getRecipeDisclosureLabels(count: number): { closed: string; open: string } {
  return {
    closed: `Ver ${count.toLocaleString("es-MX")} recetas`,
    open: "Ocultar recetas",
  };
}
