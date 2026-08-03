import type {
  CreateRetailPosOrderLineInput,
  CreateRetailPosOrderRequest,
  CreateRetailPosOrderResponse,
  GetRetailPosOrderResponse,
  RetailPosDiscountAllocationSnapshot,
  RetailPosOrderDiscountOverview,
  RetailPosOrder,
  RetailPosOrderLine,
  RetailPosOrderPaymentApplication,
  RetailPosPaymentTransaction,
  RetailPosPersistedOrderDiscount,
  RetailPosRecentPendingOrderSummary,
  UpdateRetailPosOrderRequest,
  VoidRetailPosOrderRequest,
} from "@/shared/types/retail-pos";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertRetailPosOrderEntryAccess,
  assertRetailPosCashierAccess,
  assertRetailPosDeviceRole,
  resolveRetailPosRuntimeActor,
  type RetailPosRuntimeActor,
} from "./auth";
import { RetailPosRuntimeError } from "./errors";
import { buildRetailPosPaymentEvidence, PAYMENT_APPLICATION_SELECT } from "./payment-evidence";
import type { RuntimePerfTrace } from "./runtime-perf";
import { runSupabaseReadWithRetry } from "./runtime-supabase-retry";
import {
  isRetailPosCanonicalQuantity,
  normalizeRetailPosQuantity,
} from "./quantity";

type VariantRow = {
  id: string;
  tenant_id: string;
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit_price_cents: number | null;
  wholesale_price_cents: number | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  deleted_at: string | null;
};

type PosUserRow = {
  id: string;
  tenant_id: string;
  name: string;
  role: "cashier" | "supervisor" | "admin";
  is_active: boolean;
};

type OrderRow = RetailPosOrder;

type OrderLineRow = RetailPosOrderLine;

type PaymentRow = {
  id: string;
  tenant_id: string;
  order_id: string;
  cash_shift_id: string;
  device_id: string;
  pos_user_id: string;
  payment_method: "cash" | "card";
  amount_cents: number;
  received_amount_cents: number | null;
  change_cents: number;
  card_reference: string | null;
  paid_at: string;
  created_at: string;
  created_by: string | null;
  payment_transaction_id: string | null;
  payment_sequence: number | null;
};

type PaymentTransactionRow = RetailPosPaymentTransaction;
type PaymentApplicationRow = RetailPosOrderPaymentApplication;

type PersistedOrderDiscountRow = Omit<
  RetailPosPersistedOrderDiscount,
  "allocations" | "authorization"
> & {
  authorization_required: boolean;
  authorization_status: RetailPosPersistedOrderDiscount["authorization"]["status"];
  authorization_method: RetailPosPersistedOrderDiscount["authorization"]["method"];
  authorization_policy_key: string | null;
  authorization_note: string | null;
  authorization_requested_by_pos_user_id: string | null;
  authorized_by_pos_user_id: string | null;
  authorized_at: string | null;
  authorization_reference: string | null;
  authorization_context: Record<string, unknown> | null;
};

type PersistedOrderDiscountAllocationRow = RetailPosDiscountAllocationSnapshot & {
  id: string;
  tenant_id: string;
  order_id: string;
  order_discount_id: string;
  created_at: string;
  created_by: string | null;
};

type ResolvedOrderInputLine = {
  line_number: number;
  product_id: string;
  product_variant_id: string | null;
  quantity: string;
  discount_cents: number;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  barcode: string | null;
  sales_unit_code: string;
  sales_unit_label: string;
  allow_decimal_quantity: boolean;
  unit_price_cents: number;
  public_unit_price_snapshot_cents: number;
  wholesale_unit_price_snapshot_cents: number;
  requested_price_tier: "public" | "wholesale";
  price_tier_request_status: "not_requested" | "pending" | "approved" | "rejected";
  requested_unit_price_cents: number;
  requested_by_pos_user_id: string | null;
  requested_at: string | null;
  approved_price_tier: "public" | "wholesale" | null;
  approved_unit_price_cents: number | null;
  approved_price_tier_source: "default_public" | "counter_request" | "cashier_direct" | null;
  approved_by_pos_user_id: string | null;
  approved_at: string | null;
  unit_cost_snapshot_cents: number;
};

type CurrentOrderContext = {
  order: OrderRow;
  lines: OrderLineRow[];
};

type ExistingOrderComparableLine = {
  line_number: number;
  product_id: string;
  product_variant_id: string | null;
  quantity: string;
  discount_cents: number;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  barcode: string | null;
  sales_unit_code: string;
  sales_unit_label: string;
  allow_decimal_quantity: boolean;
  unit_price_cents: number;
};

const ORDER_SELECT =
  "id, tenant_id, folio, origin_client_order_id, origin_local_folio, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, total_cents, revision, direct_discount_cents, order_discount_cents, paid_at, voided_at, voided_by_pos_user_id, void_reason, void_note, copied_from_order_id, cancelled_at, cancelled_by_pos_user_id, cancel_reason, created_at, updated_at, created_by, updated_by";

const ORDER_LINE_SELECT =
  "id, tenant_id, order_id, line_number, product_id, product_variant_id, product_name, variant_name, sku, barcode, sales_unit_code, sales_unit_label, allow_decimal_quantity, quantity, unit_price_cents, public_unit_price_snapshot_cents, wholesale_unit_price_snapshot_cents, requested_price_tier, price_tier_request_status, requested_unit_price_cents, requested_by_pos_user_id, requested_at, approved_price_tier, approved_unit_price_cents, approved_price_tier_source, approved_by_pos_user_id, approved_at, line_subtotal_cents, discount_cents, line_total_cents, direct_discount_cents, order_discount_allocation_cents, total_discount_cents, unit_cost_snapshot_cents, cost_evaluation, below_cost_after_discount, created_at, updated_at, created_by, updated_by";

const ORDER_DISCOUNT_SELECT =
  "id, tenant_id, order_id, order_revision, lifecycle_status, scope, order_line_id, capture_type, percentage_bps, amount_cents, base_amount_cents, effective_discount_cents, reason_code, comment, source, applied_by_pos_user_id, applied_by_device_id, applied_at, expected_revision, authorization_required, authorization_status, authorization_method, authorization_policy_key, authorization_note, authorization_requested_by_pos_user_id, authorized_by_pos_user_id, authorized_at, authorization_reference, authorization_context, created_at, updated_at";

