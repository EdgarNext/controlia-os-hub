import { createHash } from "node:crypto";
import type {
  RetailPosCapability,
  RetailPosOrder,
  RetailPosOrderLine,
  RetailPosPayment,
  RetailPosPostSaleCashMovementType,
  RetailPosPostSaleCancellationCommitRequest,
  RetailPosPostSaleCancellationCommitResponse,
  RetailPosPostSaleCancellationPreviewRequest,
  RetailPosPostSaleCancellationPreviewResponse,
  RetailPosPostSaleDetailResponse,
  RetailPosPostSaleDocument,
  RetailPosPostSaleLine,
  RetailPosPostSaleReturnAccumulatedLine,
  RetailPosPostSaleReturnCommitRequest,
  RetailPosPostSaleReturnCommitResponse,
  RetailPosPostSaleReturnPreviewLine,
  RetailPosPostSaleReturnPreviewRequest,
  RetailPosPostSaleReturnPreviewResponse,
  RetailPosPostSaleReturnSelectionLine,
  RetailPosPostSaleReturnState,
  RetailPosPostSaleReturnTotals,
  RetailPosPostSaleReasonCode,
  RetailPosPostSaleRefund,
  RetailPosPostSaleCardRefundConfirmRequest,
  RetailPosPostSaleCardRefundConfirmResponse,
  RetailPosCashMovement,
  RetailPosDeviceRole,
  RetailPosQuantityString,
} from "@/shared/types/retail-pos";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertRetailPosDeviceRole,
  resolveRetailPosRuntimeActor,
} from "./auth";
import { RetailPosRuntimeError } from "./errors";
import { normalizeRetailPosQuantity } from "./quantity";
import type { RuntimePerfTrace } from "./runtime-perf";
import { runSupabaseReadWithRetry } from "./runtime-supabase-retry";

type DeviceSettingsRow = {
  device_id: string;
  tenant_id: string;
  device_role: RetailPosDeviceRole;
  can_view_cost: boolean;
  is_active: boolean;
};

type OrderRow = RetailPosOrder & { revision?: number | null };
type PaymentRow = RetailPosPayment;
type OrderLineRow = RetailPosOrderLine & {
  direct_discount_cents?: number | null;
  order_discount_allocation_cents?: number | null;
};
type PostSaleDocumentRow = RetailPosPostSaleDocument;
type PostSaleLineRow = RetailPosPostSaleLine;
type PostSaleRefundRow = RetailPosPostSaleRefund;
type CashMovementRow = RetailPosCashMovement;

type ReturnCommitRpcPayload = {
  document_id: string;
  refund_id: string;
  cash_movement_id: string | null;
  replayed: boolean;
};

type SaleCancellationCommitRpcPayload = {
  document_id: string;
  refund_id: string;
  cash_movement_id: string | null;
  replayed: boolean;
  gross_amount_cents: number;
  discount_amount_cents: number;
  net_amount_cents: number;
};

type CardRefundConfirmRpcPayload = {
  document_id: string;
  refund_id: string;
  replayed: boolean;
};

type SaleCancellationCommitRpcResponse = {
  command_id: string;
  command_type: "post_sale.sale_cancellation.commit";
  status: "completed" | "replayed";
  idempotent_replay: boolean;
  result: SaleCancellationCommitRpcPayload;
  server_time: string;
};

type ReturnCommitRpcResponse = {
  command_id: string;
  command_type: "post_sale.return.commit";
  status: "completed" | "replayed";
  idempotent_replay: boolean;
  result: ReturnCommitRpcPayload;
  server_time: string;
};

type CardRefundConfirmRpcResponse = {
  command_id: string;
  command_type: "post_sale.card_refund.confirm";
  status: "completed" | "replayed";
  idempotent_replay: boolean;
  result: CardRefundConfirmRpcPayload;
  server_time: string;
};

const ORDER_SELECT =
  "id, tenant_id, folio, origin_client_order_id, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, total_cents, revision, direct_discount_cents, order_discount_cents, paid_at, voided_at, voided_by_pos_user_id, void_reason, cancelled_at, cancelled_by_pos_user_id, cancel_reason, created_at, updated_at, created_by, updated_by";
const ORDER_LINE_SELECT =
  "id, tenant_id, order_id, line_number, product_id, product_variant_id, product_name, variant_name, sku, barcode, sales_unit_code, sales_unit_label, allow_decimal_quantity, quantity, unit_price_cents, line_subtotal_cents, discount_cents, line_total_cents, direct_discount_cents, order_discount_allocation_cents, total_discount_cents, unit_cost_snapshot_cents, cost_evaluation, below_cost_after_discount, created_at, updated_at, created_by, updated_by";
const PAYMENT_SELECT =
  "id, tenant_id, order_id, cash_shift_id, device_id, pos_user_id, payment_method, amount_cents, received_amount_cents, change_cents, card_reference, paid_at, created_at, created_by";
const DEVICE_SETTINGS_SELECT =
  "device_id, tenant_id, device_role, can_view_cost, is_active";
const POST_SALE_DOCUMENT_SELECT =
  "id, tenant_id, original_order_id, original_payment_id, document_type, status, refund_status, refund_method, currency_code, gross_amount_cents, discount_amount_cents, net_amount_cents, eligible_paid_amount_cents, refund_amount_cents, reason_code, comment, created_by_pos_user_id, created_by_device_id, cash_shift_id, confirmed_by_pos_user_id, confirmed_at, origin_command_id, revision, created_at, updated_at";
const POST_SALE_LINE_SELECT =
  "id, tenant_id, post_sale_document_id, original_order_line_id, line_number, quantity_sold, quantity_previously_returned, quantity_returned_now, line_subtotal_cents_historical, direct_discount_cents_historical, order_discount_allocated_cents_historical, line_net_cents_historical, returned_gross_amount_cents, returned_direct_discount_cents, returned_order_discount_cents, returned_total_discount_cents, returned_net_amount_cents, created_at";
const POST_SALE_REFUND_SELECT =
  "id, tenant_id, post_sale_document_id, refund_method, status, amount_cents, currency_code, cash_shift_id, external_reference, processed_by_pos_user_id, processed_by_device_id, processed_at, origin_command_id, created_at, updated_at";
const CASH_MOVEMENT_SELECT =
  "id, tenant_id, cash_shift_id, post_sale_document_id, post_sale_refund_id, movement_type, amount_cents, note, created_by_pos_user_id, created_by_device_id, occurred_at, origin_command_id, created_at";

const SALE_CANCELLATION_RPC_SAFE_MESSAGES = new Set([
  "POST_SALE_CAPABILITY_REQUIRED",
  "SALE_CANCELLATION_CAPABILITY_REQUIRED",
  "POST_SALE_REFUND_CAPABILITY_REQUIRED",
  "CASHIER_STATION_REQUIRED",
  "ORDER_NOT_FOUND",
  "ORDER_NOT_PAID",
  "PAYMENT_NOT_FOUND",
  "SALE_ALREADY_CANCELLED",
  "POST_SALE_CONFLICT",
  "SALE_CANCELLATION_CONFLICT",
  "POST_SALE_CANCELLATION_INVALID",
  "SALE_CANCELLATION_FAILED",
  "CASH_SHIFT_NOT_OPEN",
  "COMMAND_PAYLOAD_MISMATCH",
  "COMMAND_IN_PROGRESS",
  "UNSAFE_MONEY_VALUE",
]);

