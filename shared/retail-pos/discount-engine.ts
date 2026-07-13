export type RetailPosQuantityString = string;

const RETAIL_POS_CANONICAL_QUANTITY_PATTERN = /^(0|[1-9]\d*)\.\d{3}$/;

function isRetailPosCanonicalQuantity(
  value: string,
): value is RetailPosQuantityString {
  return RETAIL_POS_CANONICAL_QUANTITY_PATTERN.test(value) && value !== "0.000";
}

export const RETAIL_POS_DISCOUNT_REASON_CODES = [
  "volume",
  "frequent_customer",
  "authorized_wholesale",
  "price_adjustment",
  "damaged_product",
  "manual_promotion",
  "rounding",
  "capture_error",
  "cashier_authorization",
  "other",
] as const;

export type RetailPosDiscountScope = "line" | "order";
export type RetailPosDiscountCaptureType = "percentage" | "fixed_amount";
export type RetailPosDiscountReasonCode =
  (typeof RETAIL_POS_DISCOUNT_REASON_CODES)[number];
export type RetailPosDiscountAuthorizationStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";
export type RetailPosDiscountAuthorizationMethod =
  | "role_capability"
  | "supervisor_pin"
  | "remote_approval"
  | "system_policy";
export type RetailPosDiscountErrorCode =
  | "INVALID_PERCENTAGE"
  | "NEGATIVE_AMOUNT"
  | "LINE_NOT_FOUND"
  | "DUPLICATE_LINE_DISCOUNT"
  | "MULTIPLE_ORDER_DISCOUNTS"
  | "LINE_DISCOUNT_EXCEEDS_GROSS"
  | "ORDER_DISCOUNT_EXCEEDS_REMAINING_TOTAL"
  | "ORDER_SCOPE_WITH_LINE_ID"
  | "LINE_SCOPE_WITHOUT_LINE_ID"
  | "UNSAFE_INTEGER"
  | "INVALID_QUANTITY"
  | "INVALID_MONEY_VALUE";
export type RetailPosDiscountWarningCode =
  | "ZERO_DISCOUNT"
  | "OTHER_REASON_WITHOUT_COMMENT"
  | "COST_UNKNOWN"
  | "BELOW_COST";
export type RetailPosLineCostPosition =
  | "above_or_equal_cost"
  | "below_cost"
  | "unknown";

export interface RetailPosDiscountAuthorizationMeta {
  status?: RetailPosDiscountAuthorizationStatus;
  method?: RetailPosDiscountAuthorizationMethod | null;
  policyKey?: string | null;
  note?: string | null;
}

export interface RetailPosDiscountIntent {
  id?: string | null;
  scope: RetailPosDiscountScope;
  lineId?: string | null;
  captureType: RetailPosDiscountCaptureType;
  percentageBps?: number | null;
  amountCents?: number | null;
  reasonCode: RetailPosDiscountReasonCode;
  comment?: string | null;
  authorization?: RetailPosDiscountAuthorizationMeta | null;
  origin: "manual";
}

export interface RetailPosDiscountLineInput {
  id: string;
  stablePosition: number;
  quantity: RetailPosQuantityString;
  unitPriceCents?: number | null;
  grossLineCents?: number | null;
  unitCostCents?: number | null;
}

export interface RetailPosDiscountIssue {
  code: RetailPosDiscountErrorCode | RetailPosDiscountWarningCode;
  severity: "error" | "warning";
  scope: RetailPosDiscountScope | "line_result" | "order_result" | "input";
  intentId: string | null;
  lineId: string | null;
  detail: string;
}

export interface RetailPosValidatedDiscountIntent {
  ok: boolean;
  intent: RetailPosDiscountIntent;
  errors: RetailPosDiscountIssue[];
  warnings: RetailPosDiscountIssue[];
}

export interface RetailPosPercentageDiscountResult {
  ok: boolean;
  baseCents: number;
  percentageBps: number;
  discountCents: number;
  errors: RetailPosDiscountIssue[];
}

export interface RetailPosLineDiscountResult {
  ok: boolean;
  lineId: string;
  grossCents: number;
  discountCents: number;
  appliedIntent: RetailPosDiscountIntent | null;
  errors: RetailPosDiscountIssue[];
  warnings: RetailPosDiscountIssue[];
}

export interface RetailPosOrderDiscountResult {
  ok: boolean;
  baseCents: number;
  discountCents: number;
  appliedIntent: RetailPosDiscountIntent | null;
  errors: RetailPosDiscountIssue[];
  warnings: RetailPosDiscountIssue[];
}