const REMOTE_FOLIO_COMPACT_PATTERN = /^([A-Z]+)(\d{6})(\d{4,})$/;
const REMOTE_FOLIO_DASHED_PATTERN = /^([A-Z]+)-(\d{6})-(\d{4,})$/;
const LOCAL_FOLIO_COMPACT_PATTERN = /^(\d{4})(\d{1,6})(\d{6})$/;
const LOCAL_FOLIO_DASHED_PATTERN = /^(\d{4})-(\d{1,6})-(\d{6})$/;

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeRetailPosLookupFolio(value: string): {
  remote: string | null;
  local: string | null;
  normalized: string;
} {
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, "").replace(/['’‘`]/g, "-");
  if (!cleaned) {
    return { remote: null, local: null, normalized: "" };
  }

  const remoteDashed = cleaned.match(REMOTE_FOLIO_DASHED_PATTERN);
  if (remoteDashed) {
    const [, prefix, datePart, serialPart] = remoteDashed;
    return {
      remote: `${prefix}-${datePart}-${serialPart}`,
      local: null,
      normalized: `${prefix}-${datePart}-${serialPart}`,
    };
  }

  const remoteCompact = cleaned.match(REMOTE_FOLIO_COMPACT_PATTERN);
  if (remoteCompact) {
    const [, prefix, datePart, serialPart] = remoteCompact;
    return {
      remote: `${prefix}-${datePart}-${serialPart}`,
      local: null,
      normalized: `${prefix}-${datePart}-${serialPart}`,
    };
  }

  const localDashed = cleaned.match(LOCAL_FOLIO_DASHED_PATTERN);
  if (localDashed) {
    const [, sequencePart, stationPart, datePart] = localDashed;
    return {
      remote: null,
      local: `${sequencePart}-${stationPart}-${datePart}`,
      normalized: `${sequencePart}-${stationPart}-${datePart}`,
    };
  }

  const localCompact = cleaned.match(LOCAL_FOLIO_COMPACT_PATTERN);
  if (localCompact) {
    const [, sequencePart, stationPart, datePart] = localCompact;
    return {
      remote: null,
      local: `${sequencePart}-${stationPart}-${datePart}`,
      normalized: `${sequencePart}-${stationPart}-${datePart}`,
    };
  }

  return { remote: cleaned, local: cleaned, normalized: cleaned };
}

function normalizeOriginLocalFolio(value: unknown): string | null {
  const normalized = asTrimmedString(value);
  if (!normalized) {
    return null;
  }

  return normalizeRetailPosLookupFolio(normalized).local;
}

function asArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function mapPersistedOrderDiscount(
  discount: PersistedOrderDiscountRow,
): RetailPosPersistedOrderDiscount {
  return {
    id: discount.id,
    tenant_id: discount.tenant_id,
    order_id: discount.order_id,
    order_revision: discount.order_revision,
    lifecycle_status: discount.lifecycle_status,
    scope: discount.scope,
    order_line_id: discount.order_line_id,
    capture_type: discount.capture_type,
    percentage_bps: discount.percentage_bps,
    amount_cents: discount.amount_cents,
    base_amount_cents: discount.base_amount_cents,
    effective_discount_cents: discount.effective_discount_cents,
    reason_code: discount.reason_code,
    comment: discount.comment,
    source: discount.source,
    applied_by_pos_user_id: discount.applied_by_pos_user_id,
    applied_by_device_id: discount.applied_by_device_id,
    applied_at: discount.applied_at,
    expected_revision: discount.expected_revision,
    authorization: {
      required: discount.authorization_required,
      status: discount.authorization_status,
      method: discount.authorization_method,
      policy_key: discount.authorization_policy_key,
      requested_by_pos_user_id: discount.authorization_requested_by_pos_user_id,
      authorized_by_pos_user_id: discount.authorized_by_pos_user_id,
      authorized_at: discount.authorized_at,
      reference: discount.authorization_reference,
      note: discount.authorization_note,
      context: discount.authorization_context ?? {},
    },
    allocations: [],
    created_at: discount.created_at,
    updated_at: discount.updated_at,
  };
}

function sumLineDiscountCents(lines: OrderLineRow[]) {
  return lines.reduce((sum, line) => sum + (line.direct_discount_cents ?? 0), 0);
}

function sumOrderDiscountAllocationCents(lines: OrderLineRow[]) {
  return lines.reduce((sum, line) => sum + (line.order_discount_allocation_cents ?? 0), 0);
}

function buildOrderDiscountOverview(input: {
  order: OrderRow;
  lines: OrderLineRow[];
  discounts: RetailPosPersistedOrderDiscount[];
}): RetailPosOrderDiscountOverview | null {
  const lineDiscountCents =
    typeof input.order.direct_discount_cents === "number"
      ? input.order.direct_discount_cents
      : sumLineDiscountCents(input.lines);
  const fallbackOrderDiscountCents =
    input.discounts
      .filter((discount) => discount.scope === "order")
      .reduce((sum, discount) => sum + discount.effective_discount_cents, 0) ||
    sumOrderDiscountAllocationCents(input.lines);
  const orderDiscountCents =
    typeof input.order.order_discount_cents === "number"
      ? input.order.order_discount_cents
      : fallbackOrderDiscountCents;
  const totalDiscountCents =
    typeof input.order.discount_cents === "number"
      ? input.order.discount_cents
      : lineDiscountCents + orderDiscountCents;

  if (totalDiscountCents <= 0 && !input.lines.some((line) => line.below_cost_after_discount === true)) {
    return null;
  }

  return {
    subtotal_gross_cents: input.order.subtotal_cents,
    line_discount_cents: lineDiscountCents,
    order_discount_cents: orderDiscountCents,
    total_discount_cents: totalDiscountCents,
    total_cents: input.order.total_cents,
    has_below_cost_lines: input.lines.some((line) => line.below_cost_after_discount === true),
  };
}

function ensureNonNegativeInteger(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new RetailPosRuntimeError(400, `${field} must be a non-negative integer.`);
  }

  return value;
}

function ensurePositiveInteger(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new RetailPosRuntimeError(400, `${field} must be a positive integer.`);
  }

  return value;
}

function ensurePositiveLineNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new RetailPosRuntimeError(400, "line_number must be a positive integer.");
  }

  return value;
}

function ensureCanonicalQuantity(value: unknown) {
  if (typeof value !== "string") {
    throw new RetailPosRuntimeError(400, "quantity must be a string.");
  }

  const normalized = normalizeRetailPosQuantity(value);

  if (!normalized || !isRetailPosCanonicalQuantity(normalized)) {
    throw new RetailPosRuntimeError(400, "quantity must be a positive decimal string with up to 3 decimals.");
  }

  return normalized;
}

function ensureWholeQuantity(value: string) {
  if (!value.endsWith(".000")) {
    throw new RetailPosRuntimeError(400, "quantity must be a whole unit for this product.");
  }
}

const RETAIL_POS_FOLIO_TIME_ZONE = "America/Mexico_City";

function parseDatePrefix(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: RETAIL_POS_FOLIO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = (values.get("year") ?? "").slice(-2);
  const month = values.get("month") ?? "01";
  const day = values.get("day") ?? "01";
  return `${year}${month}${day}`;
}

function isUniqueViolation(error: { code?: string; message?: string } | null, constraint?: string) {
  if (!error) {
    return false;
  }

  if (error.code !== "23505") {
    return false;
  }

  return constraint ? Boolean(error.message?.includes(constraint)) : true;
}

async function assertPosUser(tenantId: string, posUserId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pos_users")
    .select("id, tenant_id, name, role, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", posUserId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle<PosUserRow>();

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load POS user: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(400, "POS user is not active for this tenant.");
  }

  return data;
}

async function assertDeviceRecordForTenant(tenantId: string, deviceRecordId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pos_devices")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", deviceRecordId)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load POS device: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(400, "POS device is not available for this tenant.");
  }

  return data;
}

