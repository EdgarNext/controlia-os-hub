import { normalizeMatcherValue } from "./normalizers";

export type ConsumptionPolicy = "kitchen_dispatch";

export type EngineSettings = {
  enabled: boolean;
  mode: "disabled" | "simulation" | "active";
  consumePreparedOn: "kitchen_dispatch";
};

export type EngineBinding = {
  id: string;
  tenantId: string;
  productId: string;
  recipeId: string;
  recipeVersionId: string;
  consumptionPolicy: ConsumptionPolicy | "disabled";
  isActive: boolean;
};

export type EngineRecipeLine = {
  tenantId: string;
  recipeVersionId: string;
  inventoryItemId: string;
  quantity: number;
  unitId: string;
};

export type EngineModifierRule = {
  id: string;
  tenantId: string;
  ingredientInventoryItemId: string;
  operation: "remove_base" | "add_delta" | "subtract_delta";
  deltaQuantity: number | null;
  deltaUnitId: string | null;
  appliesToProductId: string | null;
  isActive: boolean;
};

export type EngineModifierMatcher = {
  id: string;
  tenantId: string;
  ruleId: string;
  matcherType: "modifier_option_id" | "modifier_option_name" | "normalized_text";
  matcherValue: string;
  normalizedValue: string;
  priority: number;
  isActive: boolean;
};

export type EngineDispatchItem = {
  kitchenTicketLineId: string;
  salesAccountLineId: string;
  ticketAction: "add" | "adjust" | "void";
  quantityDelta: number;
  productId: string;
  selectedModifiersSnapshot: Record<string, unknown>[];
  sourceLabel: string;
};

export type NormalizedModifierInput = {
  key: string;
  optionId: string | null;
  optionName: string | null;
  normalizedText: string | null;
  rawText: string;
  quantity: number;
};

export type MatchedModifierRule = {
  modifier: NormalizedModifierInput;
  rule: EngineModifierRule;
  matcher: EngineModifierMatcher;
};

export type ConsumptionWarning = {
  code: "unmatched_modifier_warning" | "skipped_product_without_binding" | "non_positive_dispatch_quantity";
  message: string;
  salesAccountLineId: string;
  kitchenTicketLineId: string;
  productId: string;
  sourceModifierText?: string;
};

export type CalculatedConsumptionLine = {
  tenantId: string;
  productId: string;
  orderItemId: string;
  recipeId: string;
  recipeVersionId: string;
  inventoryItemId: string;
  quantity: number;
  unitId: string;
  reason: "recipe_base" | "modifier_add_delta" | "modifier_subtract_delta";
  modifierRuleId: string | null;
  modifierMatcherId: string | null;
  sourceModifierText: string | null;
  warningMessage: string | null;
};

export type SkippedDispatchItem = {
  salesAccountLineId: string;
  kitchenTicketLineId: string;
  productId: string;
  reason: "no_active_binding" | "invalid_quantity";
};

export type EngineCalculationResult = {
  idempotencyKey: string;
  triggerType: "kitchen_dispatch";
  sourceType: "sales_pos_kitchen_dispatch";
  sourceId: string;
  salesAccountId: string;
  kitchenBatchId: string;
  mode: "simulation";
  status: "calculated";
  lines: CalculatedConsumptionLine[];
  warnings: ConsumptionWarning[];
  skippedItems: SkippedDispatchItem[];
  unmatchedModifiers: Array<{ salesAccountLineId: string; kitchenTicketLineId: string; sourceModifierText: string }>;
  metadata: Record<string, unknown>;
};

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeModifierRecord(
  snapshot: Record<string, unknown>,
  index: number,
): NormalizedModifierInput {
  const optionId = toStringOrNull(snapshot.modifier_option_id ?? snapshot.modifierOptionId);
  const optionName = toStringOrNull(snapshot.modifier_option_name ?? snapshot.modifierOptionName);
  const rawText =
    optionName ??
    toStringOrNull(snapshot.name) ??
    toStringOrNull(snapshot.value) ??
    toStringOrNull(snapshot.text) ??
    `modifier_${index + 1}`;

  const normalizedText = normalizeMatcherValue(rawText);
  const quantity = Math.max(1, Math.trunc(toNumber(snapshot.quantity, 1)));

  return {
    key: `${optionId ?? "none"}:${normalizedText}:${index}`,
    optionId,
    optionName,
    normalizedText,
    rawText,
    quantity,
  };
}

