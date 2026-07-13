import { createHash } from "node:crypto";
import {
  calculateRetailPosDiscountedOrder,
  type RetailPosDiscountIntent as EngineDiscountIntent,
  type RetailPosDiscountLineInput,
} from "@/shared/retail-pos/discount-engine";
import type {
  RetailPosDiscountCalculationSummary,
  RetailPosDiscountIntentDraft,
  RetailPosDiscountPreviewLine,
  RetailPosDiscountPreviewResponse,
  RetailPosDiscountWarningSnapshot,
  RetailPosOrderLine,
} from "@/shared/types/retail-pos";
import { validateRetailPosDiscountIntentDraft } from "@/shared/types/retail-pos";
import { RetailPosRuntimeError } from "./errors";
import {
  isRetailPosCanonicalQuantity,
  normalizeRetailPosQuantity,
} from "./quantity";

export type RetailPosDiscountCapability =
  | "discounts.apply"
  | "discounts.view_cost";

export type RetailPosDiscountSummarySourceLine = Pick<
  RetailPosOrderLine,
  | "id"
  | "line_number"
  | "product_id"
  | "product_variant_id"
  | "product_name"
  | "variant_name"
  | "sku"
  | "barcode"
  | "sales_unit_code"
  | "sales_unit_label"
  | "allow_decimal_quantity"
  | "quantity"
  | "unit_price_cents"
  | "line_subtotal_cents"
  | "unit_cost_snapshot_cents"
> & {
  unit_cost_source_cents: number | null;
};

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableJsonValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableJsonValue(nested)]),
    );
  }

  return value;
}

export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(stableJsonValue(value));
}

export function buildRetailPosDiscountCalculationFingerprint(value: unknown): string {
  return createHash("sha256").update(stableJsonStringify(value)).digest("hex");
}

export function sortRetailPosDiscountIntentDrafts(
  intents: readonly RetailPosDiscountIntentDraft[],
): RetailPosDiscountIntentDraft[] {
  return [...intents].sort((left, right) => {
    const scopeOrder = left.scope.localeCompare(right.scope);
    if (scopeOrder !== 0) {
      return scopeOrder;
    }

    const lineOrder = (left.order_line_id ?? "").localeCompare(right.order_line_id ?? "");
    if (lineOrder !== 0) {
      return lineOrder;
    }

    const captureOrder = left.capture_type.localeCompare(right.capture_type);
    if (captureOrder !== 0) {
      return captureOrder;
    }

    if ((left.percentage_bps ?? -1) !== (right.percentage_bps ?? -1)) {
      return (left.percentage_bps ?? -1) - (right.percentage_bps ?? -1);
    }

    if ((left.amount_cents ?? -1) !== (right.amount_cents ?? -1)) {
      return (left.amount_cents ?? -1) - (right.amount_cents ?? -1);
    }

    const reasonOrder = left.reason_code.localeCompare(right.reason_code);
    if (reasonOrder !== 0) {
      return reasonOrder;
    }

    return left.id.localeCompare(right.id);
  });
}

export function normalizeRetailPosDiscountIntentDrafts(
  intents: readonly RetailPosDiscountIntentDraft[],
): EngineDiscountIntent[] {
  return sortRetailPosDiscountIntentDrafts(intents).map((intent, index) => ({
    id: intent.id || `discount-intent-${index + 1}`,
    scope: intent.scope,
    lineId: intent.order_line_id,
    captureType: intent.capture_type,
    percentageBps: intent.percentage_bps,
    amountCents: intent.amount_cents,
    reasonCode: intent.reason_code,
    comment: intent.comment,
    authorization: {
      status: intent.authorization?.status ?? "not_required",
      method: intent.authorization?.method ?? "role_capability",
      policyKey: intent.authorization?.policy_key ?? null,
      note: intent.authorization?.note ?? null,
    },
    origin: "manual",
  }));
}

export function assertValidRetailPosDiscountIntentDrafts(
  intents: readonly RetailPosDiscountIntentDraft[],
): void {
  const issues = intents.flatMap((intent) =>
    validateRetailPosDiscountIntentDraft(intent).map((detail) => ({
      draft_id: intent.id,
      detail,
    })),
  );

  if (issues.length > 0) {
    throw new RetailPosRuntimeError(
      422,
      "DISCOUNT_INTENT_INVALID",
      "DISCOUNT_INTENT_INVALID",
      { issues },
    );
  }
}

