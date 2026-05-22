import type { SupabaseClient } from "@supabase/supabase-js";
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

export type PosConsumptionReadiness = {
  usable: boolean;
  reasons: string[];
  lineCount: number;
  invalidLineCount: number;
  unresolvedIngredientCount: number;
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
  products: { name: string | null } | Array<{ name: string | null }> | null;
  kitchen_recipe_recipes: { name: string | null } | Array<{ name: string | null }> | null;
  kitchen_recipe_versions:
    | { version_number: number | null }
    | Array<{ version_number: number | null }>
    | null;
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
  kitchen_inventory_items:
    | { name: string | null }
    | Array<{ name: string | null }>
    | null;
  kitchen_inventory_units:
    | { code: string | null }
    | Array<{ code: string | null }>
    | null;
  products: { name: string | null } | Array<{ name: string | null }> | null;
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
  sales_pos_inventory_modifier_rules:
    | { name: string | null }
    | Array<{ name: string | null }>
    | null;
};

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export type InventoryItemForRuleSelect = {
  id: string;
  name: string;
  default_unit_id: string | null;
  is_active: boolean;
  kitchen_inventory_units:
    | { code: string | null }
    | Array<{ code: string | null }>
    | null;
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
      "id, tenant_id, product_id, recipe_id, recipe_version_id, consumption_policy, is_active, notes, products!sales_pos_product_recipe_bindings_tenant_product_fkey(name), kitchen_recipe_recipes!sales_pos_product_recipe_bindings_tenant_recipe_fkey(name), kitchen_recipe_versions!sales_pos_product_recipe_bindings_tenant_recipe_version_fkey(version_number)",
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
    product_name: firstOrNull(row.products)?.name ?? null,
    recipe_name: firstOrNull(row.kitchen_recipe_recipes)?.name ?? null,
    recipe_version_number: firstOrNull(row.kitchen_recipe_versions)?.version_number ?? null,
  }));
}

export async function getBindingById(
  tenantId: string,
  bindingId: string,
): Promise<PosInventoryBindingRow | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_pos_product_recipe_bindings")
    .select(
      "id, tenant_id, product_id, recipe_id, recipe_version_id, consumption_policy, is_active, notes, products!sales_pos_product_recipe_bindings_tenant_product_fkey(name), kitchen_recipe_recipes!sales_pos_product_recipe_bindings_tenant_recipe_fkey(name), kitchen_recipe_versions!sales_pos_product_recipe_bindings_tenant_recipe_version_fkey(version_number)",
    )
    .eq("tenant_id", tenantId)
    .eq("id", bindingId)
    .maybeSingle();
  if (error) throw new Error(`Unable to load binding: ${error.message}`);
  if (!data) return null;
  const row = data as BindingSelectRow;
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    product_id: row.product_id,
    recipe_id: row.recipe_id,
    recipe_version_id: row.recipe_version_id,
    consumption_policy: row.consumption_policy,
    is_active: row.is_active,
    notes: row.notes ?? null,
    product_name: firstOrNull(row.products)?.name ?? null,
    recipe_name: firstOrNull(row.kitchen_recipe_recipes)?.name ?? null,
    recipe_version_number: firstOrNull(row.kitchen_recipe_versions)?.version_number ?? null,
  };
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
  return ((data ?? []) as InventoryItemForRuleSelect[]).map((row) => ({
    ...row,
    kitchen_inventory_units: firstOrNull(row.kitchen_inventory_units),
  }));
}

export async function listRules(tenantId: string): Promise<PosInventoryRuleRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_pos_inventory_modifier_rules")
    .select(
      "id, tenant_id, name, ingredient_inventory_item_id, operation, delta_quantity, delta_unit_id, applies_to_product_id, is_active, notes, kitchen_inventory_items!sales_pos_inventory_modifier_rules_tenant_item_fkey(name), kitchen_inventory_units!sales_pos_inventory_modifier_rules_tenant_delta_unit_fkey(code), products!sales_pos_inventory_modifier_rules_tenant_product_fkey(name)",
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
    ingredient_name: firstOrNull(row.kitchen_inventory_items)?.name ?? null,
    unit_code: firstOrNull(row.kitchen_inventory_units)?.code ?? null,
    product_name: firstOrNull(row.products)?.name ?? null,
  }));
}

export async function listMatchers(tenantId: string): Promise<PosInventoryMatcherRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_pos_inventory_modifier_rule_matchers")
    .select("id, tenant_id, rule_id, matcher_type, matcher_value, normalized_value, priority, is_active, sales_pos_inventory_modifier_rules!sales_pos_inventory_modifier_rule_matchers_rule_id_fkey(name)")
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
    rule_name: firstOrNull(row.sales_pos_inventory_modifier_rules)?.name ?? null,
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

type RecipeVersionLineRow = {
  recipe_version_id: string;
  line_type: "inventory_item" | "sub_recipe";
  item_id: string | null;
  quantity: number | null;
  unit_id: string | null;
};