export function normalizePosModifierInput(
  selectedModifiersSnapshot: Record<string, unknown>[],
): NormalizedModifierInput[] {
  return selectedModifiersSnapshot.map((entry, index) => normalizeModifierRecord(entry, index));
}

export function buildConsumptionEventIdempotencyKey(input: {
  tenantId: string;
  salesAccountId: string;
  kitchenBatchId: string;
}): string {
  return `pos:kitchen_dispatch:${input.tenantId}:${input.salesAccountId}:${input.kitchenBatchId}`;
}

export function matchInventoryModifierRules(input: {
  modifiers: NormalizedModifierInput[];
  matchers: EngineModifierMatcher[];
  rules: EngineModifierRule[];
  productId: string;
  salesAccountLineId: string;
  kitchenTicketLineId: string;
}): {
  matches: MatchedModifierRule[];
  warnings: ConsumptionWarning[];
  unmatchedModifiers: Array<{ salesAccountLineId: string; kitchenTicketLineId: string; sourceModifierText: string }>;
} {
  const activeRulesById = new Map(
    input.rules
      .filter((rule) => rule.isActive && (!rule.appliesToProductId || rule.appliesToProductId === input.productId))
      .map((rule) => [rule.id, rule]),
  );

  const activeMatchers = input.matchers
    .filter((matcher) => matcher.isActive && activeRulesById.has(matcher.ruleId))
    .slice()
    .sort((a, b) => a.priority - b.priority);

  const matches: MatchedModifierRule[] = [];
  const warnings: ConsumptionWarning[] = [];
  const unmatchedModifiers: Array<{ salesAccountLineId: string; kitchenTicketLineId: string; sourceModifierText: string }> = [];

  for (const modifier of input.modifiers) {
    const byOptionId =
      modifier.optionId == null
        ? null
        : activeMatchers.find(
            (matcher) => matcher.matcherType === "modifier_option_id" && matcher.matcherValue === modifier.optionId,
          );

    const byOptionName =
      byOptionId ??
      (modifier.optionName == null
        ? null
        : activeMatchers.find(
            (matcher) =>
              matcher.matcherType === "modifier_option_name" &&
              normalizeMatcherValue(matcher.matcherValue) === normalizeMatcherValue(modifier.optionName ?? ""),
          ));

    const byNormalizedText =
      byOptionName ??
      (modifier.normalizedText == null
        ? null
        : activeMatchers.find(
            (matcher) =>
              matcher.matcherType === "normalized_text" &&
              normalizeMatcherValue(matcher.normalizedValue || matcher.matcherValue) === modifier.normalizedText,
          ));

    const selectedMatcher = byNormalizedText;
    if (!selectedMatcher) {
      warnings.push({
        code: "unmatched_modifier_warning",
        message: `No matcher found for modifier: ${modifier.rawText}`,
        salesAccountLineId: input.salesAccountLineId,
        kitchenTicketLineId: input.kitchenTicketLineId,
        productId: input.productId,
        sourceModifierText: modifier.rawText,
      });
      unmatchedModifiers.push({
        salesAccountLineId: input.salesAccountLineId,
        kitchenTicketLineId: input.kitchenTicketLineId,
        sourceModifierText: modifier.rawText,
      });
      continue;
    }

    const rule = activeRulesById.get(selectedMatcher.ruleId);
    if (!rule) continue;

    matches.push({
      modifier,
      rule,
      matcher: selectedMatcher,
    });
  }

  return { matches, warnings, unmatchedModifiers };
}

