import { createHash } from "node:crypto";
import type {
  PayRetailPosOrderRequest,
  PayRetailPosOrderResponse,
  RetailPosOrder,
  RetailPosPayCommand,
  RetailPosPayCommandResult,
} from "@/shared/types/retail-pos";
import {
  normalizeRetailPosPaymentTenders,
  type RetailPosPaymentTenderDraft,
} from "@/shared/retail-pos/mixed-payments";
import { buildRetailPosPaymentEvidence } from "./payment-evidence";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertRetailPosCashierAccess,
  resolveRetailPosRuntimeActor,
  resolveRetailPosTargetDevice,
} from "./auth";
import { getOpenRetailPosCashShiftForDevice } from "./cash-shifts";
import { RetailPosRuntimeError } from "./errors";
import type { RuntimePerfTrace } from "./runtime-perf";
import { runSupabaseReadWithRetry } from "./runtime-supabase-retry";

type PosUserRow = {
  id: string;
  tenant_id: string;
  is_active: boolean;
};

type OrderRow = RetailPosOrder;

type CashShiftRow = {
  id: string;
  tenant_id: string;
  kiosk_id: string;
  device_id: string;
  opened_by_pos_user_id: string;
  closed_by_pos_user_id: string | null;
  status: string;
  opening_float_cents: number;
  expected_cash_cents: number | null;
  declared_cash_cents: number | null;
  difference_cents: number | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

const ORDER_SELECT =
  "id, tenant_id, folio, origin_client_order_id, origin_local_folio, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, total_cents, revision, paid_at, cancelled_at, cancelled_by_pos_user_id, cancel_reason, created_at, updated_at, created_by, updated_by";

function buildNormalCheckoutCommandId(input: {
  tenantId: string;
  orderId: string;
  deviceId: string;
  posUserId: string;
  cashShiftId: string;
  paymentMethod: string;
  amountCents: number;
  receivedAmountCents: number | null;
  cardReference: string | null;
}) {
  return `pay_${createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")}`;
}

function normalizePaymentRequest(request: PayRetailPosOrderRequest) {
  const hasTenders = "tenders" in request && request.tenders !== undefined;
  const hasLegacy = "payment_method" in request;
  if (hasTenders === hasLegacy) {
    throw new RetailPosRuntimeError(400, "PAYMENT_INPUT_AMBIGUOUS");
  }
  const tenders: RetailPosPaymentTenderDraft[] = hasTenders
    ? request.tenders
    : [{
        sequence: 1,
        method: request.payment_method,
        amount_cents: request.amount_cents,
        received_amount_cents: request.received_amount_cents,
        reference: request.card_reference,
      }];
  const normalized = normalizeRetailPosPaymentTenders(tenders);
  if (!normalized.ok) {
    const code = normalized.errors[0]?.code ?? "PAYMENT_TENDERS_INVALID_JSON";
    throw new RetailPosRuntimeError(400, code, code);
  }
  return normalized.tenders;
}

function normalizeRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new RetailPosRuntimeError(400, `${field} is required.`);
  }

  return value.trim();
}