export async function getRecipeVersionPosConsumptionReadiness(input: {
  tenantId: string;
  recipeId: string;
  recipeVersionId: string;
}): Promise<PosConsumptionReadiness> {
  const supabase = await getSupabaseServerClient();
  const [versionRes, linesRes, pendingRes] = await Promise.all([
    supabase
      .from("kitchen_recipe_versions")
      .select("id, recipe_id")
      .eq("tenant_id", input.tenantId)
      .eq("id", input.recipeVersionId)
      .eq("recipe_id", input.recipeId)
      .maybeSingle(),
    supabase
      .from("kitchen_recipe_lines")
      .select("recipe_version_id, line_type, item_id, quantity, unit_id")
      .eq("tenant_id", input.tenantId)
      .eq("recipe_version_id", input.recipeVersionId),
    supabase
      .from("kitchen_recipe_import_rows")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", input.tenantId)
      .eq("action", "alias_required")
      .eq("applied_recipe_id", input.recipeId)
      .in("status", ["warning", "error", "pending"]),
  ]);

  if (versionRes.error) {
    throw new Error(`Unable to validate recipe version for POS consumption: ${versionRes.error.message}`);
  }
  if (linesRes.error) {
    throw new Error(`Unable to validate recipe lines for POS consumption: ${linesRes.error.message}`);
  }
  if (pendingRes.error) {
    throw new Error(`Unable to validate unresolved ingredients for POS consumption: ${pendingRes.error.message}`);
  }

  if (!versionRes.data) {
    return {
      usable: false,
      reasons: ["La versión seleccionada no pertenece a la receta o al tenant."],
      lineCount: 0,
      invalidLineCount: 0,
      unresolvedIngredientCount: 0,
    };
  }

  const lines = (linesRes.data ?? []) as RecipeVersionLineRow[];
  const inventoryLines = lines.filter((line) => line.line_type === "inventory_item");
  const invalidLineCount = inventoryLines.filter(
    (line) =>
      !line.item_id ||
      line.quantity == null ||
      Number(line.quantity) <= 0 ||
      !line.unit_id,
  ).length;
  const unresolvedIngredientCount = pendingRes.count ?? 0;

  const reasons: string[] = [];
  if (inventoryLines.length <= 0) reasons.push("La versión no tiene líneas de inventario.");
  if (invalidLineCount > 0) reasons.push("La versión contiene líneas inválidas para consumo POS.");
  if (unresolvedIngredientCount > 0) reasons.push("La receta tiene ingredientes pendientes/no resueltos.");

  return {
    usable: reasons.length === 0,
    reasons,
    lineCount: inventoryLines.length,
    invalidLineCount,
    unresolvedIngredientCount,
  };
}

export type KitchenDispatchSimulationSource = {
  kitchenBatchId: string;
  salesAccountId: string;
  triggerType: "account_opened" | "line_added" | "line_updated" | "line_voided" | "manual_reprint";
  batchStatus: "pending" | "sent" | "confirmed" | "failed" | "canceled";
  dispatchItems: Array<{
    kitchenTicketLineId: string;
    salesAccountLineId: string;
    ticketAction: "add" | "adjust" | "void";
    quantityDelta: number;
    productId: string;
    selectedModifiersSnapshot: Record<string, unknown>[];
    sourceLabel: string;
  }>;
};

export type PosInventorySimulationEventRow = {
  event_id: string;
  created_at: string;
  calculated_at: string | null;
  status: "calculated" | "error" | string;
  mode: "simulation" | "active" | "disabled" | string;
  trigger_type: string;
  source_type: string;
  source_id: string;
  kitchen_batch_id: string | null;
  sales_account_id: string | null;
  sales_account_folio_text: string | null;
  idempotency_key: string;
  error_message: string | null;
  metadata: Record<string, unknown>;
  line_count: number;
  warning_count: number;
  distinct_inventory_item_count: number;
  product_names: string[];
  skipped_items: Array<{ productId: string; reason: string }>;
  unmatched_modifiers: Array<{ sourceModifierText: string }>;
};

export type PosInventorySimulationEventLineRow = {
  line_id: string;
  created_at: string;
  product_id: string | null;
  product_name: string | null;
  order_item_id: string | null;
  recipe_id: string | null;
  recipe_name: string | null;
  recipe_version_id: string | null;
  inventory_item_id: string | null;
  inventory_item_name: string | null;
  quantity: number;
  unit_id: string | null;
  unit_code: string | null;
  reason: string;
  modifier_rule_id: string | null;
  modifier_rule_name: string | null;
  source_modifier_text: string | null;
  warning_message: string | null;
  movement_id: string | null;
};

export type PosInventorySimulationEventDetail = {
  event: PosInventorySimulationEventRow | null;
  lines: PosInventorySimulationEventLineRow[];
};