async function loadOrderContext(
  tenantId: string,
  orderId: string,
  trace?: RuntimePerfTrace,
): Promise<CurrentOrderContext> {
  const supabase = getSupabaseAdminClient({ trace });

  const orderPromise = trace
    ? runSupabaseReadWithRetry<OrderRow>({
        trace,
        step: "order_header",
        query: (signal) =>
          supabase
            .from("retail_pos_orders")
            .select(
              ORDER_SELECT,
            )
            .abortSignal(signal)
            .eq("tenant_id", tenantId)
            .eq("id", orderId)
            .limit(1)
            .maybeSingle<OrderRow>(),
      })
    : supabase
        .from("retail_pos_orders")
        .select(
          ORDER_SELECT,
        )
        .eq("tenant_id", tenantId)
        .eq("id", orderId)
        .limit(1)
        .maybeSingle<OrderRow>();
  const linesPromise = trace
    ? runSupabaseReadWithRetry<OrderLineRow[]>({
        trace,
        step: "order_lines",
        query: (signal) =>
          supabase
            .from("retail_pos_order_lines")
            .select(ORDER_LINE_SELECT)
            .abortSignal(signal)
            .eq("tenant_id", tenantId)
            .eq("order_id", orderId)
            .order("line_number", { ascending: true }),
      })
    : supabase
        .from("retail_pos_order_lines")
        .select(ORDER_LINE_SELECT)
        .eq("tenant_id", tenantId)
        .eq("order_id", orderId)
        .order("line_number", { ascending: true });
  const [orderResult, linesResult] = await Promise.all([orderPromise, linesPromise]);

  if (orderResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos order: ${orderResult.error.message}`);
  }

  if (!orderResult.data) {
    throw new RetailPosRuntimeError(404, "retail_pos order not found.");
  }

  if (linesResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos order lines: ${linesResult.error.message}`);
  }

  return {
    order: orderResult.data,
    lines: asArray(linesResult.data),
  };
}

async function loadPersistedOrderDiscounts(input: {
  tenantId: string;
  orderId: string;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosPersistedOrderDiscount[]> {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const [discountsResult, allocationsResult] = await Promise.all([
    runSupabaseReadWithRetry<PersistedOrderDiscountRow[]>({
      trace: input.trace,
      step: "order_discounts",
      query: (signal) =>
        supabase
          .from("retail_pos_order_discounts")
          .select(ORDER_DISCOUNT_SELECT)
          .abortSignal(signal)
          .eq("tenant_id", input.tenantId)
          .eq("order_id", input.orderId)
          .eq("lifecycle_status", "active")
          .order("created_at", { ascending: true })
          .returns<PersistedOrderDiscountRow[]>(),
    }),
    runSupabaseReadWithRetry<PersistedOrderDiscountAllocationRow[]>({
      trace: input.trace,
      step: "order_discount_allocations",
      query: (signal) =>
        supabase
          .from("retail_pos_order_discount_allocations")
          .select(
            "id, tenant_id, order_id, order_discount_id, order_line_id, line_number, allocation_base_cents, allocated_discount_cents, created_at, created_by",
          )
          .abortSignal(signal)
          .eq("tenant_id", input.tenantId)
          .eq("order_id", input.orderId)
          .order("created_at", { ascending: true })
          .returns<PersistedOrderDiscountAllocationRow[]>(),
    }),
  ]);

  if (discountsResult.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos order discounts: ${discountsResult.error.message}`,
    );
  }

  if (allocationsResult.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos order discount allocations: ${allocationsResult.error.message}`,
    );
  }

  const allocationsByDiscountId = new Map<string, RetailPosDiscountAllocationSnapshot[]>();
  for (const allocation of allocationsResult.data ?? []) {
    const bucket = allocationsByDiscountId.get(allocation.order_discount_id) ?? [];
    bucket.push({
      order_line_id: allocation.order_line_id,
      line_number: allocation.line_number,
      allocation_base_cents: allocation.allocation_base_cents,
      allocated_discount_cents: allocation.allocated_discount_cents,
    });
    allocationsByDiscountId.set(allocation.order_discount_id, bucket);
  }

  return (discountsResult.data ?? []).map((discount) => ({
    ...mapPersistedOrderDiscount(discount),
    allocations: allocationsByDiscountId.get(discount.id) ?? [],
  }));
}

async function loadOrderDetail(
  tenantId: string,
  orderId: string,
  trace?: RuntimePerfTrace,
): Promise<GetRetailPosOrderResponse> {
  const detailStartedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const context = await loadOrderContext(tenantId, orderId, trace);

  const [paymentEvidence, discounts] = await Promise.all([
    loadRetailPosPaymentEvidence({ tenantId, order: context.order, lines: context.lines, trace }),
    loadPersistedOrderDiscounts({ tenantId, orderId, trace }),
  ]);

  trace?.addDuration(
    "order_detail",
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      detailStartedAt,
  );
  return {
    order: context.order,
    lines: context.lines,
    payment: paymentEvidence?.payment ?? null,
    payment_evidence: paymentEvidence,
    discounts,
    discount_overview: buildOrderDiscountOverview({
      order: context.order,
      lines: context.lines,
      discounts,
    }),
  };
}

async function loadRetailPosPaymentEvidence(input: {
  tenantId: string;
  order: OrderRow;
  lines: OrderLineRow[];
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const paymentsResult = await runSupabaseReadWithRetry<PaymentRow[]>({
    trace: input.trace,
    step: "payment_evidence_payments",
    query: (signal) =>
      supabase
        .from("retail_pos_payments")
        .select(
          "id, tenant_id, order_id, cash_shift_id, device_id, pos_user_id, payment_method, amount_cents, received_amount_cents, change_cents, card_reference, paid_at, created_at, created_by, payment_transaction_id, payment_sequence",
        )
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("order_id", input.order.id)
        .order("payment_sequence", { ascending: true })
        .returns<PaymentRow[]>(),
  });

  if (paymentsResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos payment evidence: ${paymentsResult.error.message}`);
  }

  const payments = paymentsResult.data ?? [];
  if (payments.length === 0) return null;

  const transactionIds = Array.from(
    new Set(payments.map((payment) => payment.payment_transaction_id).filter((value): value is string => Boolean(value))),
  );
  if (transactionIds.length !== 1) {
    throw new RetailPosRuntimeError(500, "PAYMENT_EVIDENCE_INCONSISTENT", "PAYMENT_EVIDENCE_INCONSISTENT");
  }

  const [transactionResult, applicationResult] = await Promise.all([
    runSupabaseReadWithRetry<PaymentTransactionRow>({
      trace: input.trace,
      step: "payment_evidence_transaction",
      query: (signal) =>
        supabase
          .from("retail_pos_payment_transactions")
          .select("id, tenant_id, command_id, fingerprint, total_applied_cents, expected_order_revision, cash_shift_id, device_id, pos_user_id, confirmed_at, created_at, created_by")
          .abortSignal(signal)
          .eq("tenant_id", input.tenantId)
          .eq("id", transactionIds[0])
          .limit(1)
          .maybeSingle<PaymentTransactionRow>(),
    }),
    runSupabaseReadWithRetry<PaymentApplicationRow>({
      trace: input.trace,
      step: "payment_evidence_application",
      query: (signal) =>
        supabase
          .from("retail_pos_order_payment_applications")
          .select(PAYMENT_APPLICATION_SELECT)
          .abortSignal(signal)
          .eq("tenant_id", input.tenantId)
          .eq("order_id", input.order.id)
          .eq("payment_transaction_id", transactionIds[0])
          .order("application_sequence", { ascending: true })
          .limit(1)
          .maybeSingle<PaymentApplicationRow>(),
    }),
  ]);

  if (transactionResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos payment transaction: ${transactionResult.error.message}`);
  }
  if (applicationResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos payment application: ${applicationResult.error.message}`);
  }

  return buildRetailPosPaymentEvidence({
    order: input.order,
    lines: input.lines,
    paymentTransaction: transactionResult.data ?? null,
    application: applicationResult.data ?? null,
    payments,
  });
}

async function loadOrderDetailFromOrderContext(
  input: {
    tenantId: string;
    order: OrderRow;
    trace?: RuntimePerfTrace;
  },
): Promise<GetRetailPosOrderResponse> {
  const detailStartedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const supabase = getSupabaseAdminClient({ trace: input.trace });

  const [linesResult, discounts] = await Promise.all([
    runSupabaseReadWithRetry<OrderLineRow[]>({
      trace: input.trace,
      step: "order_lines",
      query: (signal) =>
        supabase
          .from("retail_pos_order_lines")
          .select(ORDER_LINE_SELECT)
          .abortSignal(signal)
          .eq("tenant_id", input.tenantId)
          .eq("order_id", input.order.id)
          .order("line_number", { ascending: true }),
    }),
    loadPersistedOrderDiscounts({
      tenantId: input.tenantId,
      orderId: input.order.id,
      trace: input.trace,
    }),
  ]);

  if (linesResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos order lines: ${linesResult.error.message}`);
  }

  const lines = asArray(linesResult.data);
  const paymentEvidence = await loadRetailPosPaymentEvidence({
    tenantId: input.tenantId,
    order: input.order,
    lines,
    trace: input.trace,
  });

  input.trace?.addDuration(
    "order_detail",
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      detailStartedAt,
  );

  return {
    order: input.order,
    lines,
    payment: paymentEvidence?.payment ?? null,
    payment_evidence: paymentEvidence,
    discounts,
    discount_overview: buildOrderDiscountOverview({
      order: input.order,
      lines,
      discounts,
    }),
  };
}