export function calculatePosInventoryConsumptionForKitchenDispatch(input: {
  tenantId: string;
  salesAccountId: string;
  kitchenBatchId: string;
  settings: EngineSettings;
  dispatchItems: EngineDispatchItem[];
  bindings: EngineBinding[];
  recipeLines: EngineRecipeLine[];
  modifierRules: EngineModifierRule[];
  modifierMatchers: EngineModifierMatcher[];
}): EngineCalculationResult {
  if (!input.settings.enabled || input.settings.mode !== "simulation") {
    throw new Error("POS inventory simulation is disabled for this tenant.");
  }
  if (input.settings.consumePreparedOn !== "kitchen_dispatch") {
    throw new Error("consume_prepared_on must be kitchen_dispatch for this simulation.");
  }

  const idempotencyKey = buildConsumptionEventIdempotencyKey({
    tenantId: input.tenantId,
    salesAccountId: input.salesAccountId,
    kitchenBatchId: input.kitchenBatchId,
  });

  const activeBindingsByProductId = new Map(
    input.bindings
      .filter(
        (binding) =>
          binding.tenantId === input.tenantId &&
          binding.isActive &&
          binding.consumptionPolicy === "kitchen_dispatch",
      )
      .map((binding) => [binding.productId, binding]),
  );

  const recipeLinesByVersionId = new Map<string, EngineRecipeLine[]>();
  for (const recipeLine of input.recipeLines) {
    if (recipeLine.tenantId !== input.tenantId) continue;
    const current = recipeLinesByVersionId.get(recipeLine.recipeVersionId) ?? [];
    current.push(recipeLine);
    recipeLinesByVersionId.set(recipeLine.recipeVersionId, current);
  }

  const calculatedLines: CalculatedConsumptionLine[] = [];
  const warnings: ConsumptionWarning[] = [];
  const skippedItems: SkippedDispatchItem[] = [];
  const unmatchedModifiers: Array<{ salesAccountLineId: string; kitchenTicketLineId: string; sourceModifierText: string }> = [];

  for (const dispatchItem of input.dispatchItems) {
    const quantityToConsume =
      dispatchItem.ticketAction === "void" ? 0 : Math.max(0, dispatchItem.quantityDelta);

    if (quantityToConsume <= 0) {
      skippedItems.push({
        salesAccountLineId: dispatchItem.salesAccountLineId,
        kitchenTicketLineId: dispatchItem.kitchenTicketLineId,
        productId: dispatchItem.productId,
        reason: "invalid_quantity",
      });
      warnings.push({
        code: "non_positive_dispatch_quantity",
        message: `Skipped dispatch item with non-positive quantity: ${dispatchItem.sourceLabel}`,
        salesAccountLineId: dispatchItem.salesAccountLineId,
        kitchenTicketLineId: dispatchItem.kitchenTicketLineId,
        productId: dispatchItem.productId,
      });
      continue;
    }

    const binding = activeBindingsByProductId.get(dispatchItem.productId);
    if (!binding) {
      skippedItems.push({
        salesAccountLineId: dispatchItem.salesAccountLineId,
        kitchenTicketLineId: dispatchItem.kitchenTicketLineId,
        productId: dispatchItem.productId,
        reason: "no_active_binding",
      });
      warnings.push({
        code: "skipped_product_without_binding",
        message: `Skipped product without active kitchen_dispatch binding: ${dispatchItem.sourceLabel}`,
        salesAccountLineId: dispatchItem.salesAccountLineId,
        kitchenTicketLineId: dispatchItem.kitchenTicketLineId,
        productId: dispatchItem.productId,
      });
      continue;
    }

    const baseLines = recipeLinesByVersionId.get(binding.recipeVersionId) ?? [];
    const perItemState = new Map<
      string,
      { inventoryItemId: string; unitId: string; baseQuantity: number; finalQuantity: number }
    >();

    for (const baseLine of baseLines) {
      const key = `${baseLine.inventoryItemId}:${baseLine.unitId}`;
      const quantity = baseLine.quantity * quantityToConsume;
      const current = perItemState.get(key);
      if (current) {
        current.baseQuantity += quantity;
        current.finalQuantity += quantity;
      } else {
        perItemState.set(key, {
          inventoryItemId: baseLine.inventoryItemId,
          unitId: baseLine.unitId,
          baseQuantity: quantity,
          finalQuantity: quantity,
        });
      }
    }

    const normalizedModifiers = normalizePosModifierInput(dispatchItem.selectedModifiersSnapshot);
    const matching = matchInventoryModifierRules({
      modifiers: normalizedModifiers,
      matchers: input.modifierMatchers,
      rules: input.modifierRules,
      productId: dispatchItem.productId,
      salesAccountLineId: dispatchItem.salesAccountLineId,
      kitchenTicketLineId: dispatchItem.kitchenTicketLineId,
    });
    warnings.push(...matching.warnings);
    unmatchedModifiers.push(...matching.unmatchedModifiers);

    for (const matched of matching.matches) {
      const targetKeys = Array.from(perItemState.entries())
        .filter(([, line]) => line.inventoryItemId === matched.rule.ingredientInventoryItemId)
        .map(([key]) => key);

      const modifierUnits = Math.max(1, matched.modifier.quantity);
      if (matched.rule.operation === "remove_base") {
        for (const targetKey of targetKeys) {
          const line = perItemState.get(targetKey);
          if (!line) continue;
          line.finalQuantity = 0;
        }
        continue;
      }

      const deltaQuantityBase = matched.rule.deltaQuantity ?? 0;
      const deltaQuantity = deltaQuantityBase * quantityToConsume * modifierUnits;
      if (deltaQuantity <= 0) continue;

      const deltaUnitId = matched.rule.deltaUnitId;
      if (!deltaUnitId) continue;

      const deltaKey = `${matched.rule.ingredientInventoryItemId}:${deltaUnitId}`;
      const existing = perItemState.get(deltaKey);
      if (!existing) {
        perItemState.set(deltaKey, {
          inventoryItemId: matched.rule.ingredientInventoryItemId,
          unitId: deltaUnitId,
          baseQuantity: 0,
          finalQuantity: matched.rule.operation === "add_delta" ? deltaQuantity : 0,
        });
      } else if (matched.rule.operation === "add_delta") {
        existing.finalQuantity += deltaQuantity;
      } else {
        existing.finalQuantity = Math.max(0, existing.finalQuantity - deltaQuantity);
      }

      calculatedLines.push({
        tenantId: input.tenantId,
        productId: dispatchItem.productId,
        orderItemId: dispatchItem.salesAccountLineId,
        recipeId: binding.recipeId,
        recipeVersionId: binding.recipeVersionId,
        inventoryItemId: matched.rule.ingredientInventoryItemId,
        quantity: deltaQuantity,
        unitId: deltaUnitId,
        reason: matched.rule.operation === "add_delta" ? "modifier_add_delta" : "modifier_subtract_delta",
        modifierRuleId: matched.rule.id,
        modifierMatcherId: matched.matcher.id,
        sourceModifierText: matched.modifier.rawText,
        warningMessage: null,
      });
    }

    for (const line of perItemState.values()) {
      if (line.finalQuantity <= 0) continue;
      calculatedLines.push({
        tenantId: input.tenantId,
        productId: dispatchItem.productId,
        orderItemId: dispatchItem.salesAccountLineId,
        recipeId: binding.recipeId,
        recipeVersionId: binding.recipeVersionId,
        inventoryItemId: line.inventoryItemId,
        quantity: line.finalQuantity,
        unitId: line.unitId,
        reason: "recipe_base",
        modifierRuleId: null,
        modifierMatcherId: null,
        sourceModifierText: null,
        warningMessage: null,
      });
    }
  }

  return {
    idempotencyKey,
    triggerType: "kitchen_dispatch",
    sourceType: "sales_pos_kitchen_dispatch",
    sourceId: input.kitchenBatchId,
    salesAccountId: input.salesAccountId,
    kitchenBatchId: input.kitchenBatchId,
    mode: "simulation",
    status: "calculated",
    lines: calculatedLines,
    warnings,
    skippedItems,
    unmatchedModifiers,
    metadata: {
      warnings_count: warnings.length,
      skipped_items_count: skippedItems.length,
      unmatched_modifiers_count: unmatchedModifiers.length,
      calculated_lines_count: calculatedLines.length,
    },
  };
}
