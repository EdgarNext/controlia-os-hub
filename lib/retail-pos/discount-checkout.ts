import type {
  RetailPosOrder,
  RetailPosOrderLine,
  RetailPosPayment,
  RetailPosPaymentMethod,
} from "@/shared/types/retail-pos";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertRetailPosDeviceRole,
  resolveRetailPosRuntimeActor,
} from "./auth";
import { RetailPosRuntimeError } from "./errors";
import type { RuntimePerfTrace } from "./runtime-perf";
import { runSupabaseReadWithRetry } from "./runtime-supabase-retry";
import {
  assertValidRetailPosDiscountIntentDrafts,
  buildRetailPosDiscountCalculationFingerprint as buildSharedRetailPosDiscountCalculationFingerprint,
  buildRetailPosDiscountCalculationFingerprintPayload,
  buildRetailPosDiscountCalculationSummary as buildSharedRetailPosDiscountCalculationSummary,
  redactRetailPosDiscountCalculationSummary as redactSharedRetailPosDiscountCalculationSummary,
  sortRetailPosDiscountIntentDrafts,
} from "./discount-calculation";

type RetailPosDiscountScope = "line" | "order";
type RetailPosDiscountCaptureType = "percentage" | "fixed_amount";
type RetailPosDiscountReasonCode =
  | "volume"
  | "frequent_customer"
  | "authorized_wholesale"
  | "price_adjustment"
  | "damaged_product"
  | "manual_promotion"
  | "rounding"
  | "capture_error"
  | "cashier_authorization"
  | "other";
type RetailPosDiscountAuthorizationStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";
type RetailPosDiscountAuthorizationMethod =
  | "role_capability"
  | "supervisor_pin"
  | "remote_approval"
  | "system_policy";
type RetailPosDiscountCostEvaluation =
  | "above_or_equal_cost"
  | "below_cost"
  | "unknown";
type RetailPosDiscountAuthorizationRecord = {
  required: boolean;
  status: RetailPosDiscountAuthorizationStatus;
  method: RetailPosDiscountAuthorizationMethod | null;
  policy_key: string | null;
  requested_by_pos_user_id: string | null;
  authorized_by_pos_user_id: string | null;
  authorized_at: string | null;
  reference: string | null;
  note: string | null;
  context: Record<string, unknown>;
};
type RetailPosDiscountIntentDraft = {
  id: string;
  scope: RetailPosDiscountScope;
  order_line_id: string | null;
  capture_type: RetailPosDiscountCaptureType;
  percentage_bps: number | null;
  amount_cents: number | null;
  reason_code: RetailPosDiscountReasonCode;
  comment: string | null;
  source: "manual";
  authorization: RetailPosDiscountAuthorizationRecord | null;
};
type RetailPosDiscountLineSnapshot = {
  order_line_id: string;
  line_number: number;
  gross_cents: number;
  direct_discount_cents: number;
  order_discount_allocation_cents: number;
  total_discount_cents: number;
  net_cents: number;
  unit_cost_snapshot_cents: number | null;
  total_cost_cents: number | null;
  margin_delta_cents: number | null;
  cost_evaluation: RetailPosDiscountCostEvaluation;
  below_cost_after_discount: boolean;
};
type RetailPosDiscountCalculationSummary = {
  order_id: string;
  expected_revision: number;
  subtotal_gross_cents: number;
  direct_discount_cents: number;
  order_discount_cents: number;
  total_discount_cents: number;
  total_cents: number;
  lines: RetailPosDiscountLineSnapshot[];
  warnings: Array<{
    code: string;
    message: string;
    order_line_id: string | null;
  }>;
};
type RetailPosBelowCostAcknowledgement = {
  accepted: boolean;
  calculation_fingerprint: string | null;
};
type RetailPosDiscountCheckoutCommandPayload = {
  order_id: string;
  payment_method: RetailPosPaymentMethod;
  payment_amount_cents: number;
  cash_received_cents: number | null;
  expected_revision: number;
  discount_intents: RetailPosDiscountIntentDraft[];
  below_cost_acknowledgement: RetailPosBelowCostAcknowledgement | null;
  external_payment_reference: string | null;
};
type RetailPosDiscountCheckoutResponse = {
  order: RetailPosOrder;
  payment: RetailPosPayment;
  previous_revision: number;
  final_revision: number;
  subtotal_cents: number;
  line_discount_cents: number;
  order_discount_cents: number;
  total_discount_cents: number;
  total_cents: number;
  change_cents: number;
  below_cost: boolean;
  below_cost_line_ids: string[];
  discount_snapshot: RetailPosDiscountCalculationSummary;
};
type RetailPosDiscountCheckoutCommand = {
  command_id: string;
  command_type: "discount_checkout";
  device_id: string;
  operator_id: string;
  cash_shift_id: string;
  payload: RetailPosDiscountCheckoutCommandPayload;
};
type RetailPosDiscountCheckoutCommandResult = {
  command_id: string;
  command_type: "discount_checkout";
  status: "accepted" | "completed" | "replayed" | "rejected";
  idempotent_replay: boolean;
  device_id: string;
  operator_id: string | null;
  cash_shift_id: string | null;
  result: RetailPosDiscountCheckoutResponse;
  server_time: string;
};