async function resolveLineSnapshots(input: {
  tenantId: string;
  lines: CreateRetailPosOrderLineInput[];
}): Promise<ResolvedOrderInputLine[]> {
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new RetailPosRuntimeError(400, "At least one line is required.");
  }

  const productIds = Array.from(new Set(input.lines.map((line) => asTrimmedString(line.product_id)).filter(Boolean))) as string[];
  const variantIds = Array.from(
    new Set(input.lines.map((line) => asTrimmedString(line.product_variant_id)).filter(Boolean)),
  ) as string[];

  const supabase = getSupabaseAdminClient();
  const productsPromise = supabase
      .from("retail_pos_products")
      .select(
        "id, tenant_id, category_id, name, brand, sku, barcode, unit_price_cents, wholesale_price_cents, cost_cents, sales_unit_code, sales_unit_label, allow_decimal_quantity, has_variants, is_active, deleted_at",
      )
      .eq("tenant_id", input.tenantId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .in("id", productIds);
  const variantsPromise =
    variantIds.length > 0
      ? supabase
          .from("retail_pos_product_variants")
          .select(
            "id, tenant_id, product_id, name, sku, barcode, unit_price_cents, wholesale_price_cents, is_default, is_active, sort_order, deleted_at",
          )
          .eq("tenant_id", input.tenantId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .in("id", variantIds)
      : Promise.resolve({ data: [] as VariantRow[], error: null });
  const [productsResult, variantsResult] = await Promise.all([productsPromise, variantsPromise]);

  if (productsResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos products: ${productsResult.error.message}`);
  }

  if (variantsResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos variants: ${variantsResult.error.message}`);
  }

  const productsById = new Map(asArray(productsResult.data).map((product) => [product.id, product]));
  const variantsById = new Map(asArray(variantsResult.data).map((variant) => [variant.id, variant]));
  const seenLineNumbers = new Set<number>();

  return input.lines.map((line) => {
    const lineNumber = ensurePositiveLineNumber(line.line_number);
    if (seenLineNumbers.has(lineNumber)) {
      throw new RetailPosRuntimeError(400, `line_number ${lineNumber} is duplicated.`);
    }
    seenLineNumbers.add(lineNumber);

    const productId = asTrimmedString(line.product_id);
    if (!productId) {
      throw new RetailPosRuntimeError(400, "product_id is required.");
    }

    const product = productsById.get(productId);
    if (!product) {
      throw new RetailPosRuntimeError(400, `Product ${productId} is not available in retail_pos catalog.`);
    }

    const variantId = asTrimmedString(line.product_variant_id);
    const variant = variantId ? variantsById.get(variantId) : null;

    if (variantId && !variant) {
      throw new RetailPosRuntimeError(400, `Variant ${variantId} is not available in retail_pos catalog.`);
    }

    if (variant && variant.product_id !== product.id) {
      throw new RetailPosRuntimeError(400, `Variant ${variant.id} does not belong to product ${product.id}.`);
    }

    if (product.has_variants && !variant) {
      throw new RetailPosRuntimeError(400, `Product ${product.id} requires an active variant.`);
    }

    const quantity = ensureCanonicalQuantity(line.quantity);
    const snapshotAllowsDecimal =
      typeof line.allow_decimal_quantity === "boolean"
        ? line.allow_decimal_quantity
        : product.allow_decimal_quantity;

    if (!snapshotAllowsDecimal) {
      ensureWholeQuantity(quantity);
    }

    const discountCents = ensureNonNegativeInteger(line.discount_cents, "discount_cents");
    const currentCatalogUnitPriceCents = variant?.unit_price_cents ?? product.unit_price_cents;
    const providedUnitPriceCents = ensurePositiveInteger(line.unit_price_cents, "unit_price_cents");
    const requestedPriceTier = line.requested_price_tier ?? "public";
    if (line.public_unit_price_snapshot_cents === undefined || line.public_unit_price_snapshot_cents === null ||
        line.wholesale_unit_price_snapshot_cents === undefined || line.wholesale_unit_price_snapshot_cents === null) {
      throw new RetailPosRuntimeError(400, "ORDER_LINE_PRICE_SNAPSHOT_REQUIRED");
    }
    const publicSnapshot = line.public_unit_price_snapshot_cents;
    const wholesaleSnapshot = line.wholesale_unit_price_snapshot_cents;
    const requestedUnitPrice = line.requested_unit_price_cents ?? publicSnapshot;
    if (requestedPriceTier !== "public" && requestedPriceTier !== "wholesale") {
      throw new RetailPosRuntimeError(400, "ORDER_LINE_PRICE_TIER_INVALID");
    }
    const expectedRequestedPrice = requestedPriceTier === "wholesale" ? wholesaleSnapshot : publicSnapshot;
    if (requestedUnitPrice !== expectedRequestedPrice) {
      throw new RetailPosRuntimeError(400, "ORDER_LINE_UNIT_PRICE_MISMATCH", "The requested price does not match its price snapshot.");
    }
    const approvedPriceTier = line.approved_price_tier;
    if (approvedPriceTier !== "public" && approvedPriceTier !== "wholesale") {
      throw new RetailPosRuntimeError(400, "ORDER_LINE_PRICE_TIER_REQUIRED");
    }
    const approvedUnitPriceCents = line.approved_unit_price_cents;
    if (!Number.isSafeInteger(approvedUnitPriceCents) || (approvedUnitPriceCents as number) < 0) {
      throw new RetailPosRuntimeError(400, "ORDER_LINE_APPROVED_PRICE_MISMATCH");
    }
    const expectedApprovedPrice = approvedPriceTier === "wholesale" ? wholesaleSnapshot : publicSnapshot;
    if (approvedUnitPriceCents !== expectedApprovedPrice) {
      throw new RetailPosRuntimeError(400, "ORDER_LINE_APPROVED_PRICE_MISMATCH");
    }
    if (providedUnitPriceCents !== approvedUnitPriceCents) {
      throw new RetailPosRuntimeError(400, "ORDER_LINE_UNIT_PRICE_MISMATCH");
    }
    const productCostCents = product.cost_cents;
    if (!Number.isSafeInteger(productCostCents) || (productCostCents as number) <= 0) {
      throw new RetailPosRuntimeError(422, "ORDER_LINE_COST_SNAPSHOT_REQUIRED");
    }
    const snapshotProductName = asTrimmedString(line.product_name) ?? product.name;
    const snapshotVariantName =
      variant?.id ? asTrimmedString(line.variant_name) ?? variant.name : asTrimmedString(line.variant_name);
    const snapshotSku = asTrimmedString(line.sku) ?? variant?.sku ?? product.sku;
    const snapshotBarcode = asTrimmedString(line.barcode) ?? variant?.barcode ?? product.barcode;
    const snapshotSalesUnitCode = asTrimmedString(line.sales_unit_code) ?? product.sales_unit_code;
    const snapshotSalesUnitLabel = asTrimmedString(line.sales_unit_label) ?? product.sales_unit_label;

    if (!snapshotSalesUnitCode || !snapshotSalesUnitLabel || !snapshotProductName) {
      throw new RetailPosRuntimeError(400, `Line ${lineNumber} must include a valid commercial snapshot.`);
    }

    if (providedUnitPriceCents !== currentCatalogUnitPriceCents) {
      console.warn(
        `[retail-pos][orders][snapshot_price_mismatch] ${JSON.stringify({
          tenant_id: input.tenantId,
          product_id: product.id,
          product_variant_id: variant?.id ?? null,
          line_number: lineNumber,
          snapshot_unit_price_cents: providedUnitPriceCents,
          current_catalog_unit_price_cents: currentCatalogUnitPriceCents,
        })}`,
      );
    }

    return {
      line_number: lineNumber,
      product_id: product.id,
      product_variant_id: variant?.id ?? null,
      quantity,
      discount_cents: discountCents,
      product_name: snapshotProductName,
      variant_name: snapshotVariantName ?? null,
      sku: snapshotSku,
      barcode: snapshotBarcode,
      sales_unit_code: snapshotSalesUnitCode,
      sales_unit_label: snapshotSalesUnitLabel,
      allow_decimal_quantity: snapshotAllowsDecimal,
      unit_price_cents: providedUnitPriceCents,
      public_unit_price_snapshot_cents: ensureNonNegativeInteger(publicSnapshot, "public_unit_price_snapshot_cents"),
      wholesale_unit_price_snapshot_cents: ensureNonNegativeInteger(wholesaleSnapshot, "wholesale_unit_price_snapshot_cents"),
      requested_price_tier: requestedPriceTier,
      price_tier_request_status: line.price_tier_request_status ?? "not_requested",
      requested_unit_price_cents: requestedUnitPrice,
      requested_by_pos_user_id: line.requested_by_pos_user_id ?? null,
      requested_at: line.requested_at ?? null,
      approved_price_tier: approvedPriceTier,
      approved_unit_price_cents: approvedUnitPriceCents,
      approved_price_tier_source: line.approved_price_tier_source ?? null,
      approved_by_pos_user_id: line.approved_by_pos_user_id ?? null,
      approved_at: line.approved_at ?? null,
      unit_cost_snapshot_cents: productCostCents as number,
    };
  });
}