export type RecentKitchenDispatchForSimulationRow = {
  kitchen_batch_id: string;
  created_at: string;
  sales_account_id: string;
  trigger_type: "account_opened" | "line_added" | "line_updated" | "line_voided" | "manual_reprint";
  batch_status: "pending" | "sent" | "confirmed" | "failed" | "canceled";
  line_count: number;
  product_names: string[];
  modifiers_detected: string[];
  has_product_with_active_binding: boolean;
  existing_event_id: string | null;
  existing_event_status: string | null;
  existing_event_mode: string | null;
  existing_event_idempotency_key: string | null;
};

export type RecentPaidSaleWithKitchenDispatchForSimulationRow = {
  sales_account_id: string;
  folio_text: string | null;
  folio_number: number | null;
  status: string;
  closed_at: string | null;
  total_cents: number;
  product_names: string[];
  modifiers_detected: string[];
  kitchen_batch_id: string | null;
  kitchen_batch_created_at: string | null;
  kitchen_batch_trigger_type:
    | "account_opened"
    | "line_added"
    | "line_updated"
    | "line_voided"
    | "manual_reprint"
    | null;
  kitchen_batch_status: "pending" | "sent" | "confirmed" | "failed" | "canceled" | null;
  kitchen_line_count: number;
  has_kitchen_batch: boolean;
  has_kitchen_lines: boolean;
  has_product_with_active_binding: boolean;
  existing_event_id: string | null;
  existing_event_status: string | null;
  existing_event_mode: string | null;
  existing_event_idempotency_key: string | null;
};

type PosConsumptionEventSelectRow = {
  id: string;
  created_at: string;
  calculated_at: string | null;
  status: string;
  mode: string;
  trigger_type: string;
  source_type: string;
  source_id: string;
  kitchen_batch_id: string | null;
  sales_account_id: string | null;
  idempotency_key: string;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
};

type SalesAccountFolioSelectRow = {
  id: string;
  folio_text: string | null;
};

type PosConsumptionLineSelectRow = {
  id: string;
  created_at: string;
  event_id: string;
  product_id: string | null;
  order_item_id: string | null;
  recipe_id: string | null;
  recipe_version_id: string | null;
  inventory_item_id: string | null;
  quantity: number | null;
  unit_id: string | null;
  reason: string | null;
  modifier_rule_id: string | null;
  source_modifier_text: string | null;
  warning_message: string | null;
  movement_id: string | null;
};

type KitchenBatchSelectRow = {
  id: string;
  created_at: string;
  sales_account_id: string;
  trigger_type: "account_opened" | "line_added" | "line_updated" | "line_voided" | "manual_reprint";
  batch_status: "pending" | "sent" | "confirmed" | "failed" | "canceled";
};

type KitchenBatchLineSelectRow = {
  kitchen_ticket_batch_id: string;
  sales_account_line_id: string;
};

type SalesAccountLineSelectRow = {
  id: string;
  sales_account_id: string;
  product_id: string;
  selected_modifiers_snapshot: Record<string, unknown>[] | null;
};

type BindingSelectActiveRow = {
  product_id: string;
};