export interface RetailPosAllocatedOrderDiscountLine {
  lineId: string;
  stablePosition: number;
  baseCents: number;
  allocatedDiscountCents: number;
}

export interface RetailPosOrderDiscountAllocationResult {
  ok: boolean;
  orderDiscountCents: number;
  lines: RetailPosAllocatedOrderDiscountLine[];
  errors: RetailPosDiscountIssue[];
}

export interface RetailPosLineCostPositionResult {
  position: RetailPosLineCostPosition;
  totalCostCents: number | null;
  warnings: RetailPosDiscountIssue[];
}

export interface RetailPosCalculatedLine {
  id: string;
  stablePosition: number;
  quantity: RetailPosQuantityString;
  quantityMillis: number;
  unitPriceCents: number | null;
  grossLineCents: number;
  directDiscountCents: number;
  orderDiscountAllocationCents: number;
  totalDiscountCents: number;
  netLineCents: number;
  unitCostCents: number | null;
  totalCostCents: number | null;
  costPosition: RetailPosLineCostPosition;
  directDiscountIntent: RetailPosDiscountIntent | null;
  orderDiscountIntent: RetailPosDiscountIntent | null;
  warnings: RetailPosDiscountIssue[];
}

export interface RetailPosDiscountedOrderResult {
  ok: boolean;
  subtotalGrossCents: number;
  directDiscountTotalCents: number;
  orderDiscountTotalCents: number;
  discountTotalCents: number;
  totalCents: number;
  lines: RetailPosCalculatedLine[];
  linesBelowCost: RetailPosCalculatedLine[];
  warnings: RetailPosDiscountIssue[];
  errors: RetailPosDiscountIssue[];
}

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const BIGINT_ZERO = BigInt(0);
const BIGINT_TWO = BigInt(2);
const BIGINT_THOUSAND = BigInt(1000);
const BIGINT_TEN_THOUSAND = BigInt(10_000);

function buildIssue(
  issue: Omit<RetailPosDiscountIssue, "severity"> & { severity?: "error" | "warning" },
): RetailPosDiscountIssue {
  return {
    severity: issue.severity ?? "error",
    ...issue,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function toSafeNumber(value: bigint, context: Omit<RetailPosDiscountIssue, "code" | "severity" | "detail"> & { detail: string }): {
  ok: true;
  value: number;
} | {
  ok: false;
  error: RetailPosDiscountIssue;
} {
  if (value < BIGINT_ZERO || value > MAX_SAFE_INTEGER_BIGINT) {
    return {
      ok: false,
      error: buildIssue({
        code: "UNSAFE_INTEGER",
        scope: context.scope,
        intentId: context.intentId,
        lineId: context.lineId,
        detail: context.detail,
      }),
    };
  }

  return { ok: true, value: Number(value) };
}

function roundHalfUpDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / BIGINT_TWO) / denominator;
}

function parseCanonicalQuantityToMillis(
  quantity: RetailPosQuantityString,
): { ok: true; quantityMillis: number } | { ok: false; error: RetailPosDiscountIssue } {
  if (!isRetailPosCanonicalQuantity(quantity)) {
    return {
      ok: false,
      error: buildIssue({
        code: "INVALID_QUANTITY",
        scope: "input",
        intentId: null,
        lineId: null,
        detail: "Retail POS quantity must be canonical and non-zero.",
      }),
    };
  }

  const [integerPart, decimalPart] = quantity.split(".");
  const quantityMillis = Number.parseInt(integerPart, 10) * 1000 + Number.parseInt(decimalPart, 10);

  if (!Number.isSafeInteger(quantityMillis) || quantityMillis <= 0) {
    return {
      ok: false,
      error: buildIssue({
        code: "INVALID_QUANTITY",
        scope: "input",
        intentId: null,
        lineId: null,
        detail: "Retail POS quantity millis must be a safe positive integer.",
      }),
    };
  }

  return { ok: true, quantityMillis };
}

function computeGrossFromUnitPrice(
  unitPriceCents: number,
  quantityMillis: number,
  lineId: string,
): { ok: true; grossCents: number } | { ok: false; error: RetailPosDiscountIssue } {
  if (!isNonNegativeInteger(unitPriceCents)) {
    return {
      ok: false,
      error: buildIssue({
        code: "INVALID_MONEY_VALUE",
        scope: "input",
        intentId: null,
        lineId,
        detail: "unitPriceCents must be a non-negative integer.",
      }),
    };
  }

  const raw = BigInt(unitPriceCents) * BigInt(quantityMillis);
  const rounded = roundHalfUpDiv(raw, BIGINT_THOUSAND);
  const safe = toSafeNumber(rounded, {
    scope: "input",
    intentId: null,
    lineId,
    detail: "Computed gross line cents exceeded safe integer range.",
  });

  if (!safe.ok) {
    return {
      ok: false,
      error: safe.error,
    };
  }

  return {
    ok: true,
    grossCents: safe.value,
  };
}

