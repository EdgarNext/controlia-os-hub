import type {
  RetailPosDiscountIntentDraft,
  RetailPosDiscountPreviewRequest,
  RetailPosDiscountPreviewResponse,
  RetailPosOrder,
  RetailPosOrderLine,
} from "@/shared/types/retail-pos";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertRetailPosDeviceRole,
  resolveRetailPosRuntimeActor,
} from "./auth";
import {
  assertValidRetailPosDiscountIntentDrafts,
  buildRetailPosDiscountCalculationFingerprint,
  buildRetailPosDiscountCalculationFingerprintPayload,
  buildRetailPosDiscountCalculationSummary,
  buildRetailPosDiscountPreviewResponse,
} from "./discount-calculation";
import { RetailPosRuntimeError } from "./errors";
import type { RuntimePerfTrace } from "./runtime-perf";
import { runSupabaseReadWithRetry } from "./runtime-supabase-retry";

type OrderRow = RetailPosOrder & {
  revision?: number;
};

type OrderLineRow = RetailPosOrderLine;

type DeviceSettingsRow = {
  device_id: string;
  tenant_id: string;
  device_role: "order_station" | "cashier_station" | "backoffice_station" | "counter_station";
  can_apply_discounts: boolean;
  can_view_cost: boolean;
  is_active: boolean;
};

type CashShiftRow = {
  id: string;
  tenant_id: string;
  device_id: string;
  status: string;
};

type ProductCostRow = {
  id: string;
  cost_cents: number | null;
};

const ORDER_SELECT =
  "id, tenant_id, folio, origin_client_order_id, origin_local_folio, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, total_cents, revision, direct_discount_cents, order_discount_cents, paid_at, cancelled_at, cancelled_by_pos_user_id, cancel_reason, created_at, updated_at, created_by, updated_by";

const ORDER_LINE_SELECT =
  "id, tenant_id, order_id, line_number, product_id, product_variant_id, product_name, variant_name, sku, barcode, sales_unit_code, sales_unit_label, allow_decimal_quantity, quantity, unit_price_cents, line_subtotal_cents, discount_cents, line_total_cents, direct_discount_cents, order_discount_allocation_cents, total_discount_cents, unit_cost_snapshot_cents, cost_evaluation, below_cost_after_discount, created_at, updated_at, created_by, updated_by";

function normalizeRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new RetailPosRuntimeError(400, `${field} is required.`);
  }

  return value.trim();
}

function ensureNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new RetailPosRuntimeError(400, `${field} must be a non-negative integer.`);
  }

  return value;
}

function normalizePreviewRequest(
  payload: RetailPosDiscountPreviewRequest,
): RetailPosDiscountPreviewRequest {
  const orderId = normalizeRequiredString(payload.order_id, "payload.order_id");
  const cashShiftId = normalizeRequiredString(
    payload.cash_shift_id,
    "payload.cash_shift_id",
  );
  const expectedRevision = ensureNonNegativeInteger(
    payload.expected_revision,
    "payload.expected_revision",
  );
  const discountIntents = Array.isArray(payload.discount_intents)
    ? payload.discount_intents
    : [];

  assertValidRetailPosDiscountIntentDrafts(discountIntents);

  return {
    order_id: orderId,
    cash_shift_id: cashShiftId,
    expected_revision: expectedRevision,
    discount_intents: discountIntents as RetailPosDiscountIntentDraft[],
  };
}