type SalesAccountSelectRow = {
  id: string;
  status: string;
  folio_text: string | null;
  folio_number: number | null;
  closed_at: string | null;
  total_cents: number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toStringSafe(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function normalizeModifierPreviewText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function extractModifierPreviewText(snapshot: Record<string, unknown>): string | null {
  return (
    normalizeModifierPreviewText(snapshot.modifier_option_name) ??
    normalizeModifierPreviewText(snapshot.modifierOptionName) ??
    normalizeModifierPreviewText(snapshot.name) ??
    normalizeModifierPreviewText(snapshot.value) ??
    normalizeModifierPreviewText(snapshot.text) ??
    normalizeModifierPreviewText(snapshot.modifier_option_id) ??
    normalizeModifierPreviewText(snapshot.modifierOptionId)
  );
}

function parseSkippedItems(metadata: Record<string, unknown>): Array<{ productId: string; reason: string }> {
  return asArray(metadata.skipped_items)
    .map((entry) => asRecord(entry))
    .map((entry) => ({
      productId: toStringSafe(entry.productId || entry.product_id),
      reason: toStringSafe(entry.reason),
    }))
    .filter((entry) => entry.productId.length > 0);
}

function parseUnmatchedModifiers(
  metadata: Record<string, unknown>,
): Array<{ sourceModifierText: string }> {
  return asArray(metadata.unmatched_modifiers)
    .map((entry) => asRecord(entry))
    .map((entry) => ({
      sourceModifierText: toStringSafe(entry.sourceModifierText || entry.source_modifier_text),
    }))
    .filter((entry) => entry.sourceModifierText.length > 0);
}

export async function listRecentKitchenDispatchesForSimulation(
  tenantId: string,
  limit = 20,
  client?: SupabaseClient,
): Promise<RecentKitchenDispatchForSimulationRow[]> {
  const supabase = client ?? (await getSupabaseServerClient());
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const { data: batches, error: batchesError } = await supabase
    .from("kitchen_ticket_batches")
    .select("id, created_at, sales_account_id, trigger_type, batch_status")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  if (batchesError) {
    throw new Error(`Unable to load recent kitchen batches for simulation: ${batchesError.message}`);
  }

  const batchRows = (batches ?? []) as KitchenBatchSelectRow[];
  const batchIds = batchRows.map((row) => row.id);
  if (batchIds.length <= 0) return [];

  const { data: kitchenLines, error: linesError } = await supabase
    .from("kitchen_ticket_lines")
    .select("kitchen_ticket_batch_id, sales_account_line_id")
    .eq("tenant_id", tenantId)
    .in("kitchen_ticket_batch_id", batchIds);
  if (linesError) {
    throw new Error(`Unable to load recent kitchen batch lines for simulation: ${linesError.message}`);
  }
  const lineRows = (kitchenLines ?? []) as KitchenBatchLineSelectRow[];
  const salesAccountLineIds = Array.from(new Set(lineRows.map((line) => line.sales_account_line_id)));

  const { data: accountLines, error: accountLinesError } = salesAccountLineIds.length
    ? await supabase
        .from("sales_account_lines")
        .select("id, product_id, selected_modifiers_snapshot")
        .eq("tenant_id", tenantId)
        .in("id", salesAccountLineIds)
    : { data: [], error: null };
  if (accountLinesError) {
    throw new Error(`Unable to load sales account lines for dispatch simulation preview: ${accountLinesError.message}`);
  }
  const accountLineRows = (accountLines ?? []) as SalesAccountLineSelectRow[];
  const accountLineById = new Map(accountLineRows.map((row) => [row.id, row]));
  const productIds = Array.from(new Set(accountLineRows.map((row) => row.product_id)));

  const [products, activeBindings, events] = await Promise.all([
    productIds.length
      ? supabase.from("products").select("id, name").eq("tenant_id", tenantId).in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length
      ? supabase
          .from("sales_pos_product_recipe_bindings")
          .select("product_id")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .eq("consumption_policy", "kitchen_dispatch")
          .in("product_id", productIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("sales_pos_inventory_consumption_events")
      .select("id, kitchen_batch_id, idempotency_key, status, mode, created_at")
      .eq("tenant_id", tenantId)
      .in("kitchen_batch_id", batchIds),
  ]);

  if (products.error) throw new Error(`Unable to load products for dispatch simulation preview: ${products.error.message}`);
  if (activeBindings.error) {
    throw new Error(
      `Unable to load active recipe bindings for dispatch simulation preview: ${activeBindings.error.message}`,
    );
  }
  if (events.error) throw new Error(`Unable to load simulation events for dispatch preview: ${events.error.message}`);

  const productNameById = new Map(
    (products.data ?? []).map((row) => [String((row as { id: string }).id), String((row as { name: string }).name)]),
  );
  const boundProductIds = new Set(
    ((activeBindings.data ?? []) as BindingSelectActiveRow[]).map((row) => String(row.product_id)),
  );
  const eventByBatchId = new Map<
    string,
    { id: string; idempotency_key: string | null; status: string; mode: string; created_at: string }
  >();
  for (const event of events.data ?? []) {
    const typed = event as {
      id: string;
      kitchen_batch_id: string;
      idempotency_key: string | null;
      status: string;
      mode: string;
      created_at: string;
    };
    const current = eventByBatchId.get(String(typed.kitchen_batch_id));
    if (!current || new Date(typed.created_at).getTime() > new Date(current.created_at).getTime()) {
      eventByBatchId.set(String(typed.kitchen_batch_id), {
        id: typed.id,
        idempotency_key: typed.idempotency_key,
        status: typed.status,
        mode: typed.mode,
        created_at: typed.created_at,
      });
    }
  }

  const linesByBatch = new Map<string, KitchenBatchLineSelectRow[]>();
  for (const line of lineRows) {
    const group = linesByBatch.get(line.kitchen_ticket_batch_id) ?? [];
    group.push(line);
    linesByBatch.set(line.kitchen_ticket_batch_id, group);
  }

  return batchRows.map((batch) => {
    const batchLines = linesByBatch.get(batch.id) ?? [];
    const productNames = new Set<string>();
    const modifiersDetected = new Set<string>();
    let hasBoundProduct = false;

    for (const line of batchLines) {
      const accountLine = accountLineById.get(line.sales_account_line_id);
      if (!accountLine) continue;
      if (boundProductIds.has(accountLine.product_id)) hasBoundProduct = true;
      const productName = productNameById.get(accountLine.product_id);
      if (productName) productNames.add(productName);

      for (const modifier of accountLine.selected_modifiers_snapshot ?? []) {
        const text = extractModifierPreviewText(asRecord(modifier));
        if (text) modifiersDetected.add(text);
      }
    }

    const existingEvent = eventByBatchId.get(batch.id);
    return {
      kitchen_batch_id: batch.id,
      created_at: batch.created_at,
      sales_account_id: batch.sales_account_id,
      trigger_type: batch.trigger_type,
      batch_status: batch.batch_status,
      line_count: batchLines.length,
      product_names: Array.from(productNames),
      modifiers_detected: Array.from(modifiersDetected),
      has_product_with_active_binding: hasBoundProduct,
      existing_event_id: existingEvent?.id ?? null,
      existing_event_status: existingEvent?.status ?? null,
      existing_event_mode: existingEvent?.mode ?? null,
      existing_event_idempotency_key: existingEvent?.idempotency_key ?? null,
    };
  });
}

export async function listRecentPaidSalesWithKitchenDispatchesForSimulation(
  tenantId: string,
  limit = 25,
  query?: string | null,
  client?: SupabaseClient,
): Promise<RecentPaidSaleWithKitchenDispatchForSimulationRow[]> {
  const supabase = client ?? (await getSupabaseServerClient());
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const expandedLimit = Math.max(25, Math.min(safeLimit * 4, 200));
  const normalizedQuery = (query ?? "").trim().toLowerCase();

  const { data: salesAccounts, error: salesAccountsError } = await supabase
    .from("sales_accounts")
    .select("id, status, folio_text, folio_number, closed_at, total_cents")
    .eq("tenant_id", tenantId)
    .eq("status", "PAID")
    .order("closed_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(expandedLimit);
  if (salesAccountsError) {
    throw new Error(
      `Unable to load recent paid sales for kitchen dispatch correlation: ${salesAccountsError.message}`,
    );
  }

  let salesAccountRows = (salesAccounts ?? []) as SalesAccountSelectRow[];
  if (normalizedQuery.length > 0) {
    salesAccountRows = salesAccountRows.filter((row) => {
      const haystack = `${row.id} ${row.folio_text ?? ""} ${row.folio_number ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }
  salesAccountRows = salesAccountRows.slice(0, safeLimit);

  const salesAccountIds = salesAccountRows.map((row) => row.id);
  if (salesAccountIds.length <= 0) return [];

  const [accountLinesResult, kitchenBatchesResult] = await Promise.all([
    supabase
      .from("sales_account_lines")
      .select("id, sales_account_id, product_id, selected_modifiers_snapshot")
      .eq("tenant_id", tenantId)
      .in("sales_account_id", salesAccountIds)
      .eq("line_status", "active"),
    supabase
      .from("kitchen_ticket_batches")
      .select("id, created_at, sales_account_id, trigger_type, batch_status")
      .eq("tenant_id", tenantId)
      .in("sales_account_id", salesAccountIds)
      .order("created_at", { ascending: false }),
  ]);
  if (accountLinesResult.error) {
    throw new Error(
      `Unable to load account lines for paid sales dispatch correlation: ${accountLinesResult.error.message}`,
    );
  }
  if (kitchenBatchesResult.error) {
    throw new Error(
      `Unable to load kitchen batches for paid sales dispatch correlation: ${kitchenBatchesResult.error.message}`,
    );
  }

  const accountLines = (accountLinesResult.data ?? []) as SalesAccountLineSelectRow[];
  const accountLinesByAccount = new Map<string, SalesAccountLineSelectRow[]>();
  for (const line of accountLines) {
    const group = accountLinesByAccount.get(line.sales_account_id) ?? [];
    group.push(line);
    accountLinesByAccount.set(line.sales_account_id, group);
  }

  const allBatches = (kitchenBatchesResult.data ?? []) as KitchenBatchSelectRow[];
  const latestBatchByAccount = new Map<string, KitchenBatchSelectRow>();
  for (const batch of allBatches) {
    const current = latestBatchByAccount.get(batch.sales_account_id);
    if (!current || new Date(batch.created_at).getTime() > new Date(current.created_at).getTime()) {
      latestBatchByAccount.set(batch.sales_account_id, batch);
    }
  }

  const batchIds = Array.from(new Set(Array.from(latestBatchByAccount.values()).map((batch) => batch.id)));
  const { data: kitchenLines, error: kitchenLinesError } = batchIds.length
    ? await supabase
        .from("kitchen_ticket_lines")
        .select("kitchen_ticket_batch_id, sales_account_line_id")
        .eq("tenant_id", tenantId)
        .in("kitchen_ticket_batch_id", batchIds)
    : { data: [], error: null };
  if (kitchenLinesError) {
    throw new Error(
      `Unable to load kitchen lines for paid sales dispatch correlation: ${kitchenLinesError.message}`,
    );
  }
  const kitchenLineRows = (kitchenLines ?? []) as KitchenBatchLineSelectRow[];
  const kitchenLinesByBatch = new Map<string, KitchenBatchLineSelectRow[]>();
  for (const line of kitchenLineRows) {
    const group = kitchenLinesByBatch.get(line.kitchen_ticket_batch_id) ?? [];
    group.push(line);
    kitchenLinesByBatch.set(line.kitchen_ticket_batch_id, group);
  }

  const productIds = Array.from(new Set(accountLines.map((line) => line.product_id)));
  const [productsResult, activeBindingsResult, eventsResult] = await Promise.all([
    productIds.length
      ? supabase.from("products").select("id, name").eq("tenant_id", tenantId).in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length
      ? supabase
          .from("sales_pos_product_recipe_bindings")
          .select("product_id")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .eq("consumption_policy", "kitchen_dispatch")
          .in("product_id", productIds)
      : Promise.resolve({ data: [], error: null }),
    batchIds.length
      ? supabase
          .from("sales_pos_inventory_consumption_events")
          .select("id, kitchen_batch_id, idempotency_key, status, mode, created_at")
          .eq("tenant_id", tenantId)
          .eq("mode", "simulation")
          .in("kitchen_batch_id", batchIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (productsResult.error) {
    throw new Error(
      `Unable to load products for paid sales dispatch correlation: ${productsResult.error.message}`,
    );
  }
  if (activeBindingsResult.error) {
    throw new Error(
      `Unable to load active bindings for paid sales dispatch correlation: ${activeBindingsResult.error.message}`,
    );
  }
  if (eventsResult.error) {
    throw new Error(
      `Unable to load simulation events for paid sales dispatch correlation: ${eventsResult.error.message}`,
    );
  }

  const productNameById = new Map(
    (productsResult.data ?? []).map((row) => [
      String((row as { id: string }).id),
      String((row as { name: string }).name),
    ]),
  );
  const boundProductIds = new Set(
    ((activeBindingsResult.data ?? []) as BindingSelectActiveRow[]).map((row) => String(row.product_id)),
  );
  const eventByBatchId = new Map<
    string,
    { id: string; idempotency_key: string | null; status: string; mode: string; created_at: string }
  >();
  for (const event of eventsResult.data ?? []) {
    const typed = event as {
      id: string;
      kitchen_batch_id: string;
      idempotency_key: string | null;
      status: string;
      mode: string;
      created_at: string;
    };
    const current = eventByBatchId.get(String(typed.kitchen_batch_id));
    if (!current || new Date(typed.created_at).getTime() > new Date(current.created_at).getTime()) {
      eventByBatchId.set(String(typed.kitchen_batch_id), {
        id: typed.id,
        idempotency_key: typed.idempotency_key,
        status: typed.status,
        mode: typed.mode,
        created_at: typed.created_at,
      });
    }
  }

  const accountLineById = new Map(accountLines.map((line) => [line.id, line]));

  return salesAccountRows.map((account) => {
    const accountBaseLines = accountLinesByAccount.get(account.id) ?? [];
    const batch = latestBatchByAccount.get(account.id) ?? null;
    const batchLines = batch ? kitchenLinesByBatch.get(batch.id) ?? [] : [];
    const hasKitchenBatch = Boolean(batch);
    const hasKitchenLines = batchLines.length > 0;
    const linesForPreview = hasKitchenLines
      ? batchLines
          .map((line) => accountLineById.get(line.sales_account_line_id))
          .filter((line): line is SalesAccountLineSelectRow => Boolean(line))
      : accountBaseLines;

    const productNames = new Set<string>();
    const modifiersDetected = new Set<string>();
    let hasBoundProduct = false;
    for (const line of linesForPreview) {
      if (boundProductIds.has(line.product_id)) hasBoundProduct = true;
      const productName = productNameById.get(line.product_id);
      if (productName) productNames.add(productName);

      for (const modifier of line.selected_modifiers_snapshot ?? []) {
        const text = extractModifierPreviewText(asRecord(modifier));
        if (text) modifiersDetected.add(text);
      }
    }

    const existingEvent = batch ? eventByBatchId.get(batch.id) : undefined;
    return {
      sales_account_id: account.id,
      folio_text: account.folio_text ?? null,
      folio_number: account.folio_number ?? null,
      status: account.status,
      closed_at: account.closed_at ?? null,
      total_cents: Number(account.total_cents ?? 0),
      product_names: Array.from(productNames),
      modifiers_detected: Array.from(modifiersDetected),
      kitchen_batch_id: batch?.id ?? null,
      kitchen_batch_created_at: batch?.created_at ?? null,
      kitchen_batch_trigger_type: batch?.trigger_type ?? null,
      kitchen_batch_status: batch?.batch_status ?? null,
      kitchen_line_count: batchLines.length,
      has_kitchen_batch: hasKitchenBatch,
      has_kitchen_lines: hasKitchenLines,
      has_product_with_active_binding: hasBoundProduct,
      existing_event_id: existingEvent?.id ?? null,
      existing_event_status: existingEvent?.status ?? null,
      existing_event_mode: existingEvent?.mode ?? null,
      existing_event_idempotency_key: existingEvent?.idempotency_key ?? null,
    };
  });
}

export async function listPosInventorySimulationEvents(
  tenantId: string,
  limit = 20,
  client?: SupabaseClient,
): Promise<PosInventorySimulationEventRow[]> {
  const supabase = client ?? (await getSupabaseServerClient());
  const { data: events, error: eventsError } = await supabase
    .from("sales_pos_inventory_consumption_events")
    .select(
      "id, created_at, calculated_at, status, mode, trigger_type, source_type, source_id, kitchen_batch_id, sales_account_id, idempotency_key, error_message, metadata",
    )
    .eq("tenant_id", tenantId)
    .eq("mode", "simulation")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));
  if (eventsError) {
    throw new Error(`Unable to load POS simulation events: ${eventsError.message}`);
  }

  const eventRows = (events ?? []) as PosConsumptionEventSelectRow[];
  const eventIds = eventRows.map((row) => row.id);
  const lineByEvent = new Map<string, PosConsumptionLineSelectRow[]>();
  if (eventIds.length > 0) {
    const { data: lines, error: linesError } = await supabase
      .from("sales_pos_inventory_consumption_lines")
      .select(
        "id, created_at, event_id, product_id, order_item_id, recipe_id, recipe_version_id, inventory_item_id, quantity, unit_id, reason, modifier_rule_id, source_modifier_text, warning_message, movement_id",
      )
      .eq("tenant_id", tenantId)
      .in("event_id", eventIds);
    if (linesError) {
      throw new Error(`Unable to load POS simulation lines summary: ${linesError.message}`);
    }
    for (const line of (lines ?? []) as PosConsumptionLineSelectRow[]) {
      const group = lineByEvent.get(line.event_id) ?? [];
      group.push(line);
      lineByEvent.set(line.event_id, group);
    }
  }

  const allLines = Array.from(lineByEvent.values()).flat();
  const productIds = Array.from(new Set(allLines.map((line) => line.product_id).filter(Boolean) as string[]));
  const salesAccountIds = Array.from(
    new Set(eventRows.map((event) => event.sales_account_id).filter(Boolean) as string[]),
  );
  const { data: products, error: productsError } = productIds.length
    ? await supabase.from("products").select("id, name").eq("tenant_id", tenantId).in("id", productIds)
    : { data: [], error: null };
  const { data: salesAccounts, error: salesAccountsError } = salesAccountIds.length
    ? await supabase
        .from("sales_accounts")
        .select("id, folio_text")
        .eq("tenant_id", tenantId)
        .in("id", salesAccountIds)
    : { data: [], error: null };
  if (productsError) throw new Error(`Unable to load POS simulation products summary: ${productsError.message}`);
  if (salesAccountsError) {
    throw new Error(`Unable to load POS simulation sales account summary: ${salesAccountsError.message}`);
  }
  const productNameById = new Map((products ?? []).map((row) => [String((row as { id: string }).id), String((row as { name: string }).name)]));
  const folioBySalesAccountId = new Map(
    ((salesAccounts ?? []) as SalesAccountFolioSelectRow[]).map((row) => [row.id, row.folio_text ?? null]),
  );

  return eventRows.map((event) => {
    const metadata = asRecord(event.metadata);
    const lines = lineByEvent.get(event.id) ?? [];
    const warningFromLines = lines.filter(
      (line) =>
        String(line.reason ?? "") === "unmatched_modifier_warning" ||
        (line.warning_message != null && String(line.warning_message).trim().length > 0),
    ).length;
    const warningFromMetadata = asArray(metadata.warnings).length;
    const productNames = Array.from(
      new Set(
        lines
          .map((line) => (line.product_id ? productNameById.get(line.product_id) ?? null : null))
          .filter((name): name is string => Boolean(name && name.trim())),
      ),
    );

    return {
      event_id: event.id,
      created_at: event.created_at,
      calculated_at: event.calculated_at,
      status: event.status,
      mode: event.mode,
      trigger_type: event.trigger_type,
      source_type: event.source_type,
      source_id: event.source_id,
      kitchen_batch_id: event.kitchen_batch_id,
      sales_account_id: event.sales_account_id,
      sales_account_folio_text:
        event.sales_account_id != null ? folioBySalesAccountId.get(event.sales_account_id) ?? null : null,
      idempotency_key: event.idempotency_key,
      error_message: event.error_message,
      metadata,
      line_count: lines.length,
      warning_count: Math.max(warningFromLines, warningFromMetadata),
      distinct_inventory_item_count: new Set(
        lines.map((line) => line.inventory_item_id).filter((value): value is string => Boolean(value)),
      ).size,
      product_names: productNames,
      skipped_items: parseSkippedItems(metadata),
      unmatched_modifiers: parseUnmatchedModifiers(metadata),
    };
  });
}

export async function getPosInventorySimulationEventDetail(
  tenantId: string,
  eventId: string,
  client?: SupabaseClient,
): Promise<PosInventorySimulationEventDetail> {
  const supabase = client ?? (await getSupabaseServerClient());
  const [events, lines] = await Promise.all([
    listPosInventorySimulationEvents(tenantId, 100, supabase),
    supabase
      .from("sales_pos_inventory_consumption_lines")
      .select(
        "id, created_at, event_id, product_id, order_item_id, recipe_id, recipe_version_id, inventory_item_id, quantity, unit_id, reason, modifier_rule_id, source_modifier_text, warning_message, movement_id",
      )
      .eq("tenant_id", tenantId)
      .eq("event_id", eventId)
      .order("created_at", { ascending: true }),
  ]);

  if (lines.error) {
    throw new Error(`Unable to load POS simulation event detail lines: ${lines.error.message}`);
  }

  const lineRows = (lines.data ?? []) as PosConsumptionLineSelectRow[];
  const productIds = Array.from(new Set(lineRows.map((row) => row.product_id).filter(Boolean) as string[]));
  const recipeIds = Array.from(new Set(lineRows.map((row) => row.recipe_id).filter(Boolean) as string[]));
  const inventoryItemIds = Array.from(
    new Set(lineRows.map((row) => row.inventory_item_id).filter(Boolean) as string[]),
  );
  const unitIds = Array.from(new Set(lineRows.map((row) => row.unit_id).filter(Boolean) as string[]));
  const modifierRuleIds = Array.from(
    new Set(lineRows.map((row) => row.modifier_rule_id).filter(Boolean) as string[]),
  );

  const [products, recipes, inventoryItems, units, modifierRules] = await Promise.all([
    productIds.length
      ? supabase.from("products").select("id, name").eq("tenant_id", tenantId).in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    recipeIds.length
      ? supabase.from("kitchen_recipe_recipes").select("id, name").eq("tenant_id", tenantId).in("id", recipeIds)
      : Promise.resolve({ data: [], error: null }),
    inventoryItemIds.length
      ? supabase.from("kitchen_inventory_items").select("id, name").eq("tenant_id", tenantId).in("id", inventoryItemIds)
      : Promise.resolve({ data: [], error: null }),
    unitIds.length
      ? supabase.from("kitchen_inventory_units").select("id, code").eq("tenant_id", tenantId).in("id", unitIds)
      : Promise.resolve({ data: [], error: null }),
    modifierRuleIds.length
      ? supabase
          .from("sales_pos_inventory_modifier_rules")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .in("id", modifierRuleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (products.error) throw new Error(`Unable to load simulation detail products: ${products.error.message}`);
  if (recipes.error) throw new Error(`Unable to load simulation detail recipes: ${recipes.error.message}`);
  if (inventoryItems.error) {
    throw new Error(`Unable to load simulation detail inventory items: ${inventoryItems.error.message}`);
  }
  if (units.error) throw new Error(`Unable to load simulation detail units: ${units.error.message}`);
  if (modifierRules.error) {
    throw new Error(`Unable to load simulation detail modifier rules: ${modifierRules.error.message}`);
  }

  const productNameById = new Map((products.data ?? []).map((row) => [String((row as { id: string }).id), String((row as { name: string }).name)]));
  const recipeNameById = new Map((recipes.data ?? []).map((row) => [String((row as { id: string }).id), String((row as { name: string }).name)]));
  const inventoryItemNameById = new Map((inventoryItems.data ?? []).map((row) => [String((row as { id: string }).id), String((row as { name: string }).name)]));
  const unitCodeById = new Map((units.data ?? []).map((row) => [String((row as { id: string }).id), String((row as { code: string }).code)]));
  const modifierRuleNameById = new Map((modifierRules.data ?? []).map((row) => [String((row as { id: string }).id), String((row as { name: string }).name)]));

  return {
    event: events.find((entry) => entry.event_id === eventId) ?? null,
    lines: lineRows.map((row) => ({
      line_id: row.id,
      created_at: row.created_at,
      product_id: row.product_id,
      product_name: row.product_id ? productNameById.get(row.product_id) ?? null : null,
      order_item_id: row.order_item_id,
      recipe_id: row.recipe_id,
      recipe_name: row.recipe_id ? recipeNameById.get(row.recipe_id) ?? null : null,
      recipe_version_id: row.recipe_version_id,
      inventory_item_id: row.inventory_item_id,
      inventory_item_name: row.inventory_item_id ? inventoryItemNameById.get(row.inventory_item_id) ?? null : null,
      quantity: Number(row.quantity ?? 0),
      unit_id: row.unit_id,
      unit_code: row.unit_id ? unitCodeById.get(row.unit_id) ?? null : null,
      reason: String(row.reason ?? ""),
      modifier_rule_id: row.modifier_rule_id,
      modifier_rule_name: row.modifier_rule_id ? modifierRuleNameById.get(row.modifier_rule_id) ?? null : null,
      source_modifier_text: row.source_modifier_text,
      warning_message: row.warning_message,
      movement_id: row.movement_id,
    })),
  };
}

export async function getKitchenDispatchSimulationSource(
  tenantId: string,
  kitchenBatchId: string,
): Promise<KitchenDispatchSimulationSource | null> {
  const supabase = await getSupabaseServerClient();
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
