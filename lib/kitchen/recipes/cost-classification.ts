const DOCUMENTED_ZERO_COST_ITEM_NAMES = new Set([
  "agua",
  "agua gramos",
  "cordon de res",
]);

function normalizeItemName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export type KitchenRecipeUnitCostClassification =
  | "valid_cost"
  | "documented_zero_cost"
  | "missing_current_cost"
  | "undocumented_zero_cost"
  | "negative_cost";

export function isDocumentedZeroCostItem(itemName: string): boolean {
  return DOCUMENTED_ZERO_COST_ITEM_NAMES.has(normalizeItemName(itemName));
}

export function classifyKitchenRecipeUnitCost(input: {
  itemName: string;
  currentUnitCost: number | null | undefined;
}): KitchenRecipeUnitCostClassification {
  const rawCost = input.currentUnitCost;
  if (rawCost == null) return "missing_current_cost";

  const numericCost = Number(rawCost);
  if (Number.isNaN(numericCost)) return "missing_current_cost";
  if (numericCost < 0) return "negative_cost";
  if (numericCost > 0) return "valid_cost";
  if (isDocumentedZeroCostItem(input.itemName)) return "documented_zero_cost";
  return "undocumented_zero_cost";
}