const CARD_REFUND_RPC_SAFE_MESSAGES = new Set([
  "POST_SALE_REFUND_CAPABILITY_REQUIRED",
  "CASHIER_STATION_REQUIRED",
  "POST_SALE_DOCUMENT_NOT_FOUND",
  "POST_SALE_REFUND_NOT_FOUND",
  "POST_SALE_REFUND_ALREADY_COMPLETED",
  "POST_SALE_REFUND_REFERENCE_REQUIRED",
  "POST_SALE_REFUND_INVALID",
  "COMMAND_PAYLOAD_MISMATCH",
  "COMMAND_IN_PROGRESS",
]);

const RETURN_RPC_SAFE_MESSAGES = new Set([
  "RETURN_CAPABILITY_REQUIRED",
  "POST_SALE_REFUND_CAPABILITY_REQUIRED",
  "CASHIER_STATION_REQUIRED",
  "ORDER_NOT_FOUND",
  "ORDER_NOT_PAID",
  "PAYMENT_NOT_FOUND",
  "SALE_ALREADY_CANCELLED",
  "SALE_ALREADY_VOIDED",
  "NO_RETURNABLE_QUANTITY",
  "ORDER_LINE_NOT_FOUND",
  "RETURN_QUANTITY_INVALID",
  "RETURN_QUANTITY_EXCEEDED",
  "RETURN_CONFLICT",
  "CASH_SHIFT_NOT_OPEN",
  "COMMAND_PAYLOAD_MISMATCH",
  "COMMAND_IN_PROGRESS",
  "UNSAFE_MONEY_VALUE",
  "POST_SALE_RETURN_FAILED",
]);

function normalizeRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new RetailPosRuntimeError(400, `${field} is required.`);
  }

  return value.trim();
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeInteger(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new RetailPosRuntimeError(400, `${field} must be a non-negative integer.`);
  }

  return value;
}

function normalizeReasonCode(value: unknown): RetailPosPostSaleReasonCode {
  const reasonCode = normalizeRequiredString(value, "reason_code") as RetailPosPostSaleReasonCode;
  switch (reasonCode) {
    case "duplicate_charge":
    case "wrong_order":
    case "wrong_payment_method":
    case "customer_cancelled_immediately":
    case "operator_error":
    case "system_error":
    case "other":
      return reasonCode;
    default:
      throw new RetailPosRuntimeError(400, "reason_code is invalid.");
  }
}

function normalizeRefundMethod(value: unknown) {
  const refundMethod = normalizeRequiredString(value, "refund_method");
  if (refundMethod !== "cash" && refundMethod !== "card_external") {
    throw new RetailPosRuntimeError(400, "refund_method must be cash or card_external.");
  }
  return refundMethod;
}

function normalizeQuantity(value: unknown, field: string): RetailPosQuantityString {
  const normalized = normalizeRetailPosQuantity(value);
  if (!normalized) {
    throw new RetailPosRuntimeError(400, `${field} must be a canonical retail_pos quantity.`);
  }

  return normalized;
}

function normalizePersistedQuantityAllowZero(
  value: unknown,
  field: string,
): RetailPosQuantityString {
  if (value === 0 || value === "0" || value === "0.0" || value === "0.00" || value === "0.000") {
    return "0.000" as RetailPosQuantityString;
  }

  return normalizeQuantity(value, field);
}

function quantityToMillis(quantity: RetailPosQuantityString): number {
  const [whole, fractional] = quantity.split(".");
  return Number.parseInt(whole, 10) * 1000 + Number.parseInt(fractional, 10);
}

function millisToQuantity(quantityMillis: number): RetailPosQuantityString {
  const whole = Math.floor(quantityMillis / 1000);
  const fractional = quantityMillis % 1000;
  return `${String(whole)}.${String(fractional).padStart(3, "0")}` as RetailPosQuantityString;
}

function prorateCents(totalCents: number, quantityMillis: number, soldMillis: number) {
  if (totalCents < 0 || soldMillis <= 0 || quantityMillis < 0 || quantityMillis > soldMillis) {
    throw new RetailPosRuntimeError(409, "RETURN_CONFLICT", "RETURN_CONFLICT");
  }

  return Math.round((totalCents * quantityMillis) / soldMillis);
}

function buildReturnFingerprint(input: {
  orderId: string;
  revision: number;
  reasonCode: RetailPosPostSaleReasonCode;
  comment: string | null;
  refundMethod?: "cash" | "card_external" | null;
  lines: Array<{ orderLineId: string; quantity: RetailPosQuantityString }>;
}) {
  const stable = JSON.stringify({
    order_id: input.orderId,
    expected_order_revision: input.revision,
    reason_code: input.reasonCode,
    comment: input.comment ?? null,
    refund_method: input.refundMethod ?? null,
    lines: [...input.lines]
      .sort((left, right) => left.orderLineId.localeCompare(right.orderLineId))
      .map((line) => ({
        order_line_id: line.orderLineId,
        quantity: line.quantity,
      })),
  });

  return createHash("sha256").update(stable).digest("hex");
}

function getPostSaleCapabilities(input: {
  deviceRole: RetailPosDeviceRole;
  settingsActive: boolean;
  canViewCost: boolean;
}): RetailPosCapability[] {
  if (input.deviceRole !== "cashier_station" || !input.settingsActive) {
    return [];
  }

  const capabilities: RetailPosCapability[] = [
    "post_sale.view",
    "post_sale.cancel_sale",
    "post_sale.return",
    "post_sale.refund",
  ];

  if (input.canViewCost) {
    capabilities.push("post_sale.view_cost");
  }

  return capabilities;
}

function assertPostSaleCapability(
  capabilities: readonly RetailPosCapability[],
  capability: RetailPosCapability,
) {
  if (!capabilities.includes(capability)) {
    const code =
      capability === "post_sale.return"
        ? "RETURN_CAPABILITY_REQUIRED"
        : capability === "post_sale.cancel_sale"
          ? "SALE_CANCELLATION_CAPABILITY_REQUIRED"
        : capability === "post_sale.refund"
          ? "POST_SALE_REFUND_CAPABILITY_REQUIRED"
          : "POST_SALE_CAPABILITY_REQUIRED";
    throw new RetailPosRuntimeError(403, code, code);
  }
}

