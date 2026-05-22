import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  calculatePosInventoryConsumptionForKitchenDispatch,
  type EngineBinding,
  type EngineModifierMatcher,
  type EngineModifierRule,
  type EngineRecipeLine,
} from "./engine";
import { isAllowedSimulationMode } from "./normalizers";
import { getPosInventorySettings, type KitchenDispatchSimulationSource } from "./queries";

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

async function loadEngineBindings(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<EngineBinding[]> {
  const { data, error } = await supabase
    .from("sales_pos_product_recipe_bindings")
    .select("id, tenant_id, product_id, recipe_id, recipe_version_id, consumption_policy, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("consumption_policy", "kitchen_dispatch");
  if (error) throw new Error(`Unable to load active bindings for simulation: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: String((row as { id: string }).id),
    tenantId: String((row as { tenant_id: string }).tenant_id),
    productId: String((row as { product_id: string }).product_id),
    recipeId: String((row as { recipe_id: string }).recipe_id),
    recipeVersionId: String((row as { recipe_version_id: string }).recipe_version_id),
    consumptionPolicy: (row as { consumption_policy: "kitchen_dispatch" | "disabled" }).consumption_policy,
    isActive: Boolean((row as { is_active: boolean }).is_active),
  }));
}

async function loadEngineRecipeLines(
  supabase: SupabaseClient,
  tenantId: string,
  recipeVersionIds: string[],
): Promise<EngineRecipeLine[]> {
  if (recipeVersionIds.length <= 0) return [];
  const { data, error } = await supabase
    .from("kitchen_recipe_lines")
    .select("tenant_id, recipe_version_id, line_type, item_id, quantity, unit_id")
    .eq("tenant_id", tenantId)
    .in("recipe_version_id", recipeVersionIds);
  if (error) throw new Error(`Unable to load recipe lines for simulation: ${error.message}`);
  return (data ?? [])
    .filter((row) => (row as { line_type: string }).line_type === "inventory_item")
    .filter(
      (row) =>
        (row as { item_id: string | null }).item_id &&
        (row as { unit_id: string | null }).unit_id &&
        Number((row as { quantity: number | null }).quantity ?? 0) > 0,
    )
    .map((row) => ({
      tenantId: String((row as { tenant_id: string }).tenant_id),
      recipeVersionId: String((row as { recipe_version_id: string }).recipe_version_id),
      inventoryItemId: String((row as { item_id: string }).item_id),
      quantity: Number((row as { quantity: number }).quantity),
      unitId: String((row as { unit_id: string }).unit_id),
    }));
}

async function loadEngineRules(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<EngineModifierRule[]> {
  const { data, error } = await supabase
    .from("sales_pos_inventory_modifier_rules")
    .select("id, tenant_id, ingredient_inventory_item_id, operation, delta_quantity, delta_unit_id, applies_to_product_id, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  if (error) throw new Error(`Unable to load active modifier rules for simulation: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: String((row as { id: string }).id),
    tenantId: String((row as { tenant_id: string }).tenant_id),
    ingredientInventoryItemId: String(
      (row as { ingredient_inventory_item_id: string }).ingredient_inventory_item_id,
    ),
    operation: (row as { operation: "remove_base" | "add_delta" | "subtract_delta" }).operation,
    deltaQuantity:
      (row as { delta_quantity: number | null }).delta_quantity == null
        ? null
        : Number((row as { delta_quantity: number }).delta_quantity),
    deltaUnitId:
      (row as { delta_unit_id: string | null }).delta_unit_id == null
        ? null
        : String((row as { delta_unit_id: string }).delta_unit_id),
    appliesToProductId:
      (row as { applies_to_product_id: string | null }).applies_to_product_id == null
        ? null
        : String((row as { applies_to_product_id: string }).applies_to_product_id),
    isActive: Boolean((row as { is_active: boolean }).is_active),
  }));
}

async function loadEngineMatchers(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<EngineModifierMatcher[]> {
  const { data, error } = await supabase
    .from("sales_pos_inventory_modifier_rule_matchers")
    .select("id, tenant_id, rule_id, matcher_type, matcher_value, normalized_value, priority, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  if (error) throw new Error(`Unable to load active matcher aliases for simulation: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: String((row as { id: string }).id),
    tenantId: String((row as { tenant_id: string }).tenant_id),
    ruleId: String((row as { rule_id: string }).rule_id),
    matcherType: (row as { matcher_type: "modifier_option_id" | "modifier_option_name" | "normalized_text" })
      .matcher_type,
    matcherValue: String((row as { matcher_value: string }).matcher_value),
    normalizedValue: String((row as { normalized_value: string }).normalized_value),
    priority: Number((row as { priority: number }).priority),
    isActive: Boolean((row as { is_active: boolean }).is_active),
  }));
}