async function generateRetailPosFolio(tenantId: string) {
  const supabase = getSupabaseAdminClient();
  const datePrefix = parseDatePrefix();
  const folioPrefix = `RP-${datePrefix}-`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase
      .from("retail_pos_orders")
      .select("folio")
      .eq("tenant_id", tenantId)
      .ilike("folio", `${folioPrefix}%`)
      .order("folio", { ascending: false })
      .limit(25);

    if (error) {
      throw new RetailPosRuntimeError(500, `Unable to generate retail_pos folio: ${error.message}`);
    }

    const maxSequence = (asArray(data) as Array<{ folio: string }>).reduce((currentMax, row) => {
      const raw = row.folio.slice(folioPrefix.length);
      const parsed = Number.parseInt(raw, 10);
      return Number.isFinite(parsed) ? Math.max(currentMax, parsed) : currentMax;
    }, 0);

    const nextSequence = String(maxSequence + 1 + attempt).padStart(4, "0");
    return `${folioPrefix}${nextSequence}`;
  }

  throw new RetailPosRuntimeError(500, "Unable to allocate retail_pos folio.");
}

async function insertOrderLines(tenantId: string, orderId: string, lines: ResolvedOrderInputLine[]) {
  const supabase = getSupabaseAdminClient();
  const payload = lines.map((line) => ({
    tenant_id: tenantId,
    order_id: orderId,
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
    line_subtotal_cents: 0,
    discount_cents: line.discount_cents,
    line_total_cents: 0,
    public_unit_price_snapshot_cents: line.public_unit_price_snapshot_cents,
    wholesale_unit_price_snapshot_cents: line.wholesale_unit_price_snapshot_cents,
    requested_price_tier: line.requested_price_tier,
    price_tier_request_status: line.price_tier_request_status,
    requested_unit_price_cents: line.requested_unit_price_cents,
    requested_by_pos_user_id: line.requested_by_pos_user_id,
    requested_at: line.requested_at,
    approved_price_tier: line.approved_price_tier,
    approved_unit_price_cents: line.approved_unit_price_cents,
    approved_price_tier_source: line.approved_price_tier_source,
    approved_by_pos_user_id: line.approved_by_pos_user_id,
    approved_at: line.approved_at,
    unit_cost_snapshot_cents: line.unit_cost_snapshot_cents,
  }));

  const { error } = await supabase.from("retail_pos_order_lines").insert(payload);

  if (error) {
    throw new RetailPosRuntimeError(400, `Unable to write retail_pos order lines: ${error.message}`);
  }
}

function toComparableExistingLine(line: OrderLineRow): ExistingOrderComparableLine {
  return {
    line_number: line.line_number,
    product_id: line.product_id,
    product_variant_id: line.product_variant_id,
    quantity: line.quantity,
    discount_cents: line.discount_cents,
    product_name: line.product_name,
    variant_name: line.variant_name,
    sku: line.sku,
    barcode: line.barcode,
    sales_unit_code: line.sales_unit_code,
    sales_unit_label: line.sales_unit_label,
    allow_decimal_quantity: line.allow_decimal_quantity,
    unit_price_cents: line.unit_price_cents,
  };
}