async function assertPosUser(
  tenantId: string,
  posUserId: string,
  trace?: RuntimePerfTrace,
) {
  const supabase = getSupabaseAdminClient({ trace });
  const { data, error } = await runSupabaseReadWithRetry<PosUserRow>({
    trace,
    step: "pos_user_lookup",
    query: (signal) =>
      supabase
        .from("pos_users")
        .select("id, tenant_id, is_active")
        .abortSignal(signal)
        .eq("tenant_id", tenantId)
        .eq("id", posUserId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle<PosUserRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load POS user: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(400, "POS user is not active for this tenant.");
  }

  return data;
}

async function loadOrderForPayment(
  tenantId: string,
  orderId: string,
  trace?: RuntimePerfTrace,
) {
  const supabase = getSupabaseAdminClient({ trace });
  const { data, error } = await runSupabaseReadWithRetry<OrderRow>({
    trace,
    step: "payment_order_lookup",
    query: (signal) =>
      supabase
        .from("retail_pos_orders")
        .select(ORDER_SELECT)
        .abortSignal(signal)
        .eq("tenant_id", tenantId)
        .eq("id", orderId)
        .limit(1)
        .maybeSingle<OrderRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos order: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(404, "retail_pos order not found.");
  }

  return data;
}

function addPayTotalTrace(trace: RuntimePerfTrace | undefined, startedAt: number) {
  trace?.addDuration(
    "pay_total",
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      startedAt,
  );
}

function requireCurrentOrderRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new RetailPosRuntimeError(500, "ORDER_REVISION_UNAVAILABLE", "ORDER_REVISION_UNAVAILABLE");
  }
  return value as number;
}

function requireExpectedOrderRevision(value: unknown): number {
  if (value === null || value === undefined) {
    throw new RetailPosRuntimeError(422, "ORDER_REVISION_REQUIRED", "ORDER_REVISION_REQUIRED");
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new RetailPosRuntimeError(422, "ORDER_REVISION_INVALID", "ORDER_REVISION_INVALID");
  }
  return value as number;
}

async function loadCashShiftByIdForPayment(input: {
  tenantId: string;
  shiftId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<CashShiftRow>({
    trace: input.trace,
    step: "cash_shift_id_validation",
    query: (signal) =>
      supabase
        .from("retail_pos_cash_shifts")
        .select(
          "id, tenant_id, kiosk_id, device_id, opened_by_pos_user_id, closed_by_pos_user_id, status, opening_float_cents, expected_cash_cents, declared_cash_cents, difference_cents, opened_at, closed_at, created_at, updated_at, created_by, updated_by",
        )
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.shiftId)
        .limit(1)
        .maybeSingle<CashShiftRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos cash shift: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(404, "retail_pos cash shift not found.");
  }

  return data;
}

export async function payRetailPosOrder(input: {
  tenantSlug: string;
  orderId: string;
  request: PayRetailPosOrderRequest;
  commandId?: string;
  commandReplayRef?: { current: boolean };
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<PayRetailPosOrderResponse> {
  const payStartedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const actor = await resolveRetailPosRuntimeActor(input);
  assertRetailPosCashierAccess(actor);

  if (input.request.tenant_id !== actor.tenantId) {
    throw new RetailPosRuntimeError(400, "tenant_id does not match runtime tenant.");
  }

  if (input.request.order_id !== input.orderId) {
    throw new RetailPosRuntimeError(400, "order_id does not match route parameter.");
  }

  await assertPosUser(actor.tenantId, input.request.pos_user_id, input.trace);

  const targetDevice = await resolveRetailPosTargetDevice({
    actor,
    deviceRecordId: input.request.device_id ?? null,
    requiredRole: ["cashier_station", "multi_station"],
  });

  const requestedCashShiftId =
    typeof input.request.cash_shift_id === "string" && input.request.cash_shift_id.trim()
      ? input.request.cash_shift_id.trim()
      : null;

  const currentOpenShift = requestedCashShiftId
    ? await loadCashShiftByIdForPayment({
        tenantId: actor.tenantId,
        shiftId: requestedCashShiftId,
        trace: input.trace,
      })
    : await getOpenRetailPosCashShiftForDevice({
        tenantId: actor.tenantId,
        deviceRecordId: targetDevice.deviceRecordId,
        trace: input.trace,
      });

  if (!requestedCashShiftId) {
    input.trace?.addDuration(
      "current_shift_fallback_lookup",
      input.trace?.getDuration("shift_lookup") ?? 0,
    );
  }

  if (!currentOpenShift) {
    throw new RetailPosRuntimeError(409, "An open retail_pos cash shift is required before collecting payment.");
  }

  const shiftValidationStartedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  if (currentOpenShift.tenant_id !== actor.tenantId) {
    throw new RetailPosRuntimeError(409, "retail_pos cash shift does not belong to the runtime tenant.");
  }

  if (currentOpenShift.device_id !== targetDevice.deviceRecordId) {
    throw new RetailPosRuntimeError(409, "retail_pos cash shift does not belong to the runtime device.");
  }

  if (currentOpenShift.status !== "open") {
    throw new RetailPosRuntimeError(409, "An open retail_pos cash shift is required before collecting payment.");
  }

  input.trace?.addDuration(
    "shift_validation",
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      shiftValidationStartedAt,
  );

  const order = await loadOrderForPayment(actor.tenantId, input.orderId, input.trace);

  if (order.status !== "paid" && (order.status === "cancelled" || order.status === "voided")) {
    throw new RetailPosRuntimeError(409, "Voided retail_pos orders cannot be paid.");
  }

  if (order.status !== "paid" && order.status !== "pending_payment") {
    throw new RetailPosRuntimeError(409, "Only pending_payment retail_pos orders can be paid.");
  }

  const expectedOrderRevision = requireExpectedOrderRevision(input.request.expected_order_revision);
  const currentOrderRevision = requireCurrentOrderRevision(order.revision);
  if (expectedOrderRevision !== currentOrderRevision) {
    throw new RetailPosRuntimeError(409, "La orden cambió desde que fue cargada.", "ORDER_REVISION_CONFLICT", {
      expected_revision: expectedOrderRevision,
      current_revision: currentOrderRevision,
    });
  }

  const tenders = normalizePaymentRequest(input.request);
  const amountCents = tenders.reduce((sum, tender) => sum + tender.amount_cents, 0);
  if (amountCents !== order.total_cents) {
    throw new RetailPosRuntimeError(409, "PAYMENT_AMOUNT_MISMATCH");
  }

  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const commandId =
    input.commandId ??
    buildNormalCheckoutCommandId({
      tenantId: actor.tenantId,
      orderId: input.orderId,
      deviceId: targetDevice.deviceRecordId,
      posUserId: input.request.pos_user_id,
      cashShiftId: currentOpenShift.id,
      paymentMethod: tenders.map((tender) => `${tender.method}:${tender.amount_cents}:${tender.received_amount_cents ?? ""}:${tender.reference ?? ""}`).join("|"),
      amountCents,
      receivedAmountCents: null,
      cardReference: null,
    });
  const rpcStartedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const { data, error } = await supabase.rpc("retail_pos_checkout_order_normal_v2", {
    p_tenant_id: actor.tenantId,
    p_device_id: targetDevice.deviceRecordId,
    p_payload: {
      command_id: commandId,
      order_id: input.orderId,
      cash_shift_id: currentOpenShift.id,
      operator_id: input.request.pos_user_id,
      expected_order_revision: currentOrderRevision,
      tenders,
    },
  });
  const rpcDurationMs =
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
    rpcStartedAt;
  input.trace?.recordSupabaseDuration(rpcDurationMs);
  input.trace?.addDuration("normal_checkout_rpc", rpcDurationMs);

  if (error) {
    const rpcCode = typeof error.message === "string" && /^[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "PAYMENT_RPC_FAILED";
    input.trace?.log({
      step: "normal_checkout_rpc_error",
      ok: false,
      status: 400,
      extra: {
        rpc: "retail_pos_checkout_order_normal_v2",
        rpc_code: rpcCode,
        order_id: input.orderId,
        expected_order_revision: order.revision,
        total_cents: order.total_cents,
        tender_count: tenders.length,
        tenders: tenders.map((tender) => ({
          sequence: tender.sequence,
          method: tender.method,
          amount_cents: tender.amount_cents,
          received_amount_cents: tender.received_amount_cents,
          reference_present: Boolean(tender.reference),
        })),
      },
      error,
    });
    const status =
      error.message === "ORDER_NOT_FOUND"
        ? 404
        : [
              "PAYMENT_INVALID",
              "PAYMENT_OPERATOR_INVALID",
              "PAYMENT_ORDER_ID_REQUIRED",
              "PAYMENT_COMMAND_ID_REQUIRED",
              "ORDER_REVISION_REQUIRED",
              "ORDER_REVISION_INVALID",
              "PAYMENT_TOTAL_INVALID",
              "HISTORICAL_SALE_LINE_INVALID",
            "HISTORICAL_COST_REQUIRED",
            "HISTORICAL_SALE_LINES_REQUIRED",
          ].includes(error.message)
          ? 422
          : rpcCode === "PAYMENT_RPC_FAILED"
            ? 500
          : 409;
    throw new RetailPosRuntimeError(status, rpcCode, rpcCode, {
      source: "retail_pos_checkout_order_normal_v2",
      postgres_code: typeof error.code === "string" ? error.code : null,
    });
  }

  if (!data || typeof data !== "object" || !("result" in data)) {
    throw new RetailPosRuntimeError(500, "retail_pos normal checkout did not return a result.");
  }

  if (input.commandReplayRef) {
    input.commandReplayRef.current = (data as { status?: string }).status === "replayed";
  }
  const response = (data as { result: PayRetailPosOrderResponse }).result;
  if (!Array.isArray(response.payments) || response.payments.length < 1 || response.payments.length > 2) {
    throw new RetailPosRuntimeError(500, "PAYMENT_RESPONSE_INVALID");
  }
  response.payment = response.payments.length === 1 ? response.payments[0] ?? null : null;
  response.payment_evidence = buildRetailPosPaymentEvidence({
    order: response.order,
    lines: [],
    paymentTransaction: response.payment_transaction ?? null,
    application: response.application ?? null,
    payments: response.payments.map((payment) => ({
      ...payment,
      payment_transaction_id: payment.payment_transaction_id ?? null,
      payment_sequence: payment.payment_sequence ?? null,
    })),
  });
  addPayTotalTrace(input.trace, payStartedAt);
  return response;
}

export async function payRetailPosOrderCommand(input: {
  tenantSlug: string;
  command: RetailPosPayCommand;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosPayCommandResult> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
    trace: input.trace,
  });

  if (actor.mode !== "device" || !actor.deviceRecordId || !actor.devicePublicId) {
    throw new RetailPosRuntimeError(401, "device auth is required for retail_pos payment commands.");
  }

  if (input.command.command_type !== "pay") {
    throw new RetailPosRuntimeError(400, "command_type must be pay.");
  }

  const commandId = normalizeRequiredString(input.command.command_id, "command_id");
  const devicePublicId = normalizeRequiredString(input.command.device_id, "device_id");
  const operatorId = normalizeRequiredString(input.command.operator_id, "operator_id");
  const cashShiftId = normalizeRequiredString(input.command.cash_shift_id, "cash_shift_id");
  const payload = input.command.payload;

  if (!payload || typeof payload !== "object") {
    throw new RetailPosRuntimeError(400, "payload is required.");
  }

  const orderId = normalizeRequiredString(payload.order_id, "payload.order_id");

  if (devicePublicId !== actor.devicePublicId) {
    throw new RetailPosRuntimeError(409, "command device_id does not match authenticated retail_pos device.");
  }

  const replayRef = { current: false };
  const paymentRequest = (Array.isArray(payload.tenders)
    ? {
        tenant_id: actor.tenantId,
        order_id: orderId,
        cash_shift_id: cashShiftId,
        device_id: actor.deviceRecordId,
        pos_user_id: operatorId,
        expected_order_revision: payload.expected_order_revision,
        tenders: payload.tenders,
      }
    : {
        tenant_id: actor.tenantId,
        order_id: orderId,
        cash_shift_id: cashShiftId,
        device_id: actor.deviceRecordId,
        pos_user_id: operatorId,
        expected_order_revision: payload.expected_order_revision,
        payment_method: payload.payment_method,
        amount_cents: payload.amount_cents,
        received_amount_cents: payload.received_amount_cents,
        card_reference: payload.card_reference,
      }) as PayRetailPosOrderRequest;
  const paymentResponse = await payRetailPosOrder({
    tenantSlug: input.tenantSlug,
    orderId,
    commandId,
    commandReplayRef: replayRef,
    request: paymentRequest,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
    trace: input.trace,
  });

  return {
    command_id: commandId,
    command_type: "pay",
    status: replayRef.current ? "replayed" : "completed",
    idempotent_replay: replayRef.current,
    device_id: actor.deviceRecordId,
    operator_id: operatorId,
    cash_shift_id: cashShiftId,
    result: paymentResponse,
    server_time: new Date().toISOString(),
  } satisfies RetailPosPayCommandResult;
}