function normalizeDiscountCalculationLineQuantity(line: {
  id: string;
  line_number: number;
  quantity: string;
}) {
  const normalized = normalizeRetailPosQuantity(line.quantity);

  if (!normalized || !isRetailPosCanonicalQuantity(normalized)) {
    throw new RetailPosRuntimeError(
      422,
      "DISCOUNT_INTENT_INVALID",
      "DISCOUNT_INTENT_INVALID",
      {
        issues: [
          {
            code: "INVALID_QUANTITY",
            line_id: line.id,
            line_number: line.line_number,
            detail: `Line ${line.line_number} has an invalid quantity format for discount calculation.`,
          },
        ],
        summary: "INVALID_QUANTITY",
      },
    );
  }

  return normalized;
}

export function buildRetailPosDiscountCalculationSummary(input: {
  orderId: string;
  expectedRevision: number;
  lines: readonly RetailPosDiscountSummarySourceLine[];
  intents: readonly RetailPosDiscountIntentDraft[];
}): RetailPosDiscountCalculationSummary {
  const calculationInputLines: RetailPosDiscountLineInput[] = input.lines.map((line) => ({
    id: line.id,
    stablePosition: line.line_number,
    quantity: normalizeDiscountCalculationLineQuantity(line),
    unitPriceCents: line.unit_price_cents,
    grossLineCents: line.line_subtotal_cents,
    unitCostCents: line.unit_cost_snapshot_cents ?? line.unit_cost_source_cents ?? null,
  }));

  const result = calculateRetailPosDiscountedOrder({
    lines: calculationInputLines,
    intents: normalizeRetailPosDiscountIntentDrafts(input.intents),
  });

  if (!result.ok) {
    const detail = result.errors.map((issue) => issue.code).join(", ");
    throw new RetailPosRuntimeError(
      422,
      "DISCOUNT_INTENT_INVALID",
      "DISCOUNT_INTENT_INVALID",
      {
        issues: result.errors.map((issue) => ({
          code: issue.code,
          line_id: issue.lineId ?? null,
          detail: issue.detail,
        })),
        summary: detail,
      },
    );
  }

  return {
    order_id: input.orderId,
    expected_revision: input.expectedRevision,
    subtotal_gross_cents: result.subtotalGrossCents,
    direct_discount_cents: result.directDiscountTotalCents,
    order_discount_cents: result.orderDiscountTotalCents,
    total_discount_cents: result.discountTotalCents,
    total_cents: result.totalCents,
    lines: [...result.lines]
      .sort((left, right) => {
        if (left.stablePosition !== right.stablePosition) {
          return left.stablePosition - right.stablePosition;
        }

        return left.id.localeCompare(right.id);
      })
      .map((line) => ({
        order_line_id: line.id,
        line_number: line.stablePosition,
        gross_cents: line.grossLineCents,
        direct_discount_cents: line.directDiscountCents,
        order_discount_allocation_cents: line.orderDiscountAllocationCents,
        total_discount_cents: line.totalDiscountCents,
        net_cents: line.netLineCents,
        unit_cost_snapshot_cents: line.unitCostCents,
        total_cost_cents: line.totalCostCents,
        margin_delta_cents:
          line.totalCostCents == null ? null : line.netLineCents - line.totalCostCents,
        cost_evaluation: line.costPosition,
        below_cost_after_discount: line.costPosition === "below_cost",
      })),
    warnings: result.warnings.map((warning) => ({
      code: warning.code,
      message: warning.detail,
      order_line_id: warning.lineId,
    })),
  };
}

export function redactRetailPosDiscountCalculationSummary(
  summary: RetailPosDiscountCalculationSummary,
  canViewCost: boolean,
): RetailPosDiscountCalculationSummary {
  if (canViewCost) {
    return summary;
  }

  return {
    ...summary,
    lines: summary.lines.map((line) => ({
      ...line,
      unit_cost_snapshot_cents: null,
      total_cost_cents: null,
      margin_delta_cents: null,
    })),
  };
}