function areResolvedLinesEquivalent(
  expectedLines: ResolvedOrderInputLine[],
  existingLines: OrderLineRow[],
) {
  if (expectedLines.length !== existingLines.length) {
    return false;
  }

  const existingComparable = existingLines
    .map(toComparableExistingLine)
    .sort((left, right) => left.line_number - right.line_number);
  const expectedComparable = [...expectedLines].sort(
    (left, right) => left.line_number - right.line_number,
  );

  return JSON.stringify(expectedComparable) === JSON.stringify(existingComparable);
}

async function cleanupOrderAfterCreateFailure(tenantId: string, orderId: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("retail_pos_orders")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", orderId);

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `retail_pos order creation failed and cleanup also failed: ${error.message}`,
    );
  }
}

async function restoreOrderLines(
  tenantId: string,
  orderId: string,
  originalLines: OrderLineRow[],
) {
  const supabase = getSupabaseAdminClient();

  const { error: deleteError } = await supabase
    .from("retail_pos_order_lines")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("order_id", orderId);

  if (deleteError) {
    throw new RetailPosRuntimeError(
      500,
      `retail_pos order update failed and line rollback delete failed: ${deleteError.message}`,
    );
  }

  if (originalLines.length === 0) {
    return;
  }

  const restorePayload = originalLines.map((line) => ({
    tenant_id: line.tenant_id,
    order_id: line.order_id,
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
    line_subtotal_cents: line.line_subtotal_cents,
    discount_cents: line.discount_cents,
    line_total_cents: line.line_total_cents,
  }));

  const { error: insertError } = await supabase
    .from("retail_pos_order_lines")
    .insert(restorePayload);

  if (insertError) {
    throw new RetailPosRuntimeError(
      500,
      `retail_pos order update failed and line rollback insert failed: ${insertError.message}`,
    );
  }
}

async function syncOrderLines(tenantId: string, orderId: string, lines: ResolvedOrderInputLine[]) {
  const supabase = getSupabaseAdminClient();
  const existingContext = await loadOrderContext(tenantId, orderId);
  const existingByLineNumber = new Map(existingContext.lines.map((line) => [line.line_number, line]));

  for (const line of lines) {
    const existing = existingByLineNumber.get(line.line_number);

    if (existing) {
      const { error } = await supabase
        .from("retail_pos_order_lines")
        .update({
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
          public_unit_price_snapshot_cents: line.public_unit_price_snapshot_cents,
          wholesale_unit_price_snapshot_cents: line.wholesale_unit_price_snapshot_cents,
          requested_price_tier: line.requested_price_tier,
          price_tier_request_status: line.price_tier_request_status,
          requested_unit_price_cents: line.requested_unit_price_cents,
          requested_by_pos_user_id: line.requested_by_pos_user_id,
          requested_at: line.requested_at,
          approved_price_tier: line.approved_price_tier,
          approved_unit_price_cents: line.approved_unit_price_cents,
          approved_price_tier_source: line.approved_price_tier_source,
          approved_by_pos_user_id: line.approved_by_pos_user_id,
          approved_at: line.approved_at,
          unit_cost_snapshot_cents: line.unit_cost_snapshot_cents,
          discount_cents: line.discount_cents,
        })
        .eq("tenant_id", tenantId)
        .eq("id", existing.id);

      if (error) {
        throw new RetailPosRuntimeError(400, `Unable to update retail_pos line ${line.line_number}: ${error.message}`);
      }

      existingByLineNumber.delete(line.line_number);
      continue;
    }

    const { error } = await supabase.from("retail_pos_order_lines").insert({
      tenant_id: tenantId,
      order_id: orderId,
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
      public_unit_price_snapshot_cents: line.public_unit_price_snapshot_cents,
      wholesale_unit_price_snapshot_cents: line.wholesale_unit_price_snapshot_cents,
      requested_price_tier: line.requested_price_tier,
      price_tier_request_status: line.price_tier_request_status,
      requested_unit_price_cents: line.requested_unit_price_cents,
      requested_by_pos_user_id: line.requested_by_pos_user_id,
      requested_at: line.requested_at,
      approved_price_tier: line.approved_price_tier,
      approved_unit_price_cents: line.approved_unit_price_cents,
      approved_price_tier_source: line.approved_price_tier_source,
      approved_by_pos_user_id: line.approved_by_pos_user_id,
      approved_at: line.approved_at,
      unit_cost_snapshot_cents: line.unit_cost_snapshot_cents,
      line_subtotal_cents: 0,
      discount_cents: line.discount_cents,
      line_total_cents: 0,
    });

    if (error) {
      throw new RetailPosRuntimeError(400, `Unable to insert retail_pos line ${line.line_number}: ${error.message}`);
    }
  }

  for (const line of existingByLineNumber.values()) {
    const { error } = await supabase
      .from("retail_pos_order_lines")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", line.id);

    if (error) {
      throw new RetailPosRuntimeError(400, `Unable to delete retail_pos line ${line.line_number}: ${error.message}`);
    }
  }
}

async function createOrderWithRetry(input: {
  tenantId: string;
  originDeviceRecordId: string;
  createdByPosUserId: string;
  originClientOrderId: string;
  originLocalFolio: string | null;
  copiedFromOrderId: string | null;
}): Promise<OrderRow> {
  const supabase = getSupabaseAdminClient();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const folio = await generateRetailPosFolio(input.tenantId);
    const { data, error } = await supabase
      .from("retail_pos_orders")
      .insert({
        tenant_id: input.tenantId,
        folio,
        origin_client_order_id: input.originClientOrderId,
        origin_local_folio: input.originLocalFolio,
        status: "pending_payment",
        origin_device_id: input.originDeviceRecordId,
        created_by_pos_user_id: input.createdByPosUserId,
        copied_from_order_id: input.copiedFromOrderId,
      })
      .select(
        ORDER_SELECT,
      )
      .limit(1)
      .maybeSingle<OrderRow>();

    if (!error && data) {
      return data;
    }

    if (isUniqueViolation(error, "retail_pos_orders_tenant_folio_uidx")) {
      continue;
    }

    if (isUniqueViolation(error, "retail_pos_orders_tenant_origin_client_order_id_uidx")) {
      const existing = await findOrderByOriginClientOrderId(input.tenantId, input.originClientOrderId);
      if (existing) {
        return existing;
      }
    }

    if (isUniqueViolation(error, "retail_pos_orders_tenant_origin_local_folio_uidx")) {
      if (input.originLocalFolio) {
        const existing = await findOrderByOriginLocalFolio(input.tenantId, input.originLocalFolio);
        if (existing?.origin_client_order_id === input.originClientOrderId) {
          return existing;
        }
      }
      throw new RetailPosRuntimeError(409, "origin_local_folio already exists for a different retail_pos order.");
    }

    throw new RetailPosRuntimeError(400, `Unable to create retail_pos order: ${error?.message ?? "unknown error"}`);
  }

  throw new RetailPosRuntimeError(409, "Unable to allocate a unique retail_pos folio.");
}