async function loadDeviceSettings(input: {
  tenantId: string;
  deviceRecordId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<DeviceSettingsRow>({
    trace: input.trace,
    step: "discount_preview_device_settings",
    query: (signal) =>
      supabase
        .from("retail_pos_device_settings")
        .select(
          "device_id, tenant_id, device_role, can_apply_discounts, can_view_cost, is_active",
        )
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("device_id", input.deviceRecordId)
        .limit(1)
        .maybeSingle<DeviceSettingsRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos device settings: ${error.message}`,
    );
  }

  if (!data || !data.is_active) {
    throw new RetailPosRuntimeError(403, "CASHIER_STATION_REQUIRED");
  }

  return data;
}

async function loadCashShift(input: {
  tenantId: string;
  cashShiftId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<CashShiftRow>({
    trace: input.trace,
    step: "discount_preview_shift",
    query: (signal) =>
      supabase
        .from("retail_pos_cash_shifts")
        .select("id, tenant_id, device_id, status")
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.cashShiftId)
        .limit(1)
        .maybeSingle<CashShiftRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos cash shift: ${error.message}`,
    );
  }

  if (!data || data.status !== "open") {
    throw new RetailPosRuntimeError(409, "CASH_SHIFT_NOT_OPEN");
  }

  return data;
}

async function loadOrder(input: {
  tenantId: string;
  orderId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<OrderRow>({
    trace: input.trace,
    step: "discount_preview_order",
    query: (signal) =>
      supabase
        .from("retail_pos_orders")
        .select(ORDER_SELECT)
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.orderId)
        .limit(1)
        .maybeSingle<OrderRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos order: ${error.message}`,
    );
  }

  if (!data) {
    throw new RetailPosRuntimeError(404, "ORDER_NOT_FOUND");
  }

  return data;
}

async function loadOrderLines(input: {
  tenantId: string;
  orderId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<OrderLineRow[]>({
    trace: input.trace,
    step: "discount_preview_lines",
    query: (signal) =>
      supabase
        .from("retail_pos_order_lines")
        .select(ORDER_LINE_SELECT)
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("order_id", input.orderId)
        .order("line_number", { ascending: true })
        .returns<OrderLineRow[]>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos order lines: ${error.message}`,
    );
  }

  return data ?? [];
}

async function loadProductCosts(input: {
  tenantId: string;
  productIds: readonly string[];
  trace?: RuntimePerfTrace;
}) {
  if (input.productIds.length === 0) {
    return new Map<string, number | null>();
  }

  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<ProductCostRow[]>({
    trace: input.trace,
    step: "discount_preview_costs",
    query: (signal) =>
      supabase
        .from("retail_pos_products")
        .select("id, cost_cents")
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .in("id", [...new Set(input.productIds)])
        .returns<ProductCostRow[]>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos product costs: ${error.message}`,
    );
  }

  return new Map((data ?? []).map((row) => [row.id, row.cost_cents]));
}

export async function previewRetailPosOrderDiscounts(input: {
  tenantSlug: string;
  payload: RetailPosDiscountPreviewRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosDiscountPreviewResponse> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
    trace: input.trace,
  });

  assertRetailPosDeviceRole(actor, ["cashier_station"]);

  if (actor.mode !== "device" || !actor.deviceRecordId) {
    throw new RetailPosRuntimeError(403, "CASHIER_STATION_REQUIRED");
  }

  const payload = normalizePreviewRequest(input.payload);
  const settings = await loadDeviceSettings({
    tenantId: actor.tenantId,
    deviceRecordId: actor.deviceRecordId,
    trace: input.trace,
  });

  if (!settings.can_apply_discounts) {
    throw new RetailPosRuntimeError(403, "DISCOUNTS_CAPABILITY_REQUIRED");
  }

  const cashShift = await loadCashShift({
    tenantId: actor.tenantId,
    cashShiftId: payload.cash_shift_id,
    trace: input.trace,
  });

  if (cashShift.device_id !== actor.deviceRecordId) {
    throw new RetailPosRuntimeError(409, "CASH_SHIFT_NOT_OPEN");
  }

  const order = await loadOrder({
    tenantId: actor.tenantId,
    orderId: payload.order_id,
    trace: input.trace,
  });

  if (order.status === "paid") {
    throw new RetailPosRuntimeError(409, "ORDER_NOT_PENDING");
  }

  if (order.status !== "pending_payment") {
    throw new RetailPosRuntimeError(409, "ORDER_NOT_PENDING");
  }

  if ((order.revision ?? 0) !== payload.expected_revision) {
    throw new RetailPosRuntimeError(409, "ORDER_REVISION_CONFLICT", "ORDER_REVISION_CONFLICT", {
      current_revision: order.revision ?? 0,
      expected_revision: payload.expected_revision,
    });
  }

  const lines = await loadOrderLines({
    tenantId: actor.tenantId,
    orderId: payload.order_id,
    trace: input.trace,
  });
  if (lines.some((line) => line.price_tier_request_status === 'pending')) {
    throw new RetailPosRuntimeError(409, 'PRICE_TIER_DECISION_REQUIRED');
  }

  if (lines.length === 0) {
    throw new RetailPosRuntimeError(422, "DISCOUNT_INTENT_INVALID");
  }

  const costsByProductId = await loadProductCosts({
    tenantId: actor.tenantId,
    productIds: lines.map((line) => line.product_id),
    trace: input.trace,
  });

  const calculationLines = lines.map((line) => ({
    ...line,
    unit_cost_source_cents: costsByProductId.get(line.product_id) ?? null,
  }));
  const summary = buildRetailPosDiscountCalculationSummary({
    orderId: payload.order_id,
    expectedRevision: payload.expected_revision,
    lines: calculationLines,
    intents: payload.discount_intents,
  });
  const calculationFingerprint = buildRetailPosDiscountCalculationFingerprint(
    buildRetailPosDiscountCalculationFingerprintPayload({
      tenantId: actor.tenantId,
      orderId: payload.order_id,
      expectedRevision: payload.expected_revision,
      lines: calculationLines,
      intents: payload.discount_intents,
      summary,
    }),
  );

  return buildRetailPosDiscountPreviewResponse({
    orderId: payload.order_id,
    revision: order.revision ?? 0,
    calculationFingerprint,
    summary,
    lines: calculationLines,
    canViewCost: settings.can_view_cost,
  });
}