type OrderRow = RetailPosOrder & {
  revision?: number;
  direct_discount_cents?: number;
  order_discount_cents?: number;
};
type OrderLineRow = RetailPosOrderLine & {
  direct_discount_cents?: number;
  order_discount_allocation_cents?: number;
  total_discount_cents?: number;
  unit_cost_snapshot_cents?: number | null;
  cost_evaluation?: RetailPosDiscountCostEvaluation;
  below_cost_after_discount?: boolean;
};

type PosUserRow = {
  id: string;
  tenant_id: string;
  is_active: boolean;
};

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

type DiscountCheckoutRpcResult = RetailPosDiscountCheckoutCommandResult;

const ORDER_SELECT =
  "id, tenant_id, folio, origin_client_order_id, origin_local_folio, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, total_cents, revision, direct_discount_cents, order_discount_cents, paid_at, cancelled_at, cancelled_by_pos_user_id, cancel_reason, created_at, updated_at, created_by, updated_by";

const ORDER_LINE_SELECT =
  "id, tenant_id, order_id, line_number, product_id, product_variant_id, product_name, variant_name, sku, barcode, sales_unit_code, sales_unit_label, allow_decimal_quantity, quantity, unit_price_cents, line_subtotal_cents, discount_cents, line_total_cents, direct_discount_cents, order_discount_allocation_cents, total_discount_cents, unit_cost_snapshot_cents, cost_evaluation, below_cost_after_discount, created_at, updated_at, created_by, updated_by";

const SAFE_CONFLICT_MESSAGES = new Set([
  "DISCOUNT_REQUIRED",
  "DISCOUNT_INTENT_INVALID",
  "DISCOUNTS_CAPABILITY_REQUIRED",
  "CASHIER_STATION_REQUIRED",
  "CASH_SHIFT_NOT_OPEN",
  "ORDER_NOT_FOUND",
  "ORDER_NOT_PENDING",
  "ORDER_ALREADY_PAID",
  "ORDER_REVISION_CONFLICT",
  "PAYMENT_AMOUNT_MISMATCH",
  "INSUFFICIENT_CASH_RECEIVED",
  "BELOW_COST_ACKNOWLEDGEMENT_REQUIRED",
  "CALCULATION_FINGERPRINT_MISMATCH",
  "COMMAND_PAYLOAD_MISMATCH",
  "COMMAND_IN_PROGRESS",
  "UNSAFE_MONEY_VALUE",
]);

function normalizeRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new RetailPosRuntimeError(400, `${field} is required.`);
  }

  return value.trim();
}

function ensureNonNegativeInteger(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new RetailPosRuntimeError(400, `${field} must be a non-negative integer.`);
  }

  return value;
}