export function buildRetailPosDiscountCalculationFingerprintPayload(input: {
  tenantId: string;
  orderId: string;
  expectedRevision: number;
  lines: readonly RetailPosDiscountSummarySourceLine[];
  intents: readonly RetailPosDiscountIntentDraft[];
  summary: RetailPosDiscountCalculationSummary;
}) {
  return {
    tenant_id: input.tenantId,
    order_id: input.orderId,
    expected_revision: input.expectedRevision,
    lines: [...input.lines]
      .sort((left, right) => {
        if (left.line_number !== right.line_number) {
          return left.line_number - right.line_number;
        }

        return left.id.localeCompare(right.id);
      })
      .map((line) => ({
        order_line_id: line.id,
        line_number: line.line_number,
        product_id: line.product_id,
        quantity: line.quantity,
        unit_price_cents: line.unit_price_cents,
        line_subtotal_cents: line.line_subtotal_cents,
        unit_cost_snapshot_cents:
          line.unit_cost_snapshot_cents ?? line.unit_cost_source_cents ?? null,
      })),
    discount_intents: sortRetailPosDiscountIntentDrafts(input.intents),
    summary: {
      ...input.summary,
      lines: [...input.summary.lines].sort((left, right) => {
        if (left.line_number !== right.line_number) {
          return left.line_number - right.line_number;
        }

        return left.order_line_id.localeCompare(right.order_line_id);
      }),
      warnings: [...input.summary.warnings].sort((left, right) => {
        const lineOrder = (left.order_line_id ?? "").localeCompare(right.order_line_id ?? "");
        if (lineOrder !== 0) {
          return lineOrder;
        }

        const codeOrder = left.code.localeCompare(right.code);
        if (codeOrder !== 0) {
          return codeOrder;
        }

        return left.message.localeCompare(right.message);
      }),
    },
    below_cost_line_ids: input.summary.lines
      .filter((line) => line.below_cost_after_discount)
      .map((line) => line.order_line_id)
      .sort((left, right) => left.localeCompare(right)),
  };
}

export function buildRetailPosDiscountPreviewResponse(input: {
  orderId: string;
  revision: number;
  calculationFingerprint: string;
  summary: RetailPosDiscountCalculationSummary;
  lines: readonly RetailPosDiscountSummarySourceLine[];
  canViewCost: boolean;
}): RetailPosDiscountPreviewResponse {
  const summaryByLineId = new Map(
    input.summary.lines.map((line) => [line.order_line_id, line]),
  );
  const warningsByLineId = new Map<string, RetailPosDiscountWarningSnapshot[]>();

  for (const warning of input.summary.warnings) {
    if (!warning.order_line_id) {
      continue;
    }

    const bucket = warningsByLineId.get(warning.order_line_id) ?? [];
    bucket.push(warning);
    warningsByLineId.set(warning.order_line_id, bucket);
  }

  const lines: RetailPosDiscountPreviewLine[] = input.lines.map((line) => {
    const summaryLine = summaryByLineId.get(line.id);
    if (!summaryLine) {
      throw new RetailPosRuntimeError(500, "DISCOUNT_PREVIEW_FAILED");
    }

    return {
      order_line_id: line.id,
      line_number: line.line_number,
      product_id: line.product_id,
      product_variant_id: line.product_variant_id,
      product_name: line.product_name,
      variant_name: line.variant_name,
      sku: line.sku,
      barcode: line.barcode,
      sales_unit_code: line.sales_unit_code,
      sales_unit_label: line.sales_unit_label,
      allow_decimal_quantity: line.allow_decimal_quantity,
      quantity: line.quantity,
      unit_price_cents: line.unit_price_cents,
      gross_cents: summaryLine.gross_cents,
      direct_discount_cents: summaryLine.direct_discount_cents,
      order_discount_allocation_cents: summaryLine.order_discount_allocation_cents,
      total_discount_cents: summaryLine.total_discount_cents,
      net_cents: summaryLine.net_cents,
      unit_cost_snapshot_cents: input.canViewCost
        ? summaryLine.unit_cost_snapshot_cents
        : null,
      total_cost_cents: input.canViewCost ? summaryLine.total_cost_cents : null,
      margin_delta_cents: input.canViewCost ? summaryLine.margin_delta_cents : null,
      cost_evaluation: summaryLine.cost_evaluation,
      below_cost_after_discount: summaryLine.below_cost_after_discount,
      warnings: warningsByLineId.get(line.id) ?? [],
    };
  });

  const belowCostLineIds = lines
    .filter((line) => line.below_cost_after_discount)
    .map((line) => line.order_line_id);

  return {
    order_id: input.orderId,
    revision: input.revision,
    calculation_fingerprint: input.calculationFingerprint,
    subtotal_cents: input.summary.subtotal_gross_cents,
    line_discount_cents: input.summary.direct_discount_cents,
    order_discount_cents: input.summary.order_discount_cents,
    total_discount_cents: input.summary.total_discount_cents,
    total_cents: input.summary.total_cents,
    has_below_cost_lines: belowCostLineIds.length > 0,
    requires_below_cost_acknowledgement: belowCostLineIds.length > 0,
    below_cost_line_ids: belowCostLineIds,
    lines,
    warnings: input.summary.warnings,
    authorization: {
      required: false,
      method: "role_capability",
      future_policy_supported: true,
    },
  };
}