function mapSaleCancellationRpcError(error: { message?: string } | null) {
  const message = error?.message ?? "POST_SALE_COMMIT_FAILED";

  if (SALE_CANCELLATION_RPC_SAFE_MESSAGES.has(message)) {
    const status =
      message === "ORDER_NOT_FOUND" || message === "PAYMENT_NOT_FOUND"
        ? 404
        : message === "POST_SALE_CAPABILITY_REQUIRED" ||
            message === "SALE_CANCELLATION_CAPABILITY_REQUIRED" ||
            message === "POST_SALE_REFUND_CAPABILITY_REQUIRED" ||
            message === "CASHIER_STATION_REQUIRED"
          ? 403
          : message === "POST_SALE_CANCELLATION_INVALID" ||
              message === "SALE_CANCELLATION_FAILED"
            ? 422
          : 409;
    return new RetailPosRuntimeError(status, message, message);
  }

  return new RetailPosRuntimeError(500, message);
}

function mapCardRefundRpcError(error: { message?: string } | null) {
  const message = error?.message ?? "POST_SALE_CARD_REFUND_CONFIRM_FAILED";

  if (CARD_REFUND_RPC_SAFE_MESSAGES.has(message)) {
    const status =
      message === "POST_SALE_DOCUMENT_NOT_FOUND" ||
      message === "POST_SALE_REFUND_NOT_FOUND"
        ? 404
        : message === "POST_SALE_REFUND_CAPABILITY_REQUIRED" ||
            message === "CASHIER_STATION_REQUIRED"
          ? 403
          : message === "POST_SALE_REFUND_INVALID"
            ? 422
            : 409;
    return new RetailPosRuntimeError(status, message, message);
  }

  return new RetailPosRuntimeError(500, message);
}

function mapReturnRpcError(error: { message?: string } | null) {
  const message = error?.message ?? "POST_SALE_RETURN_FAILED";

  if (RETURN_RPC_SAFE_MESSAGES.has(message)) {
    const status =
      message === "ORDER_NOT_FOUND" || message === "PAYMENT_NOT_FOUND" || message === "ORDER_LINE_NOT_FOUND"
        ? 404
        : message === "RETURN_CAPABILITY_REQUIRED" ||
            message === "POST_SALE_REFUND_CAPABILITY_REQUIRED" ||
            message === "CASHIER_STATION_REQUIRED"
          ? 403
          : message === "RETURN_QUANTITY_INVALID"
            ? 422
            : 409;
    return new RetailPosRuntimeError(status, message, message);
  }

  return new RetailPosRuntimeError(500, message);
}

