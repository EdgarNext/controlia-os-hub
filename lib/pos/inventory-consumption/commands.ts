import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isAllowedSimulationMode } from "./normalizers";

export async function saveInventorySettings(input: {
  tenantId: string;
  enabled: boolean;
  mode: string;
  actorUserId: string;
}) {
  if (!isAllowedSimulationMode(input.mode)) {
    throw new Error("Solo se permite disabled o simulation en esta fase.");
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("sales_pos_inventory_settings").upsert(
    {
      tenant_id: input.tenantId,
      enabled: input.enabled,
      mode: input.mode,
      consume_prepared_on: "kitchen_dispatch",
      updated_by: input.actorUserId,
      created_by: input.actorUserId,
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw new Error(`Unable to save POS inventory settings: ${error.message}`);
}

export async function upsertBinding(input: {
  tenantId: string;
  actorUserId: string;
  bindingId?: string | null;
  productId: string;
  recipeId: string;
  recipeVersionId: string;
  consumptionPolicy: "kitchen_dispatch" | "disabled";
  isActive: boolean;
  notes: string | null;
}) {
  const supabase = await getSupabaseServerClient();
  const payload = {
    tenant_id: input.tenantId,
    product_id: input.productId,
    recipe_id: input.recipeId,
    recipe_version_id: input.recipeVersionId,
    consumption_policy: input.consumptionPolicy,
    is_active: input.isActive,
    notes: input.notes,
    updated_by: input.actorUserId,
    created_by: input.actorUserId,
  };

  const query = supabase.from("sales_pos_product_recipe_bindings");
  const result = input.bindingId
    ? await query.update(payload).eq("tenant_id", input.tenantId).eq("id", input.bindingId)
    : await query.insert(payload);

  if (result.error) throw new Error(`Unable to save binding: ${result.error.message}`);
}

export async function setBindingActive(input: {
  tenantId: string;
  actorUserId: string;
  bindingId: string;
  isActive: boolean;
}) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("sales_pos_product_recipe_bindings")
    .update({ is_active: input.isActive, updated_by: input.actorUserId })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.bindingId);
  if (error) throw new Error(`Unable to update binding status: ${error.message}`);
}

export async function upsertModifierRule(input: {
  tenantId: string;
  actorUserId: string;
  ruleId?: string | null;
  name: string;
  ingredientInventoryItemId: string;
  operation: "remove_base" | "add_delta" | "subtract_delta";
  deltaQuantity: number | null;
  deltaUnitId: string | null;
  appliesToProductId: string | null;
  isActive: boolean;
  notes: string | null;
}) {
  const supabase = await getSupabaseServerClient();
  const payload = {
    tenant_id: input.tenantId,
    name: input.name,
    ingredient_inventory_item_id: input.ingredientInventoryItemId,
    operation: input.operation,
    delta_quantity: input.deltaQuantity,
    delta_unit_id: input.deltaUnitId,
    applies_to_product_id: input.appliesToProductId,
    is_active: input.isActive,
    notes: input.notes,
    updated_by: input.actorUserId,
    created_by: input.actorUserId,
  };
  const query = supabase.from("sales_pos_inventory_modifier_rules");
  const result = input.ruleId
    ? await query.update(payload).eq("tenant_id", input.tenantId).eq("id", input.ruleId)
    : await query.insert(payload);
  if (result.error) throw new Error(`Unable to save modifier rule: ${result.error.message}`);
}

export async function setRuleActive(input: {
  tenantId: string;
  actorUserId: string;
  ruleId: string;
  isActive: boolean;
}) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("sales_pos_inventory_modifier_rules")
    .update({ is_active: input.isActive, updated_by: input.actorUserId })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.ruleId);
  if (error) throw new Error(`Unable to update modifier rule status: ${error.message}`);
}

export async function upsertMatcher(input: {
  tenantId: string;
  actorUserId: string;
  matcherId?: string | null;
  ruleId: string;
  matcherType: "modifier_option_id" | "modifier_option_name" | "normalized_text";
  matcherValue: string;
  normalizedValue: string;
  priority: number;
  isActive: boolean;
}) {
  const supabase = await getSupabaseServerClient();
  const payload = {
    tenant_id: input.tenantId,
    rule_id: input.ruleId,
    matcher_type: input.matcherType,
    matcher_value: input.matcherValue,
    normalized_value: input.normalizedValue,
    priority: input.priority,
    is_active: input.isActive,
    updated_by: input.actorUserId,
    created_by: input.actorUserId,
  };

  const query = supabase.from("sales_pos_inventory_modifier_rule_matchers");
  const result = input.matcherId
    ? await query.update(payload).eq("tenant_id", input.tenantId).eq("id", input.matcherId)
    : await query.insert(payload);
  if (result.error) throw new Error(`Unable to save matcher alias: ${result.error.message}`);
}

export async function setMatcherActive(input: {
  tenantId: string;
  actorUserId: string;
  matcherId: string;
  isActive: boolean;
}) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("sales_pos_inventory_modifier_rule_matchers")
    .update({ is_active: input.isActive, updated_by: input.actorUserId })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.matcherId);
  if (error) throw new Error(`Unable to update matcher status: ${error.message}`);
}