function computeTotalCost(
  unitCostCents: number | null | undefined,
  quantityMillis: number,
  lineId: string,
): { ok: true; totalCostCents: number | null } | { ok: false; error: RetailPosDiscountIssue } {
  if (unitCostCents == null) {
    return { ok: true, totalCostCents: null };
  }

  if (!isNonNegativeInteger(unitCostCents)) {
    return {
      ok: false,
      error: buildIssue({
        code: "INVALID_MONEY_VALUE",
        scope: "input",
        intentId: null,
        lineId,
        detail: "unitCostCents must be a non-negative integer when provided.",
      }),
    };
  }

  const raw = BigInt(unitCostCents) * BigInt(quantityMillis);
  const rounded = roundHalfUpDiv(raw, BIGINT_THOUSAND);
  const safe = toSafeNumber(rounded, {
    scope: "line_result",
    intentId: null,
    lineId,
    detail: "Computed total cost cents exceeded safe integer range.",
  });

  if (!safe.ok) {
    return { ok: false, error: safe.error };
  }

  return { ok: true, totalCostCents: safe.value };
}

export function validateRetailPosDiscountIntent(
  intent: RetailPosDiscountIntent,
): RetailPosValidatedDiscountIntent {
  const errors: RetailPosDiscountIssue[] = [];
  const warnings: RetailPosDiscountIssue[] = [];

  if (intent.scope === "line" && !normalizeOptionalText(intent.lineId)) {
    errors.push(
      buildIssue({
        code: "LINE_SCOPE_WITHOUT_LINE_ID",
        scope: "line",
        intentId: intent.id ?? null,
        lineId: null,
        detail: "Line discount intent requires lineId.",
      }),
    );
  }

  if (intent.scope === "order" && normalizeOptionalText(intent.lineId)) {
    errors.push(
      buildIssue({
        code: "ORDER_SCOPE_WITH_LINE_ID",
        scope: "order",
        intentId: intent.id ?? null,
        lineId: normalizeOptionalText(intent.lineId),
        detail: "Order discount intent cannot include lineId.",
      }),
    );
  }

  const hasPercentage = intent.percentageBps != null;
  const hasAmount = intent.amountCents != null;

  if (intent.captureType === "percentage") {
    if (!hasPercentage || hasAmount || !Number.isInteger(intent.percentageBps)) {
      errors.push(
        buildIssue({
          code: "INVALID_PERCENTAGE",
          scope: intent.scope,
          intentId: intent.id ?? null,
          lineId: normalizeOptionalText(intent.lineId),
          detail: "Percentage discount intent must provide exactly one integer percentageBps value.",
        }),
      );
    } else if (intent.percentageBps! < 0 || intent.percentageBps! > 10_000) {
      errors.push(
        buildIssue({
          code: "INVALID_PERCENTAGE",
          scope: intent.scope,
          intentId: intent.id ?? null,
          lineId: normalizeOptionalText(intent.lineId),
          detail: "Percentage discount intent must stay between 0 and 10000 bps.",
        }),
      );
    }
  }

  if (intent.captureType === "fixed_amount") {
    if (!hasAmount || hasPercentage || !Number.isInteger(intent.amountCents)) {
      errors.push(
        buildIssue({
          code: "INVALID_MONEY_VALUE",
          scope: intent.scope,
          intentId: intent.id ?? null,
          lineId: normalizeOptionalText(intent.lineId),
          detail: "Fixed amount discount intent must provide exactly one integer amountCents value.",
        }),
      );
    } else if (intent.amountCents! < 0) {
      errors.push(
        buildIssue({
          code: "NEGATIVE_AMOUNT",
          scope: intent.scope,
          intentId: intent.id ?? null,
          lineId: normalizeOptionalText(intent.lineId),
          detail: "Discount amount cannot be negative.",
        }),
      );
    }
  }

  const zeroPercentage = intent.captureType === "percentage" && intent.percentageBps === 0;
  const zeroAmount = intent.captureType === "fixed_amount" && intent.amountCents === 0;

  if (zeroPercentage || zeroAmount) {
    warnings.push(
      buildIssue({
        code: "ZERO_DISCOUNT",
        severity: "warning",
        scope: intent.scope,
        intentId: intent.id ?? null,
        lineId: normalizeOptionalText(intent.lineId),
        detail: "Discount intent is valid but has zero monetary effect.",
      }),
    );
  }

  if (intent.reasonCode === "other" && !normalizeOptionalText(intent.comment)) {
    warnings.push(
      buildIssue({
        code: "OTHER_REASON_WITHOUT_COMMENT",
        severity: "warning",
        scope: intent.scope,
        intentId: intent.id ?? null,
        lineId: normalizeOptionalText(intent.lineId),
        detail: "Reason 'other' should usually include a comment.",
      }),
    );
  }

  return {
    ok: errors.length === 0,
    intent,
    errors,
    warnings,
  };
}

