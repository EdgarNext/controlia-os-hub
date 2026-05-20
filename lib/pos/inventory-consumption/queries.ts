import { listKitchenRecipeReadiness } from "@/lib/kitchen/recipes/readiness";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type PosInventorySettingsRow = {
  id: string;
  tenant_id: string;
  enabled: boolean;
  mode: "disabled" | "simulation" | "active";
  consume_prepared_on: "kitchen_dispatch";
};

export type PosInventoryBindingRow = {
  id: string;
  tenant_id: string;
  product_id: string;
  recipe_id: string;
  recipe_version_id: string;
  consumption_policy: "kitchen_dispatch" | "payment_close" | "disabled";
  is_active: boolean;
  notes: string | null;
  product_name: string | null;
  recipe_name: string | null;
  recipe_version_number: number | null;
};

export type PosInventoryRuleRow = {
  id: string;
  tenant_id: string;
  name: string;
  ingredient_inventory_item_id: string;
  operation: "remove_base" | "add_delta" | "subtract_delta";
  delta_quantity: number | null;
  delta_unit_id: string | null;
  applies_to_product_id: string | null;
  is_active: boolean;
  notes: string | null;
  ingredient_name: string | null;
  unit_code: string | null;
  product_name: string | null;
};

export type PosInventoryMatcherRow = {
  id: string;
  tenant_id: string;
  rule_id: string;
  matcher_type: "modifier_option_id" | "modifier_option_name" | "normalized_text";
  matcher_value: string;
  normalized_value: string;
  priority: number;
  is_active: boolean;
  rule_name: string | null;
};

type BindingSelectRow = {
  id: string;
  tenant_id: string;
  product_id: string;
  recipe_id: string;
  recipe_version_id: string;
  consumption_policy: "kitchen_dispatch" | "payment_close" | "disabled";
  is_active: boolean;
  notes: string | null;
  products: { name: string | null } | null;
  kitchen_recipe_recipes: { name: string | null } | null;
  kitchen_recipe_versions: { version_number: number | null } | null;
};

type RuleSelectRow = {
  id: string;
  tenant_id: string;
  name: string;
  ingredient_inventory_item_id: string;
  operation: "remove_base" | "add_delta" | "subtract_delta";
  delta_quantity: number | null;
  delta_unit_id: string | null;
  applies_to_product_id: string | null;
  is_active: boolean;
  notes: string | null;
  kitchen_inventory_items: { name: string | null } | null;
  kitchen_inventory_units: { code: string | null } | null;
  products: { name: string | null } | null;
};

type MatcherSelectRow = {
  id: string;
  tenant_id: string;
  rule_id: string;
  matcher_type: "modifier_option_id" | "modifier_option_name" | "normalized_text";
  matcher_value: string;
  normalized_value: string;
  priority: number;
  is_active: boolean;
  sales_pos_inventory_modifier_rules: { name: string | null } | null;
};

export type InventoryItemForRuleSelect = {
  id: string;
  name: string;
  default_unit_id: string | null;
  is_active: boolean;
  kitchen_inventory_units: { code: string | null } | null;
};

export async function getPosInventorySettings(tenantId: string): Promise<PosInventorySettingsRow | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_pos_inventory_settings")
    .select("id, tenant_id, enabled, mode, consume_prepared_on")
    .eq("tenant_id", tenantId)
    .maybeSingle<PosInventorySettingsRow>();

  if (error) throw new Error(`Unable to load POS inventory settings: ${error.message}`);
  return data ?? null;
}

export async function listPosProductsForInventory(tenantId: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, product_type, class, is_active, deleted_at")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });
  if (error) throw new Error(`Unable to load POS products: ${error.message}`);
  return data ?? [];
}

export async function listRecipeVersionsForInventory(tenantId: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_recipe_versions")
    .select("id, tenant_id, recipe_id, version_number, status, updated_at")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Unable to load recipe versions: ${error.message}`);
  return data ?? [];
}

export async function listRecipesForInventory(tenantId: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_recipe_recipes")
    .select("id, tenant_id, name, is_active, status")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(`Unable to load recipes: ${error.message}`);
  return data ?? [];
}

export async function listBindings(tenantId: string): Promise<PosInventoryBindingRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_pos_product_recipe_bindings")
    .select(
      "id, tenant_id, product_id, recipe_id, recipe_version_id, consumption_policy, is_active, notes, products(name), kitchen_recipe_recipes(name), kitchen_recipe_versions(version_number)",
    )
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Unable to load bindings: ${error.message}`);

  return ((data ?? []) as BindingSelectRow[]).map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    product_id: row.product_id,
    recipe_id: row.recipe_id,
    recipe_version_id: row.recipe_version_id,
    consumption_policy: row.consumption_policy,
    is_active: row.is_active,
    notes: row.notes ?? null,
    product_name: row.products?.name ?? null,
    recipe_name: row.kitchen_recipe_recipes?.name ?? null,
    recipe_version_number: row.kitchen_recipe_versions?.version_number ?? null,
  }));
}

export async function listInventoryItemsForRules(tenantId: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_items")
    .select("id, name, default_unit_id, is_active, kitchen_inventory_units!kitchen_inventory_items_default_unit_id_fkey(code)")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(`Unable to load inventory items: ${error.message}`);
  return (data ?? []) as InventoryItemForRuleSelect[];
}

export async function listRules(tenantId: string): Promise<PosInventoryRuleRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_pos_inventory_modifier_rules")
    .select(
      "id, tenant_id, name, ingredient_inventory_item_id, operation, delta_quantity, delta_unit_id, applies_to_product_id, is_active, notes, kitchen_inventory_items(name), kitchen_inventory_units(code), products(name)",
    )
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Unable to load modifier rules: ${error.message}`);

  return ((data ?? []) as RuleSelectRow[]).map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    ingredient_inventory_item_id: row.ingredient_inventory_item_id,
    operation: row.operation,
    delta_quantity: row.delta_quantity == null ? null : Number(row.delta_quantity),
    delta_unit_id: row.delta_unit_id,
    applies_to_product_id: row.applies_to_product_id,
    is_active: row.is_active,
    notes: row.notes ?? null,
    ingredient_name: row.kitchen_inventory_items?.name ?? null,
    unit_code: row.kitchen_inventory_units?.code ?? null,
    product_name: row.products?.name ?? null,
  }));
}

export async function listMatchers(tenantId: string): Promise<PosInventoryMatcherRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_pos_inventory_modifier_rule_matchers")
    .select("id, tenant_id, rule_id, matcher_type, matcher_value, normalized_value, priority, is_active, sales_pos_inventory_modifier_rules(name)")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Unable to load matcher aliases: ${error.message}`);

  return ((data ?? []) as MatcherSelectRow[]).map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    rule_id: row.rule_id,
    matcher_type: row.matcher_type,
    matcher_value: row.matcher_value,
    normalized_value: row.normalized_value,
    priority: row.priority,
    is_active: row.is_active,
    rule_name: row.sales_pos_inventory_modifier_rules?.name ?? null,
  }));
}

export async function getReadinessMap(tenantId: string): Promise<Map<string, string>> {
  try {
    const rows = await listKitchenRecipeReadiness(tenantId);
    return new Map(rows.map((row) => [row.recipe_id, row.readiness_status]));
  } catch {
    return new Map<string, string>();
  }
}