async function loadDeviceSettings(input: {
  tenantId: string;
  deviceRecordId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<DeviceSettingsRow>({
    trace: input.trace,
    step: "post_sale_device_settings",
    query: (signal) =>
      supabase
        .from("retail_pos_device_settings")
        .select(DEVICE_SETTINGS_SELECT)
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
    throw new RetailPosRuntimeError(403, "CASHIER_STATION_REQUIRED", "CASHIER_STATION_REQUIRED");
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
    step: "post_sale_order",
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
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos order: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(404, "ORDER_NOT_FOUND", "ORDER_NOT_FOUND");
  }

  return data;
}

async function loadPaymentByOrder(input: {
  tenantId: string;
  orderId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<PaymentRow>({
    trace: input.trace,
    step: "post_sale_payment",
    query: (signal) =>
      supabase
        .from("retail_pos_payments")
        .select(PAYMENT_SELECT)
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("order_id", input.orderId)
        .limit(1)
        .maybeSingle<PaymentRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos payment: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(404, "PAYMENT_NOT_FOUND", "PAYMENT_NOT_FOUND");
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
    step: "post_sale_lines",
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

async function loadSaleCancellationDocumentByOrder(input: {
  tenantId: string;
  orderId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<PostSaleDocumentRow>({
    trace: input.trace,
    step: "post_sale_existing_sale_cancellation",
    query: (signal) =>
      supabase
        .from("retail_pos_post_sale_documents")
        .select(POST_SALE_DOCUMENT_SELECT)
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("original_order_id", input.orderId)
        .eq("document_type", "sale_cancellation")
        .in("status", ["pending_confirmation", "completed"])
        .limit(1)
        .maybeSingle<PostSaleDocumentRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos post sale documents: ${error.message}`,
    );
  }

  return data ?? null;
}

type CompletedReturnLineRow = PostSaleLineRow & {
  document_type: "return_full" | "return_partial";
  document_status: "completed";
  document_created_at: string;
};

async function loadCompletedReturnLinesByOrder(input: {
  tenantId: string;
  orderId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data: documents, error: documentsError } = await supabase
    .from("retail_pos_post_sale_documents")
    .select("id, document_type, status, created_at, original_order_id")
    .eq("tenant_id", input.tenantId)
    .eq("original_order_id", input.orderId)
    .in("document_type", ["return_full", "return_partial"])
    .eq("status", "completed")
    .returns<
      Array<{
        id: string;
        document_type: "return_full" | "return_partial";
        status: "completed";
        created_at: string;
        original_order_id: string;
      }>
    >();

  if (documentsError) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos completed return lines: ${documentsError.message}`,
    );
  }

  if (!documents?.length) {
    return [] as CompletedReturnLineRow[];
  }

  const documentById = new Map(
    documents.map((document) => [document.id, document] as const),
  );

  const { data: lines, error: linesError } = await supabase
    .from("retail_pos_post_sale_lines")
    .select(POST_SALE_LINE_SELECT)
    .eq("tenant_id", input.tenantId)
    .in("post_sale_document_id", documents.map((document) => document.id))
    .returns<PostSaleLineRow[]>();

  if (linesError) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos completed return lines: ${linesError.message}`,
    );
  }

  return (lines ?? [])
    .map((row) => {
      const document = documentById.get(row.post_sale_document_id);
      if (!document) {
        return null;
      }

      return {
        ...row,
        document_type: document.document_type,
        document_status: document.status,
        document_created_at: document.created_at,
      } satisfies CompletedReturnLineRow;
    })
    .filter((row): row is CompletedReturnLineRow => row !== null)
    .map((row) => ({
    ...row,
    document_type: row.document_type,
    document_status: row.document_status,
    document_created_at: row.document_created_at,
  }));
}

async function loadPostSaleDocumentById(input: {
  tenantId: string;
  documentId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<PostSaleDocumentRow>({
    trace: input.trace,
    step: "post_sale_document",
    query: (signal) =>
      supabase
        .from("retail_pos_post_sale_documents")
        .select(POST_SALE_DOCUMENT_SELECT)
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.documentId)
        .limit(1)
        .maybeSingle<PostSaleDocumentRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos post sale document: ${error.message}`,
    );
  }

  if (!data) {
    throw new RetailPosRuntimeError(
      404,
      "POST_SALE_DOCUMENT_NOT_FOUND",
      "POST_SALE_DOCUMENT_NOT_FOUND",
    );
  }

  return data;
}

async function loadPostSaleLines(input: {
  tenantId: string;
  documentId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<PostSaleLineRow[]>({
    trace: input.trace,
    step: "post_sale_document_lines",
    query: (signal) =>
      supabase
        .from("retail_pos_post_sale_lines")
        .select(POST_SALE_LINE_SELECT)
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("post_sale_document_id", input.documentId)
        .order("line_number", { ascending: true })
        .returns<PostSaleLineRow[]>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos post sale lines: ${error.message}`,
    );
  }

  return (data ?? []).map((row) => ({
    ...row,
    quantity_sold: normalizeQuantity(
      row.quantity_sold,
      "retail_pos_post_sale_lines.quantity_sold",
    ),
    quantity_previously_returned: normalizePersistedQuantityAllowZero(
      row.quantity_previously_returned,
      "retail_pos_post_sale_lines.quantity_previously_returned",
    ),
    quantity_returned_now: normalizeQuantity(
      row.quantity_returned_now,
      "retail_pos_post_sale_lines.quantity_returned_now",
    ),
  }));
}

async function loadPostSaleRefundByDocument(input: {
  tenantId: string;
  documentId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<PostSaleRefundRow>({
    trace: input.trace,
    step: "post_sale_document_refund",
    query: (signal) =>
      supabase
        .from("retail_pos_post_sale_refunds")
        .select(POST_SALE_REFUND_SELECT)
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("post_sale_document_id", input.documentId)
        .limit(1)
        .maybeSingle<PostSaleRefundRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos post sale refund: ${error.message}`,
    );
  }

  return data ?? null;
}

async function loadPostSaleRefundById(input: {
  tenantId: string;
  refundId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<PostSaleRefundRow>({
    trace: input.trace,
    step: "post_sale_refund_by_id",
    query: (signal) =>
      supabase
        .from("retail_pos_post_sale_refunds")
        .select(POST_SALE_REFUND_SELECT)
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.refundId)
        .limit(1)
        .maybeSingle<PostSaleRefundRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos post sale refund: ${error.message}`,
    );
  }

  if (!data) {
    throw new RetailPosRuntimeError(
      404,
      "POST_SALE_REFUND_NOT_FOUND",
      "POST_SALE_REFUND_NOT_FOUND",
    );
  }

  return data;
}

async function loadCashMovementById(input: {
  tenantId: string;
  movementId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<CashMovementRow>({
    trace: input.trace,
    step: "post_sale_cash_movement",
    query: (signal) =>
      supabase
        .from("retail_pos_cash_movements")
        .select(CASH_MOVEMENT_SELECT)
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.movementId)
        .limit(1)
        .maybeSingle<CashMovementRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos cash movement: ${error.message}`,
    );
  }

  if (!data) {
    throw new RetailPosRuntimeError(
      404,
      "POST_SALE_CONFLICT",
      "POST_SALE_CONFLICT",
    );
  }

  return data;
}

async function resolvePostSaleActor(input: {
  tenantSlug: string;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}) {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
    trace: input.trace,
  });

  if (actor.mode !== "device" || !actor.deviceRecordId || !actor.devicePublicId) {
    throw new RetailPosRuntimeError(401, "device auth is required for retail_pos post sale.");
  }

  assertRetailPosDeviceRole(actor, ["cashier_station"]);

  const settings = await loadDeviceSettings({
    tenantId: actor.tenantId,
    deviceRecordId: actor.deviceRecordId,
    trace: input.trace,
  });
  const capabilities = getPostSaleCapabilities({
    deviceRole: settings.device_role,
    settingsActive: settings.is_active,
    canViewCost: settings.can_view_cost,
  });

  return { actor, settings, capabilities };
}

type ReturnLineComputation = {
  original_order_line_id: string;
  line_number: number;
  product_name: string;
  variant_name: string | null;
  quantity_sold: RetailPosQuantityString;
  quantity_previously_returned: RetailPosQuantityString;
  quantity_available: RetailPosQuantityString;
  quantity_selected: RetailPosQuantityString;
  line_subtotal_cents_historical: number;
  direct_discount_cents_historical: number;
  order_discount_allocated_cents_historical: number;
  line_net_cents_historical: number;
  gross_available_cents: number;
  direct_discount_available_cents: number;
  order_discount_available_cents: number;
  total_discount_available_cents: number;
  net_available_cents: number;
  gross_selected_cents: number;
  direct_discount_selected_cents: number;
  order_discount_selected_cents: number;
  total_discount_selected_cents: number;
  net_selected_cents: number;
  selected_millis: number;
  available_millis: number;
  previously_returned_millis: number;
  sold_millis: number;
};

function computeReturnLineState(input: {
  orderLine: OrderLineRow;
  previouslyReturnedMillis: number;
  selectedMillis: number;
}): ReturnLineComputation {
  const soldQuantity = normalizeQuantity(
    input.orderLine.quantity,
    "retail_pos_order_lines.quantity",
  );
  const soldMillis = quantityToMillis(soldQuantity);

  if (input.previouslyReturnedMillis < 0 || input.previouslyReturnedMillis > soldMillis) {
    throw new RetailPosRuntimeError(409, "RETURN_CONFLICT", "RETURN_CONFLICT");
  }

  if (input.selectedMillis < 0) {
    throw new RetailPosRuntimeError(422, "RETURN_QUANTITY_INVALID", "RETURN_QUANTITY_INVALID");
  }

  const availableMillis = soldMillis - input.previouslyReturnedMillis;
  if (input.selectedMillis > availableMillis) {
    throw new RetailPosRuntimeError(409, "RETURN_QUANTITY_EXCEEDED", "RETURN_QUANTITY_EXCEEDED");
  }

  const grossHistorical = input.orderLine.line_subtotal_cents;
  const directHistorical = input.orderLine.direct_discount_cents ?? 0;
  const orderHistorical = input.orderLine.order_discount_allocation_cents ?? 0;
  const totalDiscountHistorical = input.orderLine.total_discount_cents ?? directHistorical + orderHistorical;
  const netHistorical = input.orderLine.line_total_cents;

  const grossPreviously = prorateCents(grossHistorical, input.previouslyReturnedMillis, soldMillis);
  const directPreviously = prorateCents(directHistorical, input.previouslyReturnedMillis, soldMillis);
  const orderPreviously = prorateCents(orderHistorical, input.previouslyReturnedMillis, soldMillis);
  const totalPreviously = prorateCents(totalDiscountHistorical, input.previouslyReturnedMillis, soldMillis);
  const netPreviously = prorateCents(netHistorical, input.previouslyReturnedMillis, soldMillis);

  const cumulativeMillis = input.previouslyReturnedMillis + input.selectedMillis;
  const grossCumulative = prorateCents(grossHistorical, cumulativeMillis, soldMillis);
  const directCumulative = prorateCents(directHistorical, cumulativeMillis, soldMillis);
  const orderCumulative = prorateCents(orderHistorical, cumulativeMillis, soldMillis);
  const totalCumulative = prorateCents(totalDiscountHistorical, cumulativeMillis, soldMillis);
  const netCumulative = prorateCents(netHistorical, cumulativeMillis, soldMillis);

  const grossSelected = grossCumulative - grossPreviously;
  const directSelected = directCumulative - directPreviously;
  const orderSelected = orderCumulative - orderPreviously;
  const totalSelected = totalCumulative - totalPreviously;
  const netSelected = netCumulative - netPreviously;

  const grossAvailable = grossHistorical - grossPreviously;
  const directAvailable = directHistorical - directPreviously;
  const orderAvailable = orderHistorical - orderPreviously;
  const totalAvailable = totalDiscountHistorical - totalPreviously;
  const netAvailable = netHistorical - netPreviously;

  return {
    original_order_line_id: input.orderLine.id,
    line_number: input.orderLine.line_number,
    product_name: input.orderLine.product_name,
    variant_name: input.orderLine.variant_name ?? null,
    quantity_sold: soldQuantity,
    quantity_previously_returned: millisToQuantity(input.previouslyReturnedMillis),
    quantity_available: millisToQuantity(availableMillis),
    quantity_selected: millisToQuantity(input.selectedMillis),
    line_subtotal_cents_historical: grossHistorical,
    direct_discount_cents_historical: directHistorical,
    order_discount_allocated_cents_historical: orderHistorical,
    line_net_cents_historical: netHistorical,
    gross_available_cents: grossAvailable,
    direct_discount_available_cents: directAvailable,
    order_discount_available_cents: orderAvailable,
    total_discount_available_cents: totalAvailable,
    net_available_cents: netAvailable,
    gross_selected_cents: grossSelected,
    direct_discount_selected_cents: directSelected,
    order_discount_selected_cents: orderSelected,
    total_discount_selected_cents: totalSelected,
    net_selected_cents: netSelected,
    selected_millis: input.selectedMillis,
    available_millis: availableMillis,
    previously_returned_millis: input.previouslyReturnedMillis,
    sold_millis: soldMillis,
  };
}

function buildReturnAccumulatedState(input: {
  orderLines: OrderLineRow[];
  completedReturnLines: CompletedReturnLineRow[];
}) {
  const returnedByLineId = new Map<
    string,
    {
      quantityMillis: number;
      grossReturnedCents: number;
      directDiscountReturnedCents: number;
      orderDiscountReturnedCents: number;
      totalDiscountReturnedCents: number;
      netReturnedCents: number;
    }
  >();

  for (const line of input.completedReturnLines) {
    const current = returnedByLineId.get(line.original_order_line_id) ?? {
      quantityMillis: 0,
      grossReturnedCents: 0,
      directDiscountReturnedCents: 0,
      orderDiscountReturnedCents: 0,
      totalDiscountReturnedCents: 0,
      netReturnedCents: 0,
    };
    current.quantityMillis += quantityToMillis(
      normalizeQuantity(
        line.quantity_returned_now,
        "retail_pos_post_sale_lines.quantity_returned_now",
      ),
    );
    current.grossReturnedCents += line.returned_gross_amount_cents;
    current.directDiscountReturnedCents += line.returned_direct_discount_cents;
    current.orderDiscountReturnedCents += line.returned_order_discount_cents;
    current.totalDiscountReturnedCents += line.returned_total_discount_cents;
    current.netReturnedCents += line.returned_net_amount_cents;
    returnedByLineId.set(line.original_order_line_id, current);
  }

  const accumulatedLines: RetailPosPostSaleReturnAccumulatedLine[] = input.orderLines.map((line) => {
    const soldQuantity = normalizeQuantity(line.quantity, "retail_pos_order_lines.quantity");
    const soldMillis = quantityToMillis(soldQuantity);
    const returned = returnedByLineId.get(line.id) ?? {
      quantityMillis: 0,
      netReturnedCents: 0,
    };
    const remainingMillis = soldMillis - returned.quantityMillis;
    const remainingNetCents = line.line_total_cents - returned.netReturnedCents;

    return {
      original_order_line_id: line.id,
      line_number: line.line_number,
      quantity_sold: soldQuantity,
      quantity_returned: millisToQuantity(returned.quantityMillis),
      quantity_remaining: millisToQuantity(remainingMillis),
      net_cents_sold: line.line_total_cents,
      net_cents_returned: returned.netReturnedCents,
      net_cents_remaining: remainingNetCents,
    };
  });

  const totalSoldMillis = accumulatedLines.reduce(
    (sum, line) => sum + quantityToMillis(line.quantity_sold),
    0,
  );
  const totalReturnedMillis = accumulatedLines.reduce(
    (sum, line) => sum + quantityToMillis(line.quantity_returned),
    0,
  );

  const returnState: RetailPosPostSaleReturnState =
    totalReturnedMillis === 0
      ? "not_returned"
      : totalReturnedMillis === totalSoldMillis
        ? "fully_returned"
        : "partially_returned";

  return {
    accumulatedLines,
    returnState,
    returnedByLineId,
  };
}

function buildReturnPreview(input: {
  order: OrderRow;
  payment: PaymentRow;
  orderLines: OrderLineRow[];
  completedReturnLines: CompletedReturnLineRow[];
  existingSaleCancellation: PostSaleDocumentRow | null;
  selectionLines: RetailPosPostSaleReturnSelectionLine[];
  reasonCode: RetailPosPostSaleReasonCode;
  comment: string | null;
  refundMethod: "cash" | "card_external";
}): RetailPosPostSaleReturnPreviewResponse {
  const accumulated = buildReturnAccumulatedState({
    orderLines: input.orderLines,
    completedReturnLines: input.completedReturnLines,
  });
  const selectionByLineId = new Map<string, number>();

  for (const line of input.selectionLines) {
    const orderLineId = normalizeRequiredString(line.order_line_id, "order_line_id");
    const quantity = normalizeQuantity(line.quantity, "quantity");
    const quantityMillis = quantityToMillis(quantity);
    if (quantityMillis <= 0) {
      throw new RetailPosRuntimeError(422, "RETURN_QUANTITY_INVALID", "RETURN_QUANTITY_INVALID");
    }
    selectionByLineId.set(orderLineId, (selectionByLineId.get(orderLineId) ?? 0) + quantityMillis);
  }

  const previewLines: RetailPosPostSaleReturnPreviewLine[] = [];
  const computedLines: ReturnLineComputation[] = [];

  for (const orderLine of input.orderLines) {
    const accumulatedLine = accumulated.accumulatedLines.find(
      (line) => line.original_order_line_id === orderLine.id,
    );
    const previouslyReturnedMillis = accumulatedLine
      ? quantityToMillis(accumulatedLine.quantity_returned)
      : 0;
    const selectedMillis = selectionByLineId.get(orderLine.id) ?? 0;
    const computed = computeReturnLineState({
      orderLine,
      previouslyReturnedMillis,
      selectedMillis,
    });
    computedLines.push(computed);
    previewLines.push({
      original_order_line_id: computed.original_order_line_id,
      line_number: computed.line_number,
      product_name: computed.product_name,
      variant_name: computed.variant_name,
      quantity_sold: computed.quantity_sold,
      quantity_previously_returned: computed.quantity_previously_returned,
      quantity_available: computed.quantity_available,
      quantity_selected: computed.quantity_selected,
      line_subtotal_cents_historical: computed.line_subtotal_cents_historical,
      direct_discount_cents_historical: computed.direct_discount_cents_historical,
      order_discount_allocated_cents_historical: computed.order_discount_allocated_cents_historical,
      line_net_cents_historical: computed.line_net_cents_historical,
      gross_available_cents: computed.gross_available_cents,
      direct_discount_available_cents: computed.direct_discount_available_cents,
      order_discount_available_cents: computed.order_discount_available_cents,
      total_discount_available_cents: computed.total_discount_available_cents,
      net_available_cents: computed.net_available_cents,
      gross_selected_cents: computed.gross_selected_cents,
      direct_discount_selected_cents: computed.direct_discount_selected_cents,
      order_discount_selected_cents: computed.order_discount_selected_cents,
      total_discount_selected_cents: computed.total_discount_selected_cents,
      net_selected_cents: computed.net_selected_cents,
    });
  }

  const matchedSelectedLines = computedLines.filter((line) => line.selected_millis > 0).length;
  if (matchedSelectedLines !== selectionByLineId.size) {
    throw new RetailPosRuntimeError(404, "ORDER_LINE_NOT_FOUND", "ORDER_LINE_NOT_FOUND");
  }

  const totals: RetailPosPostSaleReturnTotals = {
    gross_previously_returned_cents: [...accumulated.returnedByLineId.values()].reduce(
      (sum, line) => sum + line.grossReturnedCents,
      0,
    ),
    direct_discount_previously_returned_cents: [...accumulated.returnedByLineId.values()].reduce(
      (sum, line) => sum + line.directDiscountReturnedCents,
      0,
    ),
    order_discount_previously_returned_cents: [...accumulated.returnedByLineId.values()].reduce(
      (sum, line) => sum + line.orderDiscountReturnedCents,
      0,
    ),
    total_discount_previously_returned_cents: [...accumulated.returnedByLineId.values()].reduce(
      (sum, line) => sum + line.totalDiscountReturnedCents,
      0,
    ),
    net_previously_returned_cents: accumulated.accumulatedLines.reduce(
      (sum, line) => sum + line.net_cents_returned,
      0,
    ),
    gross_available_cents: input.orderLines.reduce((sum, line) => sum + line.line_subtotal_cents, 0),
    direct_discount_available_cents: input.orderLines.reduce(
      (sum, line) => sum + (line.direct_discount_cents ?? 0),
      0,
    ),
    order_discount_available_cents: input.orderLines.reduce(
      (sum, line) => sum + (line.order_discount_allocation_cents ?? 0),
      0,
    ),
    total_discount_available_cents: input.orderLines.reduce(
      (sum, line) => sum + (line.total_discount_cents ?? (line.direct_discount_cents ?? 0) + (line.order_discount_allocation_cents ?? 0)),
      0,
    ),
    net_available_cents: accumulated.accumulatedLines.reduce(
      (sum, line) => sum + line.net_cents_remaining,
      0,
    ),
    gross_selected_cents: previewLines.reduce((sum, line) => sum + line.gross_selected_cents, 0),
    direct_discount_selected_cents: previewLines.reduce(
      (sum, line) => sum + line.direct_discount_selected_cents,
      0,
    ),
    order_discount_selected_cents: previewLines.reduce(
      (sum, line) => sum + line.order_discount_selected_cents,
      0,
    ),
    total_discount_selected_cents: previewLines.reduce(
      (sum, line) => sum + line.total_discount_selected_cents,
      0,
    ),
    net_selected_cents: previewLines.reduce((sum, line) => sum + line.net_selected_cents, 0),
  };

  totals.gross_available_cents -= totals.gross_previously_returned_cents;
  totals.direct_discount_available_cents -= totals.direct_discount_previously_returned_cents;
  totals.order_discount_available_cents -= totals.order_discount_previously_returned_cents;
  totals.total_discount_available_cents -= totals.total_discount_previously_returned_cents;

  const selectedTotalMillis = computedLines.reduce((sum, line) => sum + line.selected_millis, 0);
  const remainingAfterSelectionMillis = accumulated.accumulatedLines.reduce(
    (sum, line) => sum + quantityToMillis(line.quantity_remaining),
    0,
  ) - selectedTotalMillis;

  const suggestedDocumentType =
    accumulated.returnState === "not_returned" &&
    remainingAfterSelectionMillis === 0
      ? "return_full"
      : "return_partial";

  const warnings =
    input.reasonCode === "other" && !input.comment
      ? [
          {
            code: "OTHER_REASON_COMMENT_RECOMMENDED",
            message: "Comment is recommended when reason_code=other.",
          },
        ]
      : [];

  return {
    original_order: input.order,
    original_payment: input.payment,
    lines: previewLines,
    totals,
    expected_order_revision: input.order.revision ?? 0,
    fingerprint: buildReturnFingerprint({
      orderId: input.order.id,
      revision: input.order.revision ?? 0,
      reasonCode: input.reasonCode,
      comment: input.comment,
      refundMethod: input.refundMethod,
      lines: computedLines
        .filter((line) => line.selected_millis > 0)
        .map((line) => ({
          orderLineId: line.original_order_line_id,
          quantity: line.quantity_selected,
        })),
    }),
    suggested_document_type: suggestedDocumentType,
    allowed_refund_methods: ["cash", "card_external"],
    existing_post_sale: {
      has_any_post_sale:
        accumulated.returnState !== "not_returned" ||
        input.existingSaleCancellation !== null,
      active_sale_cancellation_document_id:
        input.existingSaleCancellation?.id ?? null,
      active_sale_cancellation_status:
        input.existingSaleCancellation?.status ?? null,
      refund_status: input.existingSaleCancellation?.refund_status ?? null,
    },
    return_state: accumulated.returnState,
    warnings,
  };
}

async function loadPostSaleDetailById(input: {
  tenantId: string;
  documentId: string;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosPostSaleDetailResponse> {
  const document = await loadPostSaleDocumentById(input);
  const [lines, refund, originalOrder, originalPayment, originalOrderLines, completedReturnLines] =
    await Promise.all([
    loadPostSaleLines({
      tenantId: input.tenantId,
      documentId: input.documentId,
      trace: input.trace,
    }),
    loadPostSaleRefundByDocument({
      tenantId: input.tenantId,
      documentId: input.documentId,
      trace: input.trace,
    }),
    loadOrder({
      tenantId: input.tenantId,
      orderId: document.original_order_id,
      trace: input.trace,
    }),
    loadPaymentByOrder({
      tenantId: input.tenantId,
      orderId: document.original_order_id,
      trace: input.trace,
    }),
    loadOrderLines({
      tenantId: input.tenantId,
      orderId: document.original_order_id,
      trace: input.trace,
    }),
    loadCompletedReturnLinesByOrder({
      tenantId: input.tenantId,
      orderId: document.original_order_id,
      trace: input.trace,
    }),
  ]);

  const { accumulatedLines, returnState } = buildReturnAccumulatedState({
    orderLines: originalOrderLines,
    completedReturnLines,
  });

  return {
    document,
    lines,
    refund,
    original_order: originalOrder,
    original_payment: originalPayment,
    original_order_lines: originalOrderLines,
    accumulated_lines: accumulatedLines,
    return_state: returnState,
  };
}

export async function previewRetailPosSaleCancellation(input: {
  tenantSlug: string;
  request: RetailPosPostSaleCancellationPreviewRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosPostSaleCancellationPreviewResponse> {
  const { actor, capabilities } = await resolvePostSaleActor(input);
  assertPostSaleCapability(capabilities, "post_sale.view");
  assertPostSaleCapability(capabilities, "post_sale.cancel_sale");

  const orderId = normalizeRequiredString(input.request.order_id, "order_id");
  const reasonCode = normalizeReasonCode(input.request.reason_code);
  const comment = normalizeOptionalString(input.request.comment);

  const [order, payment, lines, existingSaleCancellation] = await Promise.all([
    loadOrder({ tenantId: actor.tenantId, orderId, trace: input.trace }),
    loadPaymentByOrder({ tenantId: actor.tenantId, orderId, trace: input.trace }),
    loadOrderLines({ tenantId: actor.tenantId, orderId, trace: input.trace }),
    loadSaleCancellationDocumentByOrder({
      tenantId: actor.tenantId,
      orderId,
      trace: input.trace,
    }),
  ]);

  if (order.status !== "paid") {
    throw new RetailPosRuntimeError(409, "ORDER_NOT_PAID", "ORDER_NOT_PAID");
  }

  if (existingSaleCancellation) {
    throw new RetailPosRuntimeError(
      409,
      "SALE_ALREADY_CANCELLED",
      "SALE_ALREADY_CANCELLED",
    );
  }

  return {
    original_order: order,
    original_payment: payment,
    lines: lines.map((line) => ({
      original_order_line_id: line.id,
      line_number: line.line_number,
      product_name: line.product_name,
      variant_name: line.variant_name ?? null,
      quantity_sold: normalizeQuantity(line.quantity, "retail_pos_order_lines.quantity"),
      line_subtotal_cents_historical: line.line_subtotal_cents,
      direct_discount_cents_historical: line.direct_discount_cents ?? 0,
      order_discount_allocated_cents_historical:
        line.order_discount_allocation_cents ?? 0,
      line_net_cents_historical: line.line_total_cents,
    })),
    gross_amount_cents: order.subtotal_cents,
    discount_amount_cents: order.discount_cents,
    net_amount_cents: order.total_cents,
    eligible_paid_amount_cents: payment.amount_cents,
    expected_order_revision: order.revision ?? 0,
    allowed_refund_methods: ["cash", "card_external"],
    existing_post_sale: {
      has_any_post_sale: false,
      active_sale_cancellation_document_id: null,
      active_sale_cancellation_status: null,
      refund_status: null,
    },
    warnings:
      reasonCode === "other" && !comment
        ? [
            {
              code: "OTHER_REASON_COMMENT_RECOMMENDED",
              message: "Comment is recommended when reason_code=other.",
            },
          ]
        : [],
  };
}

export async function previewRetailPosReturn(input: {
  tenantSlug: string;
  request: RetailPosPostSaleReturnPreviewRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosPostSaleReturnPreviewResponse> {
  const { actor, capabilities } = await resolvePostSaleActor(input);
  assertPostSaleCapability(capabilities, "post_sale.view");
  assertPostSaleCapability(capabilities, "post_sale.return");

  const orderId = normalizeRequiredString(input.request.order_id, "order_id");
  const reasonCode = normalizeReasonCode(input.request.reason_code);
  const comment = normalizeOptionalString(input.request.comment);
  const refundMethod = normalizeRefundMethod(input.request.refund_method ?? "cash");

  const [order, payment, orderLines, existingSaleCancellation, completedReturnLines] =
    await Promise.all([
      loadOrder({ tenantId: actor.tenantId, orderId, trace: input.trace }),
      loadPaymentByOrder({ tenantId: actor.tenantId, orderId, trace: input.trace }),
      loadOrderLines({ tenantId: actor.tenantId, orderId, trace: input.trace }),
      loadSaleCancellationDocumentByOrder({
        tenantId: actor.tenantId,
        orderId,
        trace: input.trace,
      }),
      loadCompletedReturnLinesByOrder({
        tenantId: actor.tenantId,
        orderId,
        trace: input.trace,
      }),
    ]);

  if (order.status !== "paid") {
    throw new RetailPosRuntimeError(409, "ORDER_NOT_PAID", "ORDER_NOT_PAID");
  }

  if (existingSaleCancellation?.status === "completed") {
    throw new RetailPosRuntimeError(
      409,
      "SALE_ALREADY_CANCELLED",
      "SALE_ALREADY_CANCELLED",
    );
  }

  return buildReturnPreview({
    order,
    payment,
    orderLines,
    completedReturnLines,
    existingSaleCancellation,
    selectionLines: Array.isArray(input.request.lines) ? input.request.lines : [],
    reasonCode,
    comment,
    refundMethod,
  });
}

export async function commitRetailPosSaleCancellation(input: {
  tenantSlug: string;
  commandId: string;
  operatorId: string;
  request: RetailPosPostSaleCancellationCommitRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosPostSaleCancellationCommitResponse> {
  const { actor, capabilities } = await resolvePostSaleActor(input);
  assertPostSaleCapability(capabilities, "post_sale.cancel_sale");
  assertPostSaleCapability(capabilities, "post_sale.refund");

  const commandId = normalizeRequiredString(input.commandId, "command_id");
  const operatorId = normalizeRequiredString(input.operatorId, "operator_id");
  const orderId = normalizeRequiredString(input.request.order_id, "order_id");
  const cashShiftId = normalizeRequiredString(input.request.cash_shift_id, "cash_shift_id");
  const expectedOrderRevision = normalizeInteger(
    input.request.expected_order_revision,
    "expected_order_revision",
  );
  const reasonCode = normalizeReasonCode(input.request.reason_code);
  const comment = normalizeOptionalString(input.request.comment);
  const refundMethod = normalizeRefundMethod(input.request.refund_method);

  const rpcPayload = {
    command_id: commandId,
    operator_id: operatorId,
    order_id: orderId,
    cash_shift_id: cashShiftId,
    expected_order_revision: expectedOrderRevision,
    reason_code: reasonCode,
    comment,
    refund_method: refundMethod,
  };

  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await supabase.rpc(
    "retail_pos_commit_sale_cancellation_v1",
    {
      p_tenant_id: actor.tenantId,
      p_device_id: actor.deviceRecordId,
      p_payload: rpcPayload,
    },
  );

  if (error) {
    throw mapSaleCancellationRpcError(error);
  }

  if (!data || typeof data !== "object") {
    throw new RetailPosRuntimeError(500, "POST_SALE_COMMIT_FAILED");
  }

  const rpcResponse = data as SaleCancellationCommitRpcResponse;
  const result = rpcResponse.result;
  const detail = await loadPostSaleDetailById({
    tenantId: actor.tenantId,
    documentId: result.document_id,
    trace: input.trace,
  });
  const cashMovement = result.cash_movement_id
    ? await loadCashMovementById({
        tenantId: actor.tenantId,
        movementId: result.cash_movement_id,
        trace: input.trace,
      })
    : null;

  return {
    document: detail.document,
    lines: detail.lines,
    refund:
      detail.refund ??
      (await loadPostSaleRefundById({
        tenantId: actor.tenantId,
        refundId: result.refund_id,
        trace: input.trace,
      })),
    cash_movement: cashMovement,
    replayed: rpcResponse.idempotent_replay || result.replayed,
    gross_amount_cents: result.gross_amount_cents,
    discount_amount_cents: result.discount_amount_cents,
    net_amount_cents: result.net_amount_cents,
  };
}

export async function commitRetailPosReturn(input: {
  tenantSlug: string;
  commandId: string;
  operatorId: string;
  request: RetailPosPostSaleReturnCommitRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosPostSaleReturnCommitResponse> {
  const { actor, capabilities } = await resolvePostSaleActor(input);
  assertPostSaleCapability(capabilities, "post_sale.return");
  assertPostSaleCapability(capabilities, "post_sale.refund");

  const commandId = normalizeRequiredString(input.commandId, "command_id");
  const operatorId = normalizeRequiredString(input.operatorId, "operator_id");
  const orderId = normalizeRequiredString(input.request.order_id, "order_id");
  const expectedOrderRevision = normalizeInteger(
    input.request.expected_order_revision,
    "expected_order_revision",
  );
  const reasonCode = normalizeReasonCode(input.request.reason_code);
  const comment = normalizeOptionalString(input.request.comment);
  const refundMethod = normalizeRefundMethod(input.request.refund_method);
  const cashShiftId =
    refundMethod === "cash"
      ? normalizeRequiredString(input.request.cash_shift_id, "cash_shift_id")
      : normalizeOptionalString(input.request.cash_shift_id);

  const normalizedLines = (Array.isArray(input.request.lines) ? input.request.lines : []).map((line) => ({
    order_line_id: normalizeRequiredString(line.order_line_id, "order_line_id"),
    quantity: normalizeQuantity(line.quantity, "quantity"),
  }));

  const localPreview = await previewRetailPosReturn({
    tenantSlug: input.tenantSlug,
    request: {
      order_id: orderId,
      lines: normalizedLines,
      reason_code: reasonCode,
      comment,
      refund_method: refundMethod,
    },
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
    trace: input.trace,
  });

  if (localPreview.expected_order_revision !== expectedOrderRevision) {
    throw new RetailPosRuntimeError(409, "RETURN_CONFLICT", "RETURN_CONFLICT");
  }

  const expectedFingerprint = buildReturnFingerprint({
    orderId,
    revision: expectedOrderRevision,
    reasonCode,
    comment,
    refundMethod,
    lines: normalizedLines.map((line) => ({
      orderLineId: line.order_line_id,
      quantity: line.quantity,
    })),
  });

  if (normalizeRequiredString(input.request.fingerprint, "fingerprint") !== expectedFingerprint) {
    throw new RetailPosRuntimeError(409, "COMMAND_PAYLOAD_MISMATCH", "COMMAND_PAYLOAD_MISMATCH");
  }

  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await supabase.rpc("retail_pos_commit_return_v1", {
    p_tenant_id: actor.tenantId,
    p_device_id: actor.deviceRecordId,
    p_payload: {
      command_id: commandId,
      operator_id: operatorId,
      order_id: orderId,
      cash_shift_id: cashShiftId,
      expected_order_revision: expectedOrderRevision,
      fingerprint: expectedFingerprint,
      lines: normalizedLines,
      reason_code: reasonCode,
      comment,
      refund_method: refundMethod,
    },
  });

  if (error) {
    throw mapReturnRpcError(error);
  }

  if (!data || typeof data !== "object") {
    throw new RetailPosRuntimeError(500, "POST_SALE_RETURN_FAILED");
  }

  const rpcResponse = data as ReturnCommitRpcResponse;
  const result = rpcResponse.result;
  const detail = await loadPostSaleDetailById({
    tenantId: actor.tenantId,
    documentId: result.document_id,
    trace: input.trace,
  });
  const cashMovement = result.cash_movement_id
    ? await loadCashMovementById({
        tenantId: actor.tenantId,
        movementId: result.cash_movement_id,
        trace: input.trace,
      })
    : null;

  return {
    document: detail.document,
    lines: detail.lines,
    refund:
      detail.refund ??
      (await loadPostSaleRefundById({
        tenantId: actor.tenantId,
        refundId: result.refund_id,
        trace: input.trace,
      })),
    cash_movement: cashMovement,
    replayed: rpcResponse.idempotent_replay || result.replayed,
    return_state: detail.return_state ?? "not_returned",
    accumulated_lines: detail.accumulated_lines ?? [],
    totals: localPreview.totals,
  };
}

export async function confirmRetailPosCardRefund(input: {
  tenantSlug: string;
  commandId: string;
  operatorId: string;
  request: RetailPosPostSaleCardRefundConfirmRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosPostSaleCardRefundConfirmResponse> {
  const { actor, capabilities } = await resolvePostSaleActor(input);
  assertPostSaleCapability(capabilities, "post_sale.refund");

  const commandId = normalizeRequiredString(input.commandId, "command_id");
  const operatorId = normalizeRequiredString(input.operatorId, "operator_id");
  const documentId = normalizeRequiredString(
    input.request.post_sale_document_id,
    "post_sale_document_id",
  );
  const refundId = normalizeRequiredString(input.request.refund_id, "refund_id");
  const externalReference = normalizeRequiredString(
    input.request.external_reference,
    "external_reference",
  );

  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await supabase.rpc(
    "retail_pos_confirm_card_external_refund_v1",
    {
      p_tenant_id: actor.tenantId,
      p_device_id: actor.deviceRecordId,
      p_payload: {
        command_id: commandId,
        operator_id: operatorId,
        post_sale_document_id: documentId,
        refund_id: refundId,
        external_reference: externalReference,
      },
    },
  );

  if (error) {
    throw mapCardRefundRpcError(error);
  }

  if (!data || typeof data !== "object") {
    throw new RetailPosRuntimeError(500, "POST_SALE_CARD_REFUND_CONFIRM_FAILED");
  }

  const rpcResponse = data as CardRefundConfirmRpcResponse;
  const result = rpcResponse.result;
  const detail = await loadPostSaleDetailById({
    tenantId: actor.tenantId,
    documentId: result.document_id,
    trace: input.trace,
  });

  return {
    document: detail.document,
    refund:
      detail.refund ??
      (await loadPostSaleRefundById({
        tenantId: actor.tenantId,
        refundId: result.refund_id,
        trace: input.trace,
      })),
    replayed: rpcResponse.idempotent_replay || result.replayed,
  };
}

export async function getRetailPosPostSaleDetail(input: {
  tenantSlug: string;
  documentId: string;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}) {
  const { actor, capabilities } = await resolvePostSaleActor(input);
  assertPostSaleCapability(capabilities, "post_sale.view");

  return loadPostSaleDetailById({
    tenantId: actor.tenantId,
    documentId: normalizeRequiredString(input.documentId, "documentId"),
    trace: input.trace,
  });
}

export function isRetailPosCashRefundMovementType(
  value: string,
): value is RetailPosPostSaleCashMovementType {
  return value === "post_sale_cash_refund";
}