async function loadDeviceSettings(input: {
  tenantId: string;
  deviceRecordId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<DeviceSettingsRow>({
    trace: input.trace,
    step: "discount_checkout_device_settings",
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

async function assertPosUser(input: {
  tenantId: string;
  posUserId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<PosUserRow>({
    trace: input.trace,
    step: "discount_checkout_pos_user",
    query: (signal) =>
      supabase
        .from("pos_users")
        .select("id, tenant_id, is_active")
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.posUserId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle<PosUserRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load POS user: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(422, "DISCOUNT_INTENT_INVALID");
  }
}

async function loadCashShift(input: {
  tenantId: string;
  cashShiftId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<CashShiftRow>({
    trace: input.trace,
    step: "discount_checkout_shift",
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

  if (!data) {
    throw new RetailPosRuntimeError(404, "CASH_SHIFT_NOT_OPEN");
  }

  return data;
}

async function loadOrderForDiscountCheckout(input: {
  tenantId: string;
  orderId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<OrderRow>({
    trace: input.trace,
    step: "discount_checkout_order",
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

async function loadOrderLinesForDiscountCheckout(input: {
  tenantId: string;
  orderId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<OrderLineRow[]>({
    trace: input.trace,
    step: "discount_checkout_lines",
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
    step: "discount_checkout_costs",
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

function mapDiscountCheckoutRpcError(
  error: { message?: string } | null,
): RetailPosRuntimeError {
  const message = error?.message ?? "CHECKOUT_TRANSACTION_FAILED";

  if (SAFE_CONFLICT_MESSAGES.has(message)) {
    const status =
      message === "ORDER_NOT_FOUND"
        ? 404
        : message === "DISCOUNTS_CAPABILITY_REQUIRED" ||
            message === "CASHIER_STATION_REQUIRED"
          ? 403
          : message === "DISCOUNT_INTENT_INVALID"
            ? 422
            : 409;

    return new RetailPosRuntimeError(status, message);
  }

  if (message === "CHECKOUT_TRANSACTION_FAILED") {
    return new RetailPosRuntimeError(500, message);
  }

  return new RetailPosRuntimeError(500, message);
}

export async function checkoutRetailPosOrderWithDiscountsCommand(input: {
  tenantSlug: string;
  command: RetailPosDiscountCheckoutCommand;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosDiscountCheckoutCommandResult> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
    trace: input.trace,
  });

  if (actor.mode !== "device" || !actor.deviceRecordId || !actor.devicePublicId) {
    throw new RetailPosRuntimeError(401, "device auth is required for retail_pos discount checkout.");
  }

  assertRetailPosDeviceRole(actor, ["cashier_station"]);

  if (input.command.command_type !== "discount_checkout") {
    throw new RetailPosRuntimeError(400, "command_type must be discount_checkout.");
  }

  const commandId = normalizeRequiredString(input.command.command_id, "command_id");
  const devicePublicId = normalizeRequiredString(input.command.device_id, "device_id");
  const operatorId = normalizeRequiredString(input.command.operator_id, "operator_id");
  const cashShiftId = normalizeRequiredString(input.command.cash_shift_id, "cash_shift_id");
  const payload = input.command.payload;

  if (!payload || typeof payload !== "object") {
    throw new RetailPosRuntimeError(400, "payload is required.");
  }

  if (devicePublicId !== actor.devicePublicId) {
    throw new RetailPosRuntimeError(
      409,
      "command device_id does not match authenticated retail_pos device.",
    );
  }

  if (!Array.isArray(payload.discount_intents) || payload.discount_intents.length === 0) {
    throw new RetailPosRuntimeError(409, "DISCOUNT_REQUIRED");
  }

  assertValidRetailPosDiscountIntentDrafts(payload.discount_intents);
  await assertPosUser({
    tenantId: actor.tenantId,
    posUserId: operatorId,
    trace: input.trace,
  });

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
    cashShiftId,
    trace: input.trace,
  });

  if (cashShift.device_id !== actor.deviceRecordId || cashShift.status !== "open") {
    throw new RetailPosRuntimeError(409, "CASH_SHIFT_NOT_OPEN");
  }

  const orderId = normalizeRequiredString(payload.order_id, "payload.order_id");
  const order = await loadOrderForDiscountCheckout({
    tenantId: actor.tenantId,
    orderId,
    trace: input.trace,
  });

  if (order.status === "paid") {
    throw new RetailPosRuntimeError(409, "ORDER_ALREADY_PAID");
  }

  if (order.status !== "pending_payment") {
    throw new RetailPosRuntimeError(409, "ORDER_NOT_PENDING");
  }

  const expectedRevision = ensureNonNegativeInteger(
    payload.expected_revision,
    "payload.expected_revision",
  );
  if ((order.revision ?? 0) !== expectedRevision) {
    throw new RetailPosRuntimeError(409, "ORDER_REVISION_CONFLICT", "ORDER_REVISION_CONFLICT", {
      current_revision: order.revision ?? 0,
      expected_revision: expectedRevision,
    });
  }

  const lines = await loadOrderLinesForDiscountCheckout({
    tenantId: actor.tenantId,
    orderId,
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
  const summary = buildSharedRetailPosDiscountCalculationSummary({
    orderId,
    expectedRevision,
    lines: calculationLines,
    intents: payload.discount_intents,
  });

  const paymentAmountCents = ensureNonNegativeInteger(
    payload.payment_amount_cents,
    "payload.payment_amount_cents",
  );
  if (paymentAmountCents !== summary.total_cents) {
    throw new RetailPosRuntimeError(409, "PAYMENT_AMOUNT_MISMATCH");
  }

  let cashReceivedCents: number | null = payload.cash_received_cents;
  if (payload.payment_method === "cash") {
    cashReceivedCents = ensureNonNegativeInteger(
      payload.cash_received_cents,
      "payload.cash_received_cents",
    );
    if (cashReceivedCents < paymentAmountCents) {
      throw new RetailPosRuntimeError(409, "INSUFFICIENT_CASH_RECEIVED");
    }
  } else if (payload.payment_method === "card") {
    cashReceivedCents = null;
  } else {
    throw new RetailPosRuntimeError(400, "payment_method must be cash or card.");
  }

  const belowCostLineIds = summary.lines
    .filter((line) => line.below_cost_after_discount)
    .map((line) => line.order_line_id);

  const calculationFingerprint = buildSharedRetailPosDiscountCalculationFingerprint(
    buildRetailPosDiscountCalculationFingerprintPayload({
      tenantId: actor.tenantId,
      orderId,
      expectedRevision,
      lines: calculationLines,
      intents: payload.discount_intents,
      summary,
    }),
  );

  if (belowCostLineIds.length > 0) {
    if (!payload.below_cost_acknowledgement?.accepted) {
      throw new RetailPosRuntimeError(
        409,
        "BELOW_COST_ACKNOWLEDGEMENT_REQUIRED",
        "BELOW_COST_ACKNOWLEDGEMENT_REQUIRED",
        {
          calculation_fingerprint: calculationFingerprint,
          below_cost_line_ids: belowCostLineIds,
        },
      );
    }

    if (
      payload.below_cost_acknowledgement.calculation_fingerprint &&
      payload.below_cost_acknowledgement.calculation_fingerprint !== calculationFingerprint
    ) {
      throw new RetailPosRuntimeError(
        409,
        "CALCULATION_FINGERPRINT_MISMATCH",
        "CALCULATION_FINGERPRINT_MISMATCH",
        {
          current_fingerprint: calculationFingerprint,
          provided_fingerprint:
            payload.below_cost_acknowledgement.calculation_fingerprint,
        },
      );
    }
  }

  const sanitizedSummary = redactSharedRetailPosDiscountCalculationSummary(
    summary,
    settings.can_view_cost,
  );

  const rpcPayload = {
    command_id: commandId,
    order_id: orderId,
    cash_shift_id: cashShiftId,
    operator_id: operatorId,
    expected_revision: expectedRevision,
    payment_method: payload.payment_method,
    payment_amount_cents: paymentAmountCents,
    cash_received_cents: cashReceivedCents,
    external_payment_reference: payload.external_payment_reference ?? null,
    discount_intents: sortRetailPosDiscountIntentDrafts(payload.discount_intents),
    summary,
    response_summary: sanitizedSummary,
    calculation_fingerprint: calculationFingerprint,
    below_cost_acknowledgement: payload.below_cost_acknowledgement ?? null,
    below_cost_line_ids: belowCostLineIds,
  };

  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await supabase.rpc(
    "retail_pos_checkout_order_with_discounts_v1",
    {
      p_tenant_id: actor.tenantId,
      p_device_id: actor.deviceRecordId,
      p_payload: rpcPayload,
    },
  );

  if (error) {
    throw mapDiscountCheckoutRpcError(error);
  }

  if (!data || typeof data !== "object") {
    throw new RetailPosRuntimeError(500, "CHECKOUT_TRANSACTION_FAILED");
  }

  return data as DiscountCheckoutRpcResult;
}