async function loadKitchenDispatchSimulationSourceWithAdmin(
  supabase: SupabaseClient,
  tenantId: string,
  kitchenBatchId: string,
): Promise<KitchenDispatchSimulationSource | null> {
  const { data: batch, error: batchError } = await supabase
    .from("kitchen_ticket_batches")
    .select("id, tenant_id, sales_account_id, trigger_type, batch_status")
    .eq("tenant_id", tenantId)
    .eq("id", kitchenBatchId)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      sales_account_id: string;
      trigger_type: "account_opened" | "line_added" | "line_updated" | "line_voided" | "manual_reprint";
      batch_status: "pending" | "sent" | "confirmed" | "failed" | "canceled";
    }>();
  if (batchError) throw new Error(`Unable to load kitchen batch: ${batchError.message}`);
  if (!batch) return null;

  const { data: kitchenLines, error: kitchenLinesError } = await supabase
    .from("kitchen_ticket_lines")
    .select("id, sales_account_line_id, ticket_action, quantity_delta, product_name_snapshot")
    .eq("tenant_id", tenantId)
    .eq("kitchen_ticket_batch_id", kitchenBatchId)
    .order("line_sort_order", { ascending: true });
  if (kitchenLinesError) {
    throw new Error(`Unable to load kitchen lines for simulation: ${kitchenLinesError.message}`);
  }

  const salesAccountLineIds = (kitchenLines ?? [])
    .map((line) => String((line as { sales_account_line_id: string }).sales_account_line_id))
    .filter(Boolean);

  let linesById = new Map<
    string,
    { product_id: string; selected_modifiers_snapshot: Record<string, unknown>[] }
  >();
  if (salesAccountLineIds.length > 0) {
    const { data: accountLines, error: accountLinesError } = await supabase
      .from("sales_account_lines")
      .select("id, product_id, selected_modifiers_snapshot")
      .eq("tenant_id", tenantId)
      .in("id", salesAccountLineIds);
    if (accountLinesError) {
      throw new Error(`Unable to load sales account lines for simulation: ${accountLinesError.message}`);
    }
    linesById = new Map(
      (accountLines ?? []).map((line) => [
        String((line as { id: string }).id),
        {
          product_id: String((line as { product_id: string }).product_id),
          selected_modifiers_snapshot:
            (((line as { selected_modifiers_snapshot: Record<string, unknown>[] | null })
              .selected_modifiers_snapshot as Record<string, unknown>[] | null) ?? []),
        },
      ]),
    );
  }

  const dispatchItems = (kitchenLines ?? [])
    .map((kitchenLine) => {
      const salesAccountLineId = String(
        (kitchenLine as { sales_account_line_id: string }).sales_account_line_id,
      );
      const linked = linesById.get(salesAccountLineId);
      if (!linked) return null;
      const sourceLabel =
        String((kitchenLine as { product_name_snapshot?: string }).product_name_snapshot ?? "").trim() ||
        linked.product_id;

      return {
        kitchenTicketLineId: String((kitchenLine as { id: string }).id),
        salesAccountLineId,
        ticketAction: (kitchenLine as { ticket_action: "add" | "adjust" | "void" }).ticket_action,
        quantityDelta: Number((kitchenLine as { quantity_delta: number }).quantity_delta ?? 0),
        productId: linked.product_id,
        selectedModifiersSnapshot: linked.selected_modifiers_snapshot,
        sourceLabel,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null);

  return {
    kitchenBatchId: batch.id,
    salesAccountId: batch.sales_account_id,
    triggerType: batch.trigger_type,
    batchStatus: batch.batch_status,
    dispatchItems,
  };
}

export async function simulateKitchenDispatchInventoryConsumption(input: {
  tenantId: string;
  actorUserId: string;
  kitchenBatchId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const settings = await getPosInventorySettings(input.tenantId);
  if (!settings) throw new Error("No POS inventory settings configured for this tenant.");
  if (!settings.enabled) throw new Error("POS inventory simulation is disabled for this tenant.");
  if (settings.mode !== "simulation") {
    throw new Error("Simulation can run only when mode=simulation.");
  }
  if (settings.consume_prepared_on !== "kitchen_dispatch") {
    throw new Error("consume_prepared_on must be kitchen_dispatch.");
  }

  const source = await loadKitchenDispatchSimulationSourceWithAdmin(
    supabase,
    input.tenantId,
    input.kitchenBatchId,
  );
  if (!source) {
    throw new Error("Kitchen batch not found in tenant scope.");
  }
  if (source.dispatchItems.length <= 0) {
    throw new Error("Kitchen batch has no dispatch items to simulate.");
  }

  const [bindings, rules, matchers] = await Promise.all([
    loadEngineBindings(supabase, input.tenantId),
    loadEngineRules(supabase, input.tenantId),
    loadEngineMatchers(supabase, input.tenantId),
  ]);
  const recipeLines = await loadEngineRecipeLines(
    supabase,
    input.tenantId,
    bindings.map((binding) => binding.recipeVersionId),
  );

  const calculation = calculatePosInventoryConsumptionForKitchenDispatch({
    tenantId: input.tenantId,
    salesAccountId: source.salesAccountId,
    kitchenBatchId: source.kitchenBatchId,
    settings: {
      enabled: settings.enabled,
      mode: settings.mode,
      consumePreparedOn: settings.consume_prepared_on,
    },
    dispatchItems: source.dispatchItems,
    bindings,
    recipeLines,
    modifierRules: rules,
    modifierMatchers: matchers,
  });

  const { data: existingEvent, error: existingEventError } = await supabase
    .from("sales_pos_inventory_consumption_events")
    .select("id, tenant_id, mode, status, idempotency_key, created_at")
    .eq("tenant_id", input.tenantId)
    .eq("idempotency_key", calculation.idempotencyKey)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      mode: string;
      status: string;
      idempotency_key: string;
      created_at: string;
    }>();
  if (existingEventError) {
    throw new Error(`Unable to verify POS consumption event idempotency: ${existingEventError.message}`);
  }

  if (existingEvent) {
    const { data: existingLines, error: existingLinesError } = await supabase
      .from("sales_pos_inventory_consumption_lines")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("event_id", existingEvent.id);
    if (existingLinesError) {
      throw new Error(`Unable to load existing simulation lines: ${existingLinesError.message}`);
    }
    return {
      eventId: existingEvent.id,
      idempotencyKey: existingEvent.idempotency_key,
      mode: existingEvent.mode,
      status: existingEvent.status,
      created: false,
      linesInserted: (existingLines ?? []).length,
      warnings: [],
      skippedItems: [],
      unmatchedModifiers: [],
    };
  }

  const eventInsert = {
    tenant_id: input.tenantId,
    mode: "simulation",
    status: "calculated",
    trigger_type: "kitchen_dispatch",
    source_type: "sales_pos_kitchen_dispatch",
    source_id: source.kitchenBatchId,
    idempotency_key: calculation.idempotencyKey,
    sales_account_id: source.salesAccountId,
    kitchen_batch_id: source.kitchenBatchId,
    calculated_at: new Date().toISOString(),
    metadata: {
      ...calculation.metadata,
      trigger_type: source.triggerType,
      batch_status: source.batchStatus,
      warnings: calculation.warnings,
      skipped_items: calculation.skippedItems,
      unmatched_modifiers: calculation.unmatchedModifiers,
    },
    created_by: input.actorUserId,
    updated_by: input.actorUserId,
  };
  const { data: insertedEvent, error: eventError } = await supabase
    .from("sales_pos_inventory_consumption_events")
    .insert(eventInsert)
    .select("id, idempotency_key, mode, status")
    .single<{ id: string; idempotency_key: string; mode: string; status: string }>();

  if (eventError) {
    throw new Error(`Unable to create simulation event: ${eventError.message}`);
  }

  if (calculation.lines.length > 0) {
    const { error: linesError } = await supabase.from("sales_pos_inventory_consumption_lines").insert(
      calculation.lines.map((line) => ({
        tenant_id: line.tenantId,
        event_id: insertedEvent.id,
        product_id: line.productId,
        order_item_id: line.orderItemId,
        recipe_id: line.recipeId,
        recipe_version_id: line.recipeVersionId,
        inventory_item_id: line.inventoryItemId,
        quantity: line.quantity,
        unit_id: line.unitId,
        reason: line.reason,
        modifier_rule_id: line.modifierRuleId,
        modifier_matcher_id: line.modifierMatcherId,
        source_modifier_text: line.sourceModifierText,
        warning_message: line.warningMessage,
        movement_id: null,
        metadata: {},
        created_by: input.actorUserId,
      })),
    );
    if (linesError) {
      await supabase
        .from("sales_pos_inventory_consumption_events")
        .update({
          status: "error",
          error_message: `Unable to create simulation lines: ${linesError.message}`,
          updated_by: input.actorUserId,
        })
        .eq("tenant_id", input.tenantId)
        .eq("id", insertedEvent.id);
      throw new Error(`Unable to create simulation lines: ${linesError.message}`);
    }
  }

  return {
    eventId: insertedEvent.id,
    idempotencyKey: insertedEvent.idempotency_key,
    mode: insertedEvent.mode,
    status: insertedEvent.status,
    created: true,
    linesInserted: calculation.lines.length,
    warnings: calculation.warnings,
    skippedItems: calculation.skippedItems,
    unmatchedModifiers: calculation.unmatchedModifiers,
  };
}