async function findOrderByOriginClientOrderId(tenantId: string, originClientOrderId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_orders")
    .select(
      ORDER_SELECT,
    )
    .eq("tenant_id", tenantId)
    .eq("origin_client_order_id", originClientOrderId)
    .limit(1)
    .maybeSingle<OrderRow>();

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to resolve retail_pos order idempotency: ${error.message}`);
  }

  return data ?? null;
}

async function findOrderByOriginLocalFolio(tenantId: string, originLocalFolio: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_orders")
    .select(ORDER_SELECT)
    .eq("tenant_id", tenantId)
    .eq("origin_local_folio", originLocalFolio)
    .limit(1)
    .maybeSingle<OrderRow>();

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to resolve retail_pos local folio: ${error.message}`);
  }

  return data ?? null;
}

async function updateOrderOriginLocalFolio(input: {
  tenantId: string;
  orderId: string;
  originLocalFolio: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_orders")
    .update({
      origin_local_folio: input.originLocalFolio,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.orderId)
    .is("origin_local_folio", null)
    .select(ORDER_SELECT)
    .limit(1)
    .maybeSingle<OrderRow>();

  if (error) {
    if (isUniqueViolation(error, "retail_pos_orders_tenant_origin_local_folio_uidx")) {
      throw new RetailPosRuntimeError(409, "origin_local_folio already exists for a different retail_pos order.");
    }
    throw new RetailPosRuntimeError(500, `Unable to update retail_pos local folio: ${error.message}`);
  }

  return data ?? null;
}

async function resolveCreateOriginDeviceId(actor: RetailPosRuntimeActor, request: CreateRetailPosOrderRequest) {
  if (actor.mode === "device") {
    if (!actor.deviceRecordId) {
      throw new RetailPosRuntimeError(400, "Authenticated device is missing internal device reference.");
    }
    return actor.deviceRecordId;
  }

  const originDeviceRecordId = asTrimmedString(request.origin_device_id);
  if (!originDeviceRecordId) {
    throw new RetailPosRuntimeError(400, "origin_device_id is required for session-driven retail_pos order creation.");
  }

  await assertDeviceRecordForTenant(actor.tenantId, originDeviceRecordId);
  return originDeviceRecordId;
}

function assertPendingPaymentStatus(status: string) {
  if (status !== "pending_payment") {
    throw new RetailPosRuntimeError(409, "retail_pos order is not editable unless status=pending_payment.");
  }
}

function assertRetailPosOrderVoidAccess(actor: RetailPosRuntimeActor) {
  if (actor.mode !== "device") {
    return;
  }

  if (actor.deviceRole === "order_station" || actor.deviceRole === "cashier_station" || actor.deviceRole === "backoffice_station" || actor.deviceRole === "multi_station") {
    return;
  }

  throw new RetailPosRuntimeError(
    403,
    "ORDER_VOID_CAPABILITY_REQUIRED",
    "ORDER_VOID_CAPABILITY_REQUIRED",
  );
}

export async function createRetailPosOrder(input: {
  tenantSlug: string;
  request: CreateRetailPosOrderRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<CreateRetailPosOrderResponse> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
    trace: input.trace,
  });

  assertRetailPosOrderEntryAccess(actor);

  if (input.request.tenant_id !== actor.tenantId) {
    throw new RetailPosRuntimeError(400, "tenant_id does not match runtime tenant.");
  }

  const originClientOrderId = asTrimmedString(input.request.origin_client_order_id);
  if (!originClientOrderId) {
    throw new RetailPosRuntimeError(400, "origin_client_order_id is required.");
  }
  const originLocalFolio = normalizeOriginLocalFolio(input.request.origin_local_folio);

  await assertPosUser(actor.tenantId, input.request.created_by_pos_user_id);

  const resolvedLines = await resolveLineSnapshots({
    tenantId: actor.tenantId,
    lines: input.request.lines,
  });
  const originDeviceRecordId = await resolveCreateOriginDeviceId(actor, input.request);
  const existingOrder = await findOrderByOriginClientOrderId(actor.tenantId, originClientOrderId);

  if (existingOrder) {
    const existingDetail = await loadOrderDetail(actor.tenantId, existingOrder.id);

    if (
      existingOrder.created_by_pos_user_id !== input.request.created_by_pos_user_id ||
      existingOrder.origin_device_id !== originDeviceRecordId
    ) {
      throw new RetailPosRuntimeError(
        409,
        "origin_client_order_id already exists with a different retail_pos order payload.",
      );
    }

    if (originLocalFolio) {
      if (existingOrder.origin_local_folio && existingOrder.origin_local_folio !== originLocalFolio) {
        throw new RetailPosRuntimeError(
          409,
          "origin_client_order_id already exists with a different retail_pos order payload.",
        );
      }

      if (!existingOrder.origin_local_folio) {
        const updatedOrder = await updateOrderOriginLocalFolio({
          tenantId: actor.tenantId,
          orderId: existingOrder.id,
          originLocalFolio,
        });
        if (updatedOrder) {
          existingOrder.origin_local_folio = updatedOrder.origin_local_folio;
        } else {
          const reloadedOrder = await findOrderByOriginClientOrderId(actor.tenantId, originClientOrderId);
          if (reloadedOrder?.origin_local_folio && reloadedOrder.origin_local_folio !== originLocalFolio) {
            throw new RetailPosRuntimeError(
              409,
              "origin_client_order_id already exists with a different retail_pos order payload.",
            );
          }
        }
      }
    }

    if (!areResolvedLinesEquivalent(resolvedLines, existingDetail.lines)) {
      if (existingOrder.status !== "pending_payment") {
        throw new RetailPosRuntimeError(
          409,
          "origin_client_order_id already exists with a different retail_pos order payload.",
        );
      }

      await syncOrderLines(actor.tenantId, existingOrder.id, resolvedLines);
    }

    return loadOrderDetail(actor.tenantId, existingOrder.id);
  }

  const createdOrder = await createOrderWithRetry({
    tenantId: actor.tenantId,
    originDeviceRecordId,
    createdByPosUserId: input.request.created_by_pos_user_id,
    originClientOrderId,
    originLocalFolio,
    copiedFromOrderId: input.request.copied_from_order_id ?? null,
  });

  try {
    await insertOrderLines(actor.tenantId, createdOrder.id, resolvedLines);
  } catch (error) {
    await cleanupOrderAfterCreateFailure(actor.tenantId, createdOrder.id);
    throw error;
  }

  return loadOrderDetail(actor.tenantId, createdOrder.id);
}

export async function updateRetailPosOrder(input: {
  tenantSlug: string;
  orderId: string;
  request: UpdateRetailPosOrderRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
}): Promise<GetRetailPosOrderResponse> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
  });

  assertRetailPosOrderEntryAccess(actor);

  if (input.request.tenant_id !== actor.tenantId) {
    throw new RetailPosRuntimeError(400, "tenant_id does not match runtime tenant.");
  }

  if (input.request.order_id !== input.orderId) {
    throw new RetailPosRuntimeError(400, "order_id does not match route parameter.");
  }

  const context = await loadOrderContext(actor.tenantId, input.orderId);
  assertPendingPaymentStatus(context.order.status);

  const resolvedLines = await resolveLineSnapshots({
    tenantId: actor.tenantId,
    lines: input.request.lines,
  });

  try {
    await syncOrderLines(actor.tenantId, input.orderId, resolvedLines);
  } catch (error) {
    await restoreOrderLines(actor.tenantId, input.orderId, context.lines);
    throw error;
  }

  return loadOrderDetail(actor.tenantId, input.orderId);
}