export function calculateRetailPosPercentageDiscount(input: {
  baseCents: number;
  percentageBps: number;
  scope?: RetailPosDiscountScope | "input";
  lineId?: string | null;
  intentId?: string | null;
}): RetailPosPercentageDiscountResult {
  const scope = input.scope ?? "input";

  if (!isNonNegativeInteger(input.baseCents)) {
    return {
      ok: false,
      baseCents: 0,
      percentageBps: input.percentageBps,
      discountCents: 0,
      errors: [
        buildIssue({
          code: "INVALID_MONEY_VALUE",
          scope,
          intentId: input.intentId ?? null,
          lineId: input.lineId ?? null,
          detail: "baseCents must be a non-negative integer.",
        }),
      ],
    };
  }

  if (!Number.isInteger(input.percentageBps) || input.percentageBps < 0 || input.percentageBps > 10_000) {
    return {
      ok: false,
      baseCents: input.baseCents,
      percentageBps: input.percentageBps,
      discountCents: 0,
      errors: [
        buildIssue({
          code: "INVALID_PERCENTAGE",
          scope,
          intentId: input.intentId ?? null,
          lineId: input.lineId ?? null,
          detail: "percentageBps must be an integer between 0 and 10000.",
        }),
      ],
    };
  }

  const raw = BigInt(input.baseCents) * BigInt(input.percentageBps);
  const rounded = roundHalfUpDiv(raw, BIGINT_TEN_THOUSAND);
  const safe = toSafeNumber(rounded, {
    scope,
    intentId: input.intentId ?? null,
    lineId: input.lineId ?? null,
    detail: "Rounded percentage discount exceeded safe integer range.",
  });

  if (!safe.ok) {
    return {
      ok: false,
      baseCents: input.baseCents,
      percentageBps: input.percentageBps,
      discountCents: 0,
      errors: [safe.error],
    };
  }

  return {
    ok: true,
    baseCents: input.baseCents,
    percentageBps: input.percentageBps,
    discountCents: safe.value,
    errors: [],
  };
}

export function calculateRetailPosLineDiscount(input: {
  line: RetailPosDiscountLineInput;
  intent: RetailPosDiscountIntent | null;
}): RetailPosLineDiscountResult {
  const warnings: RetailPosDiscountIssue[] = [];

  const gross = resolveLineGross(input.line);
  if (!gross.ok) {
    return {
      ok: false,
      lineId: input.line.id,
      grossCents: 0,
      discountCents: 0,
      appliedIntent: null,
      errors: [gross.error],
      warnings,
    };
  }

  if (!input.intent) {
    return {
      ok: true,
      lineId: input.line.id,
      grossCents: gross.grossCents,
      discountCents: 0,
      appliedIntent: null,
      errors: [],
      warnings,
    };
  }

  const validated = validateRetailPosDiscountIntent(input.intent);
  warnings.push(...validated.warnings);

  if (!validated.ok) {
    return {
      ok: false,
      lineId: input.line.id,
      grossCents: gross.grossCents,
      discountCents: 0,
      appliedIntent: input.intent,
      errors: validated.errors,
      warnings,
    };
  }

  let discountCents = 0;

  if (input.intent.captureType === "percentage") {
    const percentage = calculateRetailPosPercentageDiscount({
      baseCents: gross.grossCents,
      percentageBps: input.intent.percentageBps ?? -1,
      scope: "line",
      lineId: input.line.id,
      intentId: input.intent.id ?? null,
    });

    if (!percentage.ok) {
      return {
        ok: false,
        lineId: input.line.id,
        grossCents: gross.grossCents,
        discountCents: 0,
        appliedIntent: input.intent,
        errors: percentage.errors,
        warnings,
      };
    }

    discountCents = percentage.discountCents;
  } else {
    discountCents = input.intent.amountCents ?? 0;
  }

  if (discountCents > gross.grossCents) {
    return {
      ok: false,
      lineId: input.line.id,
      grossCents: gross.grossCents,
      discountCents: 0,
      appliedIntent: input.intent,
      errors: [
        buildIssue({
          code: "LINE_DISCOUNT_EXCEEDS_GROSS",
          scope: "line",
          intentId: input.intent.id ?? null,
          lineId: input.line.id,
          detail: "Direct line discount cannot exceed gross line cents.",
        }),
      ],
      warnings,
    };
  }

  return {
    ok: true,
    lineId: input.line.id,
    grossCents: gross.grossCents,
    discountCents,
    appliedIntent: input.intent,
    errors: [],
    warnings,
  };
}

