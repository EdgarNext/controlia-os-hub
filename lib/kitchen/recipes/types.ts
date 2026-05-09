export type KitchenRecipe = {
  id: string;
  tenant_id: string;
  name: string;
  normalized_name: string;
  description: string | null;
  category: string | null;
  status: "draft" | "active" | "archived";
  default_yield_quantity: number;
  default_yield_unit_id: string | null;
  default_servings: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type KitchenRecipeVersion = {
  id: string;
  tenant_id: string;
  recipe_id: string;
  version_number: number;
  status: "draft" | "active" | "archived";
  yield_quantity: number;
  yield_unit_id: string | null;
  servings: number | null;
  instructions: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
  kitchen_inventory_units?: { id: string; code: string; name: string } | null;
};

export type KitchenRecipeLine = {
  id: string;
  tenant_id: string;
  recipe_version_id: string;
  line_type: "inventory_item" | "sub_recipe";
  item_id: string | null;
  sub_recipe_version_id: string | null;
  quantity: number;
  unit_id: string;
  waste_percent: number;
  notes: string | null;
  sort_order: number;
  kitchen_inventory_items?: { id: string; name: string; current_unit_cost: number; default_unit_id: string } | null;
  kitchen_inventory_units?: { id: string; code: string; name: string } | null;
  sub_recipe_version?: { id: string; recipe_id: string; version_number: number; yield_quantity: number; kitchen_recipe_recipes?: { id: string; name: string } | null } | null;
};

export type KitchenRecipeCostWarning = {
  type: "missing_cost" | "missing_conversion" | "cycle" | "missing_sub_recipe" | "empty_recipe";
  message: string;
  lineId?: string;
};

export type KitchenRecipeCostBreakdownLine = {
  lineId: string;
  lineType: "inventory_item" | "sub_recipe";
  label: string;
  quantity: number;
  unitCode: string;
  lineCost: number;
  warning?: string;
};

export type KitchenRecipeCostResult = {
  totalCost: number;
  costPerServing: number | null;
  costPerYieldUnit: number | null;
  warnings: KitchenRecipeCostWarning[];
  lines: KitchenRecipeCostBreakdownLine[];
};
