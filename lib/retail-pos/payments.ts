import { createHash } from "node:crypto";
import type {
  PayRetailPosOrderRequest,
  PayRetailPosOrderResponse,
  RetailPosOrder,
  RetailPosPayCommand,
  RetailPosPayCommandResult,
} from "@/shared/types/retail-pos";
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
  "id, tenant_id, folio, origin_client_order_id, origin_local_folio, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, total_cents, paid_at, cancelled_at, cancelled_by_pos_user_id, cancel_reason, created_at, updated_at, created_by, updated_by";

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

function ensureNonNegativeInteger(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new RetailPosRuntimeError(400, `${field} must be a non-negative integer.`);
  }

  return value;
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

  const amountCents = ensureNonNegativeInteger(input.request.amount_cents, "amount_cents");
  if (amountCents <= 0) {
    throw new RetailPosRuntimeError(400, "amount_cents must be greater than zero.");
  }

  if (!input.commandId && amountCents !== order.total_cents) {
    throw new RetailPosRuntimeError(409, "amount_cents must equal retail_pos order total_cents in phase 1.");
  }

  let receivedAmountCents: number | null = null;
  if (input.request.payment_method === "cash") {
    receivedAmountCents = ensureNonNegativeInteger(
      input.request.received_amount_cents,
      "received_amount_cents",
    );

    if (receivedAmountCents < amountCents) {
      throw new RetailPosRuntimeError(400, "received_amount_cents must be greater than or equal to amount_cents for cash payments.");
    }

  } else if (input.request.payment_method === "card") {
    if (input.request.received_amount_cents !== null) {
      throw new RetailPosRuntimeError(400, "received_amount_cents must be null for card payments.");
    }
  } else {
    throw new RetailPosRuntimeError(400, "payment_method must be cash or card.");
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
      paymentMethod: input.request.payment_method,
      amountCents,
      receivedAmountCents,
      cardReference: input.request.card_reference,
    });
  const rpcStartedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const { data, error } = await supabase.rpc("retail_pos_checkout_order_normal_v1", {
    p_tenant_id: actor.tenantId,
    p_device_id: targetDevice.deviceRecordId,
    p_payload: {
      command_id: commandId,
      order_id: input.orderId,
      cash_shift_id: currentOpenShift.id,
      operator_id: input.request.pos_user_id,
      payment_method: input.request.payment_method,
      amount_cents: amountCents,
      received_amount_cents: receivedAmountCents,
      card_reference: input.request.card_reference,
    },
  });
  const rpcDurationMs =
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
    rpcStartedAt;
  input.trace?.recordSupabaseDuration(rpcDurationMs);
  input.trace?.addDuration("normal_checkout_rpc", rpcDurationMs);

  if (error) {
    const status =
      error.message === "ORDER_NOT_FOUND"
        ? 404
        : [
              "PAYMENT_INVALID",
              "HISTORICAL_SALE_LINE_INVALID",
              "HISTORICAL_COST_REQUIRED",
              "HISTORICAL_SALE_LINES_REQUIRED",
            ].includes(error.message)
          ? 422
          : 409;
    throw new RetailPosRuntimeError(status, error.message);
  }

  if (!data || typeof data !== "object" || !("result" in data)) {
    throw new RetailPosRuntimeError(500, "retail_pos normal checkout did not return a result.");
  }

  if (input.commandReplayRef) {
    input.commandReplayRef.current = (data as { status?: string }).status === "replayed";
  }
  const response = (data as { result: PayRetailPosOrderResponse }).result;
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
  const paymentResponse = await payRetailPosOrder({
    tenantSlug: input.tenantSlug,
    orderId,
    commandId,
    commandReplayRef: replayRef,
    request: {
      tenant_id: actor.tenantId,
      order_id: orderId,
      cash_shift_id: cashShiftId,
      device_id: actor.deviceRecordId,
      pos_user_id: operatorId,
      payment_method: payload.payment_method,
      amount_cents: payload.amount_cents,
      received_amount_cents: payload.received_amount_cents,
      card_reference: payload.card_reference,
    },
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