export function calculateRetailPosOrderDiscount(input: {
  baseCents: number;
  intent: RetailPosDiscountIntent | null;
}): RetailPosOrderDiscountResult {
  const warnings: RetailPosDiscountIssue[] = [];

  if (!input.intent) {
    return {
      ok: true,
      baseCents: input.baseCents,
      discountCents: 0,
      appliedIntent: null,
      errors: [],
      warnings,
    };
  }

  const validated = validateRetailPosDiscountIntent(input.intent);
  warnings.push(...validated.warnings);

  if (!validated.ok) {
    return {
      ok: false,
      baseCents: input.baseCents,
      discountCents: 0,
      appliedIntent: input.intent,
      errors: validated.errors,
      warnings,
    };
  }

  let discountCents = 0;

  if (input.intent.captureType === "percentage") {
    const percentage = calculateRetailPosPercentageDiscount({
      baseCents: input.baseCents,
      percentageBps: input.intent.percentageBps ?? -1,
      scope: "order",
      lineId: null,
      intentId: input.intent.id ?? null,
    });

    if (!percentage.ok) {
      return {
        ok: false,
        baseCents: input.baseCents,
        discountCents: 0,
        appliedIntent: input.intent,
        errors: percentage.errors,
        warnings,
      };
    }

    discountCents = percentage.discountCents;
  } else {
    discountCents = input.intent.amountCents ?? 0;
  }

  if (discountCents > input.baseCents) {
    return {
      ok: false,
      baseCents: input.baseCents,
      discountCents: 0,
      appliedIntent: input.intent,
      errors: [
        buildIssue({
          code: "ORDER_DISCOUNT_EXCEEDS_REMAINING_TOTAL",
          scope: "order",
          intentId: input.intent.id ?? null,
          lineId: null,
          detail: "Order discount cannot exceed remaining total after direct discounts.",
        }),
      ],
      warnings,
    };
  }

  return {
    ok: true,
    baseCents: input.baseCents,
    discountCents,
    appliedIntent: input.intent,
    errors: [],
    warnings,
  };
}

