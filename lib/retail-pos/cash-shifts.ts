import type {
  CloseRetailPosCashShiftRequest,
  CloseRetailPosCashShiftResponse,
  OpenRetailPosCashShiftRequest,
  OpenRetailPosCashShiftResponse,
  RetailPosCashShift,
  RetailPosCashShiftCloseSummary,
  RetailPosCashShiftCloseSummaryResponse,
  RetailPosCurrentCashShiftResponse,
  RetailPosDaySummaryResponse,
} from "@/shared/types/retail-pos";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertRetailPosCashierAccess,
  resolveRetailPosRuntimeActor,
  resolveRetailPosTargetDevice,
  type RetailPosRuntimeActor,
} from "./auth";
import { RetailPosRuntimeError } from "./errors";
import type { RuntimePerfTrace } from "./runtime-perf";
import { runSupabaseReadWithRetry } from "./runtime-supabase-retry";

type PosUserRow = {
  id: string;
  tenant_id: string;
  is_active: boolean;
};

type KioskRow = {
  id: string;
  tenant_id: string;
  is_active: boolean;
};

type CashShiftRow = RetailPosCashShift;

type PaymentSummaryRow = {
  amount_cents: number;
  payment_method: "cash" | "card";
};

function normalizeClosingNote(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 1000) : null;
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requireRuntimeTargetValue(value: string | null | undefined, field: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new RetailPosRuntimeError(400, `${field} is required for session-driven retail_pos runtime operations.`);
  }

  return normalized;
}

function ensureNonNegativeInteger(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new RetailPosRuntimeError(400, `${field} must be a non-negative integer.`);
  }

  return value;
}