export async function getRetailPosOrderById(input: {
  tenantSlug: string;
  orderId: string;
  deviceId?: string | null;
  deviceSecret?: string | null;
}) {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
  });

  assertRetailPosDeviceRole(actor, ["order_station", "cashier_station", "multi_station"]);
  return loadOrderDetail(actor.tenantId, input.orderId);
}

export async function getRetailPosOrderByFolio(input: {
  tenantSlug: string;
  folio: string;
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

  assertRetailPosDeviceRole(actor, ["order_station", "cashier_station", "multi_station"]);

  const folio = asTrimmedString(input.folio);
  if (!folio) {
    throw new RetailPosRuntimeError(400, "folio is required.");
  }
  const lookup = normalizeRetailPosLookupFolio(folio);

  const byFolioStartedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const loadByField = async (field: "folio" | "origin_local_folio", value: string) => {
    const { data, error } = await runSupabaseReadWithRetry<OrderRow[]>({
      trace: input.trace,
      step: field === "folio" ? "order_lookup_with_header" : "order_lookup_with_local_folio",
      query: (signal) =>
        supabase
          .from("retail_pos_orders")
          .select(ORDER_SELECT)
          .abortSignal(signal)
          .eq("tenant_id", actor.tenantId)
          .eq(field, value)
          .limit(2),
    });

    if (error) {
      throw new RetailPosRuntimeError(500, `Unable to load retail_pos order by folio: ${error.message}`);
    }

    const rows = asArray(data);
    if (rows.length > 1) {
      throw new RetailPosRuntimeError(409, "Multiple retail_pos orders matched the provided folio.");
    }

    return rows[0] ?? null;
  };

  const remoteCandidate = lookup.remote;
  const localCandidate = lookup.local;
  const triedRemote = remoteCandidate ? await loadByField("folio", remoteCandidate) : null;
  const data =
    triedRemote ??
    (localCandidate && (!remoteCandidate || localCandidate !== remoteCandidate || !triedRemote)
      ? await loadByField("origin_local_folio", localCandidate)
      : null);

  if (!data) {
    throw new RetailPosRuntimeError(404, "retail_pos order not found for folio.");
  }

  const detail = await loadOrderDetailFromOrderContext({
    tenantId: actor.tenantId,
    order: data,
    trace: input.trace,
  });

  input.trace?.addDuration(
    "order_by_folio_total",
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      byFolioStartedAt,
  );

  return detail;
}

export async function listRetailPosRecentPendingOrders(input: {
  tenantSlug: string;
  limit?: number;
  deviceId?: string | null;
  deviceSecret?: string | null;
}) {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
  });
  assertRetailPosCashierAccess(actor);

  const limit = Math.max(1, Math.min(5, Math.trunc(input.limit ?? 5)));
  const supabase = getSupabaseAdminClient();
  const { data: orders, error: ordersError } = await supabase
    .from("retail_pos_orders")
    .select("id, folio, created_at, total_cents, revision")
    .eq("tenant_id", actor.tenantId)
    .eq("status", "pending_payment")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit)
    .returns<Array<Pick<RetailPosRecentPendingOrderSummary, "order_id" | "folio" | "created_at" | "total_cents" | "revision"> & { id: string }>>();

  if (ordersError) {
    throw new RetailPosRuntimeError(500, `Unable to load recent pending retail_pos orders: ${ordersError.message}`);
  }

  const orderRows = orders ?? [];
  if (orderRows.length === 0) {
    return { items: [] satisfies RetailPosRecentPendingOrderSummary[] };
  }

  const orderIds = orderRows.map((order) => order.id);
  const { data: lines, error: linesError } = await supabase
    .from("retail_pos_order_lines")
    .select("order_id, price_tier_request_status")
    .eq("tenant_id", actor.tenantId)
    .in("order_id", orderIds)
    .returns<Array<{ order_id: string; price_tier_request_status: string | null }>>();

  if (linesError) {
    throw new RetailPosRuntimeError(500, `Unable to load recent pending retail_pos order summaries: ${linesError.message}`);
  }

  const lineSummary = new Map<string, { count: number; hasPendingWholesale: boolean }>();
  for (const line of lines ?? []) {
    const current = lineSummary.get(line.order_id) ?? { count: 0, hasPendingWholesale: false };
    current.count += 1;
    current.hasPendingWholesale ||= line.price_tier_request_status === "pending";
    lineSummary.set(line.order_id, current);
  }

  return {
    items: orderRows.map((order) => {
      const summary = lineSummary.get(order.id) ?? { count: 0, hasPendingWholesale: false };
      return {
        order_id: order.id,
        folio: order.folio,
        created_at: order.created_at,
        total_cents: order.total_cents,
        line_count: summary.count,
        has_pending_wholesale: summary.hasPendingWholesale,
        revision: order.revision,
      } satisfies RetailPosRecentPendingOrderSummary;
    }),
  };
}

export async function voidRetailPosOrder(input: {
  tenantSlug: string;
  orderId: string;
  request: VoidRetailPosOrderRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
}) {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
  });

  assertRetailPosOrderVoidAccess(actor);

  if (input.request.tenant_id !== actor.tenantId) {
    throw new RetailPosRuntimeError(400, "tenant_id does not match runtime tenant.");
  }

  if (input.request.order_id !== input.orderId) {
    throw new RetailPosRuntimeError(400, "order_id does not match route parameter.");
  }

  if (typeof input.request.expected_revision !== 'number' || !Number.isInteger(input.request.expected_revision) || input.request.expected_revision < 0) {
    throw new RetailPosRuntimeError(400, "expected_revision is required.");
  }

  const validReasons = new Set(["capture_error", "order_modification", "customer_withdrew", "duplicate_order", "product_unavailable", "other"]);
  if (!validReasons.has(input.request.void_reason ?? "")) {
    throw new RetailPosRuntimeError(400, "void_reason is invalid.");
  }

  await assertPosUser(actor.tenantId, input.request.voided_by_pos_user_id);

  const context = await loadOrderContext(actor.tenantId, input.orderId);
  if (context.order.status === "voided") {
    return loadOrderDetail(actor.tenantId, input.orderId);
  }

  if (context.order.status !== "pending_payment") {
    throw new RetailPosRuntimeError(409, "ORDER_NOT_VOIDABLE", "ORDER_NOT_VOIDABLE");
  }

  const supabase = getSupabaseAdminClient();
  const voidedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("retail_pos_orders")
    .update({
      status: "voided",
      voided_at: voidedAt,
      voided_by_pos_user_id: input.request.voided_by_pos_user_id,
      void_reason: input.request.void_reason,
      void_note: input.request.void_note ?? null,
      revision: input.request.expected_revision + 1,
    })
    .eq("tenant_id", actor.tenantId)
    .eq("id", input.orderId)
    .eq("status", "pending_payment")
    .eq("revision", input.request.expected_revision)
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new RetailPosRuntimeError(
      409,
      `Unable to void retail_pos order: ${error.message}`,
      "ORDER_VOID_CONFLICT",
    );
  }

  if (!data) {
    throw new RetailPosRuntimeError(409, "ORDER_VOID_CONFLICT", "ORDER_VOID_CONFLICT");
  }

  return loadOrderDetail(actor.tenantId, input.orderId);
}