export function allocateRetailPosOrderDiscountAcrossLines(input: {
  orderDiscountCents: number;
  lines: Array<{
    lineId: string;
    stablePosition: number;
    baseCents: number;
  }>;
}): RetailPosOrderDiscountAllocationResult {
  if (!isNonNegativeInteger(input.orderDiscountCents)) {
    return {
      ok: false,
      orderDiscountCents: 0,
      lines: [],
      errors: [
        buildIssue({
          code: "INVALID_MONEY_VALUE",
          scope: "order",
          intentId: null,
          lineId: null,
          detail: "orderDiscountCents must be a non-negative integer.",
        }),
      ],
    };
  }

  const participants = input.lines
    .map((line) => ({ ...line }))
    .filter((line) => line.baseCents > 0)
    .sort((left, right) => {
      if (left.stablePosition !== right.stablePosition) {
        return left.stablePosition - right.stablePosition;
      }

      return left.lineId.localeCompare(right.lineId);
    });

  const baseSum = participants.reduce((sum, line) => sum + line.baseCents, 0);

  if (input.orderDiscountCents > baseSum) {
    return {
      ok: false,
      orderDiscountCents: input.orderDiscountCents,
      lines: [],
      errors: [
        buildIssue({
          code: "ORDER_DISCOUNT_EXCEEDS_REMAINING_TOTAL",
          scope: "order",
          intentId: null,
          lineId: null,
          detail: "Order discount allocation cannot exceed sum of participating line bases.",
        }),
      ],
    };
  }

  if (participants.length === 0 || input.orderDiscountCents === 0) {
    return {
      ok: true,
      orderDiscountCents: input.orderDiscountCents,
      lines: input.lines.map((line) => ({
        lineId: line.lineId,
        stablePosition: line.stablePosition,
        baseCents: line.baseCents,
        allocatedDiscountCents: 0,
      })),
      errors: [],
    };
  }

  const totalBase = BigInt(baseSum);
  const orderDiscount = BigInt(input.orderDiscountCents);
  const provisional = participants.map((line) => {
    const numerator = BigInt(line.baseCents) * orderDiscount;
    const floor = numerator / totalBase;
    const residue = numerator % totalBase;
    return {
      ...line,
      floor,
      residue,
    };
  });

  const floorSum = provisional.reduce((sum, line) => sum + line.floor, BIGINT_ZERO);
  const safeFloorSum = toSafeNumber(floorSum, {
    scope: "order",
    intentId: null,
    lineId: null,
    detail: "Floor sum for order discount allocation exceeded safe integer range.",
  });

  if (!safeFloorSum.ok) {
    return {
      ok: false,
      orderDiscountCents: input.orderDiscountCents,
      lines: [],
      errors: [safeFloorSum.error],
    };
  }

  let remainder = input.orderDiscountCents - safeFloorSum.value;
  const ranked = [...provisional].sort((left, right) => {
    if (left.residue !== right.residue) {
      return left.residue > right.residue ? -1 : 1;
    }
    if (left.stablePosition !== right.stablePosition) {
      return left.stablePosition - right.stablePosition;
    }
    return left.lineId.localeCompare(right.lineId);
  });

  const allocatedByLineId = new Map<string, number>();
  for (const line of provisional) {
    const safe = toSafeNumber(line.floor, {
      scope: "order",
      intentId: null,
      lineId: line.lineId,
      detail: "Allocated floor amount exceeded safe integer range.",
    });

    if (!safe.ok) {
      return {
        ok: false,
        orderDiscountCents: input.orderDiscountCents,
        lines: [],
        errors: [safe.error],
      };
    }

    allocatedByLineId.set(line.lineId, safe.value);
  }

  for (const line of ranked) {
    if (remainder <= 0) {
      break;
    }

    const current = allocatedByLineId.get(line.lineId) ?? 0;
    if (current >= line.baseCents) {
      continue;
    }

    allocatedByLineId.set(line.lineId, current + 1);
    remainder -= 1;
  }

  return {
    ok: true,
    orderDiscountCents: input.orderDiscountCents,
    lines: input.lines.map((line) => ({
      lineId: line.lineId,
      stablePosition: line.stablePosition,
      baseCents: line.baseCents,
      allocatedDiscountCents: allocatedByLineId.get(line.lineId) ?? 0,
    })),
    errors: [],
  };
}

export function evaluateRetailPosLineCostPosition(input: {
  lineId: string;
  netLineCents: number;
  unitCostCents?: number | null;
  quantity: RetailPosQuantityString;
}): RetailPosLineCostPositionResult {
  const quantity = parseCanonicalQuantityToMillis(input.quantity);
  if (!quantity.ok) {
    return {
      position: "unknown",
      totalCostCents: null,
      warnings: [
        buildIssue({
          code: "COST_UNKNOWN",
          severity: "warning",
          scope: "line_result",
          intentId: null,
          lineId: input.lineId,
          detail: "Cost position cannot be evaluated because quantity is invalid.",
        }),
      ],
    };
  }

  const totalCost = computeTotalCost(input.unitCostCents, quantity.quantityMillis, input.lineId);
  if (!totalCost.ok) {
    return {
      position: "unknown",
      totalCostCents: null,
      warnings: [
        buildIssue({
          code: "COST_UNKNOWN",
          severity: "warning",
          scope: "line_result",
          intentId: null,
          lineId: input.lineId,
          detail: totalCost.error.detail,
        }),
      ],
    };
  }

  if (totalCost.totalCostCents == null) {
    return {
      position: "unknown",
      totalCostCents: null,
      warnings: [
        buildIssue({
          code: "COST_UNKNOWN",
          severity: "warning",
          scope: "line_result",
          intentId: null,
          lineId: input.lineId,
          detail: "Cost position is unknown because line cost is not available.",
        }),
      ],
    };
  }

  if (input.netLineCents < totalCost.totalCostCents) {
    return {
      position: "below_cost",
      totalCostCents: totalCost.totalCostCents,
      warnings: [
        buildIssue({
          code: "BELOW_COST",
          severity: "warning",
          scope: "line_result",
          intentId: null,
          lineId: input.lineId,
          detail: "Line net amount is below total cost.",
        }),
      ],
    };
  }

  return {
    position: "above_or_equal_cost",
    totalCostCents: totalCost.totalCostCents,
    warnings: [],
  };
}