function getBusinessDayBounds(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    businessDate: start.toISOString().slice(0, 10),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

async function assertPosUser(tenantId: string, posUserId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pos_users")
    .select("id, tenant_id, is_active")
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

async function assertKiosk(tenantId: string, kioskId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("kiosks")
    .select("id, tenant_id, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", kioskId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle<KioskRow>();

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load kiosk: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(400, "Kiosk is not active for this tenant.");
  }

  return data;
}

export async function getOpenRetailPosCashShiftForDevice(input: {
  tenantId: string;
  deviceRecordId: string;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosCashShift | null> {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<CashShiftRow>({
    trace: input.trace,
    step: "shift_lookup",
    query: (signal) =>
      supabase
        .from("retail_pos_cash_shifts")
        .select(
          "id, tenant_id, kiosk_id, device_id, opened_by_pos_user_id, closed_by_pos_user_id, status, opening_float_cents, expected_cash_cents, declared_cash_cents, difference_cents, closing_note, opened_at, closed_at, created_at, updated_at, created_by, updated_by",
        )
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("device_id", input.deviceRecordId)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle<CashShiftRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load current retail_pos cash shift: ${error.message}`);
  }

  return data ?? null;
}

async function loadRetailPosCashShiftById(input: {
  tenantId: string;
  shiftId: string;
}): Promise<RetailPosCashShift> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_cash_shifts")
    .select(
      "id, tenant_id, kiosk_id, device_id, opened_by_pos_user_id, closed_by_pos_user_id, status, opening_float_cents, expected_cash_cents, declared_cash_cents, difference_cents, closing_note, opened_at, closed_at, created_at, updated_at, created_by, updated_by",
    )
    .eq("tenant_id", input.tenantId)
    .eq("id", input.shiftId)
    .limit(1)
    .maybeSingle<CashShiftRow>();

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos cash shift: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(404, "retail_pos cash shift not found.");
  }

  return data;
}

async function computeExpectedCashCents(tenantId: string, cashShiftId: string, openingFloatCents: number) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_payments")
    .select("amount_cents, payment_method")
    .eq("tenant_id", tenantId)
    .eq("cash_shift_id", cashShiftId)
    .eq("payment_method", "cash");

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to compute expected retail_pos cash: ${error.message}`);
  }

  const cashPaymentsCents = ((data ?? []) as PaymentSummaryRow[]).reduce(
    (sum: number, row: PaymentSummaryRow) => sum + row.amount_cents,
    0,
  );
  return openingFloatCents + cashPaymentsCents;
}

async function buildRetailPosCashShiftCloseSummary(input: {
  tenantId: string;
  cashShift: RetailPosCashShift;
}): Promise<RetailPosCashShiftCloseSummary> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_payments")
    .select("amount_cents, payment_method")
    .eq("tenant_id", input.tenantId)
    .eq("cash_shift_id", input.cashShift.id);

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos cash shift payments summary: ${error.message}`);
  }

  const payments = (data ?? []) as PaymentSummaryRow[];
  const cashSalesCents = payments
    .filter((payment) => payment.payment_method === "cash")
    .reduce((sum, payment) => sum + payment.amount_cents, 0);
  const cardSalesCents = payments
    .filter((payment) => payment.payment_method === "card")
    .reduce((sum, payment) => sum + payment.amount_cents, 0);
  const expectedCashCents =
    typeof input.cashShift.expected_cash_cents === "number"
      ? input.cashShift.expected_cash_cents
      : input.cashShift.opening_float_cents + cashSalesCents;

  return {
    cash_shift_id: input.cashShift.id,
    tenant_id: input.cashShift.tenant_id,
    kiosk_id: input.cashShift.kiosk_id,
    device_id: input.cashShift.device_id,
    status: input.cashShift.status,
    opened_at: input.cashShift.opened_at,
    closed_at: input.cashShift.closed_at,
    opening_cash_cents: input.cashShift.opening_float_cents,
    cash_sales_cents: cashSalesCents,
    card_sales_cents: cardSalesCents,
    total_sales_cents: cashSalesCents + cardSalesCents,
    expected_cash_cents: expectedCashCents,
    declared_cash_cents: input.cashShift.declared_cash_cents,
    difference_cents: input.cashShift.difference_cents,
    payments_count: payments.length,
    closing_note: input.cashShift.closing_note ?? null,
  };
}

function assertCashierSessionOrDevice(actor: RetailPosRuntimeActor) {
  if (actor.mode === "device") {
    assertRetailPosCashierAccess(actor);
  }
}

export async function getRetailPosCashShiftCloseSummary(input: {
  tenantSlug: string;
  shiftId: string;
  deviceId?: string | null;
  deviceSecret?: string | null;
}): Promise<RetailPosCashShiftCloseSummaryResponse> {
  const actor = await resolveRetailPosRuntimeActor(input);
  assertCashierSessionOrDevice(actor);

  if (actor.mode !== "device") {
    throw new RetailPosRuntimeError(400, "retail_pos cash shift summary requires device-auth runtime mode.");
  }

  const targetDevice = await resolveRetailPosTargetDevice({
    actor,
    deviceRecordId: null,
    requiredRole: ["cashier_station", "multi_station"],
  });

  const cashShift = await loadRetailPosCashShiftById({
    tenantId: actor.tenantId,
    shiftId: input.shiftId,
  });

  if (cashShift.device_id !== targetDevice.deviceRecordId) {
    throw new RetailPosRuntimeError(403, "retail_pos cash shift does not belong to the resolved device.");
  }

  const summary = await buildRetailPosCashShiftCloseSummary({
    tenantId: actor.tenantId,
    cashShift,
  });

  return { summary };
}

export async function openRetailPosCashShift(input: {
  tenantSlug: string;
  request: OpenRetailPosCashShiftRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<OpenRetailPosCashShiftResponse> {
  const actor = await resolveRetailPosRuntimeActor(input);
  assertCashierSessionOrDevice(actor);

  if (input.request.tenant_id !== actor.tenantId) {
    throw new RetailPosRuntimeError(400, "tenant_id does not match runtime tenant.");
  }

  await assertPosUser(actor.tenantId, input.request.opened_by_pos_user_id);

  const requestedKioskId =
    actor.mode === "device"
      ? input.request.kiosk_id ?? null
      : requireRuntimeTargetValue(input.request.kiosk_id ?? null, "kiosk_id");

  const targetDevice = await resolveRetailPosTargetDevice({
    actor,
    deviceRecordId: actor.mode === "device" ? null : input.request.device_id,
    requiredRole: ["cashier_station", "multi_station"],
  });

  const kioskId: string =
    actor.mode === "device"
      ? targetDevice.kioskId
      : requireRuntimeTargetValue(requestedKioskId, "kiosk_id");

  await assertKiosk(actor.tenantId, kioskId);

  const existingOpenShift = await getOpenRetailPosCashShiftForDevice({
    tenantId: actor.tenantId,
    deviceRecordId: targetDevice.deviceRecordId,
    trace: input.trace,
  });
  if (input.trace?.getDuration("shift_lookup")) {
    input.trace.addDuration(
      "existing_shift_lookup",
      input.trace.getDuration("shift_lookup") ?? 0,
    );
  }

  if (existingOpenShift) {
    return { cash_shift: existingOpenShift };
  }

  const openingFloatCents = ensureNonNegativeInteger(
    input.request.opening_float_cents,
    "opening_float_cents",
  );

  const openedAt = asTrimmedString(input.request.opened_at) ?? new Date().toISOString();
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const insertStartedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const { data, error } = await supabase
    .from("retail_pos_cash_shifts")
    .insert({
      tenant_id: actor.tenantId,
      kiosk_id: kioskId,
      device_id: targetDevice.deviceRecordId,
      opened_by_pos_user_id: input.request.opened_by_pos_user_id,
      status: "open",
      opening_float_cents: openingFloatCents,
      opened_at: openedAt,
    })
    .select(
      "id, tenant_id, kiosk_id, device_id, opened_by_pos_user_id, closed_by_pos_user_id, status, opening_float_cents, expected_cash_cents, declared_cash_cents, difference_cents, closing_note, opened_at, closed_at, created_at, updated_at, created_by, updated_by",
    )
    .limit(1)
    .maybeSingle<CashShiftRow>();
  const insertDurationMs =
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
    insertStartedAt;
  input.trace?.recordSupabaseDuration(insertDurationMs);
  input.trace?.addDuration("shift_insert", insertDurationMs);

  if (error) {
    if (error.code === "23505") {
      const openShift = await getOpenRetailPosCashShiftForDevice({
        tenantId: actor.tenantId,
        deviceRecordId: targetDevice.deviceRecordId,
        trace: input.trace,
      });
      if (input.trace?.getDuration("shift_lookup")) {
        input.trace.addDuration(
          "shift_reload",
          input.trace.getDuration("shift_lookup") ?? 0,
        );
      }

      if (openShift) {
        return { cash_shift: openShift };
      }
    }

    throw new RetailPosRuntimeError(400, `Unable to open retail_pos cash shift: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(500, "retail_pos cash shift insert did not return a record.");
  }

  return { cash_shift: data };
}

export async function getCurrentRetailPosCashShift(input: {
  tenantSlug: string;
  deviceRecordId?: string | null;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosCurrentCashShiftResponse> {
  const actor = await resolveRetailPosRuntimeActor(input);
  assertCashierSessionOrDevice(actor);

  const targetDevice = await resolveRetailPosTargetDevice({
    actor,
    deviceRecordId: input.deviceRecordId,
    requiredRole: ["cashier_station", "multi_station"],
  });

  const cashShift = await getOpenRetailPosCashShiftForDevice({
    tenantId: actor.tenantId,
    deviceRecordId: targetDevice.deviceRecordId,
    trace: input.trace,
  });

  return { cash_shift: cashShift };
}

export async function closeRetailPosCashShift(input: {
  tenantSlug: string;
  shiftId: string;
  request: CloseRetailPosCashShiftRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<CloseRetailPosCashShiftResponse> {
  const actor = await resolveRetailPosRuntimeActor(input);
  assertCashierSessionOrDevice(actor);

  if (input.request.tenant_id !== actor.tenantId) {
    throw new RetailPosRuntimeError(400, "tenant_id does not match runtime tenant.");
  }

  if (input.request.cash_shift_id !== input.shiftId) {
    throw new RetailPosRuntimeError(400, "cash_shift_id does not match route parameter.");
  }

  if (input.request.status && input.request.status !== "closed") {
    throw new RetailPosRuntimeError(400, "Only status=closed is supported in retail_pos phase 1 cash shift close.");
  }

  await assertPosUser(actor.tenantId, input.request.closed_by_pos_user_id);

  const targetDevice = await resolveRetailPosTargetDevice({
    actor,
    deviceRecordId: actor.mode === "device" ? null : input.request.device_id,
    requiredRole: ["cashier_station", "multi_station"],
  });

  const cashShift = await loadRetailPosCashShiftById({
    tenantId: actor.tenantId,
    shiftId: input.shiftId,
  });

  if (cashShift.device_id !== targetDevice.deviceRecordId) {
    throw new RetailPosRuntimeError(403, "retail_pos cash shift does not belong to the resolved device.");
  }

  if (cashShift.status !== "open") {
    throw new RetailPosRuntimeError(409, "Only an open retail_pos cash shift can be closed.");
  }

  const declaredCashCents = ensureNonNegativeInteger(
    input.request.declared_cash_cents,
    "declared_cash_cents",
  );
  const expectedCashCents = await computeExpectedCashCents(
    actor.tenantId,
    cashShift.id,
    cashShift.opening_float_cents,
  );
  const differenceCents = declaredCashCents - expectedCashCents;
  const closingNote = normalizeClosingNote(input.request.closing_note);
  const closedAt = asTrimmedString(input.request.closed_at) ?? new Date().toISOString();
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("retail_pos_cash_shifts")
    .update({
      status: "closed",
      expected_cash_cents: expectedCashCents,
      declared_cash_cents: declaredCashCents,
      difference_cents: differenceCents,
      closing_note: closingNote,
      closed_by_pos_user_id: input.request.closed_by_pos_user_id,
      closed_at: closedAt,
    })
    .eq("tenant_id", actor.tenantId)
    .eq("id", input.shiftId)
    .eq("status", "open")
    .select(
      "id, tenant_id, kiosk_id, device_id, opened_by_pos_user_id, closed_by_pos_user_id, status, opening_float_cents, expected_cash_cents, declared_cash_cents, difference_cents, closing_note, opened_at, closed_at, created_at, updated_at, created_by, updated_by",
    )
    .limit(1)
    .maybeSingle<CashShiftRow>();

  if (error) {
    throw new RetailPosRuntimeError(400, `Unable to close retail_pos cash shift: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(409, "retail_pos cash shift changed before close could be applied.");
  }

  return { cash_shift: data };
}

export async function getRetailPosDaySummary(input: {
  tenantSlug: string;
  deviceRecordId?: string | null;
  deviceId?: string | null;
  deviceSecret?: string | null;
}): Promise<RetailPosDaySummaryResponse> {
  const actor = await resolveRetailPosRuntimeActor(input);
  assertCashierSessionOrDevice(actor);
  const supabase = getSupabaseAdminClient();
  const { businessDate, startIso, endIso } = getBusinessDayBounds();

  let targetDeviceRecordId: string | null = null;
  let currentCashShift: RetailPosCashShift | null = null;

  if (actor.mode === "device" || input.deviceRecordId) {
    const targetDevice = await resolveRetailPosTargetDevice({
      actor,
      deviceRecordId: input.deviceRecordId,
      requiredRole: ["cashier_station", "multi_station"],
    });
    targetDeviceRecordId = targetDevice.deviceRecordId;
    currentCashShift = await getOpenRetailPosCashShiftForDevice({
      tenantId: actor.tenantId,
      deviceRecordId: targetDevice.deviceRecordId,
    });
  }

  const ordersQuery = supabase
    .from("retail_pos_orders")
    .select("status, total_cents, discount_cents")
    .eq("tenant_id", actor.tenantId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  const paymentsQuery = supabase
    .from("retail_pos_payments")
    .select("amount_cents, payment_method")
    .eq("tenant_id", actor.tenantId)
    .gte("paid_at", startIso)
    .lt("paid_at", endIso);

  const [ordersResult, paymentsResult] = await Promise.all([ordersQuery, paymentsQuery]);

  if (ordersResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos day orders summary: ${ordersResult.error.message}`);
  }

  if (paymentsResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos day payments summary: ${paymentsResult.error.message}`);
  }

  const orders = (ordersResult.data ?? []) as Array<{
    status: "pending_payment" | "paid" | "voided" | "cancelled";
    total_cents: number;
    discount_cents: number;
  }>;
  const payments = (paymentsResult.data ?? []) as PaymentSummaryRow[];

  const pendingPaymentOrdersCount = orders.filter((order) => order.status === "pending_payment").length;
  const paidOrders = orders.filter((order) => order.status === "paid");
  const cancelledOrdersCount = orders.filter(
    (order) => order.status === "cancelled" || order.status === "voided",
  ).length;
  const grossSalesCents = paidOrders.reduce((sum, order) => sum + order.total_cents + order.discount_cents, 0);
  const discountsCents = paidOrders.reduce((sum, order) => sum + order.discount_cents, 0);
  const netSalesCents = paidOrders.reduce((sum, order) => sum + order.total_cents, 0);
  const cashPaymentsCents = payments
    .filter((payment) => payment.payment_method === "cash")
    .reduce((sum, payment) => sum + payment.amount_cents, 0);
  const cardPaymentsCents = payments
    .filter((payment) => payment.payment_method === "card")
    .reduce((sum, payment) => sum + payment.amount_cents, 0);

  return {
    tenant_id: actor.tenantId,
    business_date: businessDate,
    device_id: targetDeviceRecordId,
    cash_shift_id: currentCashShift?.id ?? null,
    orders_count: orders.length,
    pending_payment_orders_count: pendingPaymentOrdersCount,
    paid_orders_count: paidOrders.length,
    cancelled_orders_count: cancelledOrdersCount,
    gross_sales_cents: grossSalesCents,
    discounts_cents: discountsCents,
    net_sales_cents: netSalesCents,
    cash_payments_cents: cashPaymentsCents,
    card_payments_cents: cardPaymentsCents,
    current_cash_shift: currentCashShift,
  };
}