export function calculateRetailPosDiscountedOrder(input: {
  lines: RetailPosDiscountLineInput[];
  intents: RetailPosDiscountIntent[];
}): RetailPosDiscountedOrderResult {
  const errors: RetailPosDiscountIssue[] = [];
  const warnings: RetailPosDiscountIssue[] = [];

  const lineMap = new Map<string, RetailPosDiscountLineInput>();
  for (const line of input.lines) {
    lineMap.set(line.id, line);
  }

  const lineIntentByLineId = new Map<string, RetailPosDiscountIntent>();
  let orderIntent: RetailPosDiscountIntent | null = null;

  for (const intent of input.intents) {
    const validation = validateRetailPosDiscountIntent(intent);
    warnings.push(...validation.warnings);
    if (!validation.ok) {
      errors.push(...validation.errors);
      continue;
    }

    if (intent.scope === "line") {
      const lineId = normalizeOptionalText(intent.lineId)!;
      if (!lineMap.has(lineId)) {
        errors.push(
          buildIssue({
            code: "LINE_NOT_FOUND",
            scope: "line",
            intentId: intent.id ?? null,
            lineId,
            detail: "Discount intent references a line that does not exist in the order input.",
          }),
        );
        continue;
      }

      if (lineIntentByLineId.has(lineId)) {
        errors.push(
          buildIssue({
            code: "DUPLICATE_LINE_DISCOUNT",
            scope: "line",
            intentId: intent.id ?? null,
            lineId,
            detail: "Only one direct discount intent is allowed per line.",
          }),
        );
        continue;
      }

      lineIntentByLineId.set(lineId, intent);
      continue;
    }

    if (orderIntent) {
      errors.push(
        buildIssue({
          code: "MULTIPLE_ORDER_DISCOUNTS",
          scope: "order",
          intentId: intent.id ?? null,
          lineId: null,
          detail: "Only one order-wide discount intent is allowed.",
        }),
      );
      continue;
    }

    orderIntent = intent;
  }

  if (errors.length > 0) {
    return {
      ok: false,
      subtotalGrossCents: 0,
      directDiscountTotalCents: 0,
      orderDiscountTotalCents: 0,
      discountTotalCents: 0,
      totalCents: 0,
      lines: [],
      linesBelowCost: [],
      warnings,
      errors,
    };
  }

  const lineResults: Array<{
    line: RetailPosDiscountLineInput;
    quantityMillis: number;
    grossCents: number;
    directDiscountCents: number;
    directIntent: RetailPosDiscountIntent | null;
    warnings: RetailPosDiscountIssue[];
  }> = [];

  for (const line of input.lines) {
    const quantity = parseCanonicalQuantityToMillis(line.quantity);
    if (!quantity.ok) {
      errors.push({ ...quantity.error, lineId: line.id });
      continue;
    }

    const lineDiscount = calculateRetailPosLineDiscount({
      line,
      intent: lineIntentByLineId.get(line.id) ?? null,
    });

    warnings.push(...lineDiscount.warnings);

    if (!lineDiscount.ok) {
      errors.push(...lineDiscount.errors);
      continue;
    }

    lineResults.push({
      line,
      quantityMillis: quantity.quantityMillis,
      grossCents: lineDiscount.grossCents,
      directDiscountCents: lineDiscount.discountCents,
      directIntent: lineDiscount.appliedIntent,
      warnings: [...lineDiscount.warnings],
    });
  }

  if (errors.length > 0) {
    return {
      ok: false,
      subtotalGrossCents: 0,
      directDiscountTotalCents: 0,
      orderDiscountTotalCents: 0,
      discountTotalCents: 0,
      totalCents: 0,
      lines: [],
      linesBelowCost: [],
      warnings,
      errors,
    };
  }

  const subtotalGrossCents = lineResults.reduce((sum, line) => sum + line.grossCents, 0);
  const directDiscountTotalCents = lineResults.reduce((sum, line) => sum + line.directDiscountCents, 0);
  const remainingBaseCents = subtotalGrossCents - directDiscountTotalCents;

  const orderDiscount = calculateRetailPosOrderDiscount({
    baseCents: remainingBaseCents,
    intent: orderIntent,
  });
  warnings.push(...orderDiscount.warnings);

  if (!orderDiscount.ok) {
    return {
      ok: false,
      subtotalGrossCents,
      directDiscountTotalCents,
      orderDiscountTotalCents: 0,
      discountTotalCents: directDiscountTotalCents,
      totalCents: remainingBaseCents,
      lines: [],
      linesBelowCost: [],
      warnings,
      errors: orderDiscount.errors,
    };
  }

  const allocation = allocateRetailPosOrderDiscountAcrossLines({
    orderDiscountCents: orderDiscount.discountCents,
    lines: lineResults.map((line) => ({
      lineId: line.line.id,
      stablePosition: line.line.stablePosition,
      baseCents: line.grossCents - line.directDiscountCents,
    })),
  });

  if (!allocation.ok) {
    return {
      ok: false,
      subtotalGrossCents,
      directDiscountTotalCents,
      orderDiscountTotalCents: 0,
      discountTotalCents: directDiscountTotalCents,
      totalCents: remainingBaseCents,
      lines: [],
      linesBelowCost: [],
      warnings,
      errors: allocation.errors,
    };
  }

  const allocationByLineId = new Map(
    allocation.lines.map((line) => [line.lineId, line.allocatedDiscountCents]),
  );

  const calculatedLines: RetailPosCalculatedLine[] = lineResults.map((result) => {
    const orderDiscountAllocationCents = allocationByLineId.get(result.line.id) ?? 0;
    const totalDiscountCents = result.directDiscountCents + orderDiscountAllocationCents;
    const netLineCents = result.grossCents - totalDiscountCents;
    const costPosition = evaluateRetailPosLineCostPosition({
      lineId: result.line.id,
      netLineCents,
      unitCostCents: result.line.unitCostCents,
      quantity: result.line.quantity,
    });
    const totalCost = computeTotalCost(
      result.line.unitCostCents,
      result.quantityMillis,
      result.line.id,
    );

    return {
      id: result.line.id,
      stablePosition: result.line.stablePosition,
      quantity: result.line.quantity,
      quantityMillis: result.quantityMillis,
      unitPriceCents: result.line.unitPriceCents ?? null,
      grossLineCents: result.grossCents,
      directDiscountCents: result.directDiscountCents,
      orderDiscountAllocationCents,
      totalDiscountCents,
      netLineCents,
      unitCostCents: result.line.unitCostCents ?? null,
      totalCostCents: totalCost.ok ? totalCost.totalCostCents : null,
      costPosition: costPosition.position,
      directDiscountIntent: result.directIntent,
      orderDiscountIntent: orderDiscount.appliedIntent,
      warnings: [...result.warnings, ...costPosition.warnings],
    };
  });

  const orderDiscountTotalCents = allocation.lines.reduce(
    (sum, line) => sum + line.allocatedDiscountCents,
    0,
  );
  const discountTotalCents = directDiscountTotalCents + orderDiscountTotalCents;
  const totalCents = subtotalGrossCents - discountTotalCents;

  for (const line of calculatedLines) {
    warnings.push(...line.warnings);
  }

  return {
    ok: true,
    subtotalGrossCents,
    directDiscountTotalCents,
    orderDiscountTotalCents,
    discountTotalCents,
    totalCents,
    lines: calculatedLines,
    linesBelowCost: calculatedLines.filter((line) => line.costPosition === "below_cost"),
    warnings,
    errors: [],
  };
}

function resolveLineGross(
  line: RetailPosDiscountLineInput,
): { ok: true; grossCents: number } | { ok: false; error: RetailPosDiscountIssue } {
  if (line.grossLineCents != null) {
    if (!isNonNegativeInteger(line.grossLineCents)) {
      return {
        ok: false,
        error: buildIssue({
          code: "INVALID_MONEY_VALUE",
          scope: "input",
          intentId: null,
          lineId: line.id,
          detail: "grossLineCents must be a non-negative integer when provided.",
        }),
      };
    }

    return { ok: true, grossCents: line.grossLineCents };
  }

  const quantity = parseCanonicalQuantityToMillis(line.quantity);
  if (!quantity.ok) {
    return { ok: false, error: { ...quantity.error, lineId: line.id } };
  }

  if (line.unitPriceCents == null) {
    return {
      ok: false,
      error: buildIssue({
        code: "INVALID_MONEY_VALUE",
        scope: "input",
        intentId: null,
        lineId: line.id,
        detail: "Line must include either grossLineCents or unitPriceCents.",
      }),
    };
  }

  return computeGrossFromUnitPrice(line.unitPriceCents, quantity.quantityMillis, line.id);
}
