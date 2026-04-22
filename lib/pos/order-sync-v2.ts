import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  PosSyncMutationAck,
  PosSyncMutationConflict,
  PosSyncMutationCloseCashShift,
  PosSyncMutationOpenCashShift,
  PosSyncMutationsResponse,
  PosSyncMutationV2,
} from "@/types/pos";

const MUTATION_TYPES = new Set([
  "OPEN_CASH_SHIFT",
  "CLOSE_CASH_SHIFT",
  "OPEN_TAB",
  "ADD_ITEM",
  "UPDATE_ITEM_QTY",
  "REMOVE_ITEM",
  "KITCHEN_PRINT",
  "CLOSE_TAB_PAID",
  "CANCEL_TAB",
  "SALE_CREATE",
  "SALE_REPRINT",
  "SALE_CANCEL",
] as const);

const PRINT_STATUSES = new Set(["QUEUED", "SENT", "CONFIRMED", "FAILED", "UNKNOWN"] as const);
const ALLOWED_PAYMENT_METHODS = new Set(["cash", "card", "employee", "efectivo", "tarjeta"] as const);

class MutationConflictError extends Error {
  constructor(
    message: string,
    public readonly details: {
      mutation_id: string;
      order_id?: string;
      expected_tab_version?: number | null;
      current_tab_version?: number | null;
    },
  ) {
    super(message);
    this.name = "MutationConflictError";
  }
}

type OrderRow = {
  id: string;
  tenant_id: string;
  kiosk_id: string;
  status: "OPEN" | "PAID" | "CANCELED";
  tab_version: number;
  is_tab?: boolean | null;
};

type CashShiftRow = {
  id: string;
  tenant_id: string;
  kiosk_id: string;
  opened_by_pos_user_id: string;
  closed_by_pos_user_id: string | null;
  status: "open" | "closed" | "canceled";
  opening_float_cents: number;
  declared_cash_cents: number | null;
  opened_at: string;
  closed_at: string | null;
};

type OrderScopedMutation = Extract<PosSyncMutationV2, { order_id: string }>;

type CloseTabPaidMeta = {
  paymentMethod: "cash" | "card" | "employee";
  paymentReceivedCents: number;
  changeCents: number;
  printStatus: "QUEUED" | "SENT" | "CONFIRMED" | "FAILED";
  printAttemptCount: number;
  printError: string | null;
  lastPrintAt: string;
  printJobId: string | null;
};

function parseIsoOrNow(value: string | null | undefined, field: string): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

function ensureNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function ensureNonNegativeInt(value: unknown, field: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    throw new Error(`${field} must be a non-negative integer.`);
  }
  return num;
}

function ensurePositiveInt(value: unknown, field: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return num;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizeMutationTrackingId(value: string | null | undefined): string | null {
  if (!value) return null;
  // Temporary compatibility shim for legacy mobile/tablet outbox entries that still
  // use string ids like `mutation-...`. The canonical DB tracking columns are uuid,
  // so we persist only UUID-shaped values and intentionally drop legacy ids instead
  // of blocking the entire sync lane. This should be removable once the old outbox
  // backlog is gone and every client emits UUID mutation ids.
  return isUuid(value) ? value : null;
}

function normalizePaymentMethod(value: unknown): "cash" | "card" | "employee" {
  if (typeof value !== "string") {
    throw new Error("payment_method is required.");
  }
  const normalized = value.trim().toLowerCase();
  if (!ALLOWED_PAYMENT_METHODS.has(normalized as "cash" | "card" | "employee" | "efectivo" | "tarjeta")) {
    throw new Error("payment_method must be one of: cash, card, employee.");
  }
  if (normalized === "efectivo") return "cash";
  if (normalized === "tarjeta") return "card";
  return normalized as "cash" | "card" | "employee";
}

async function assertKioskBelongsToTenant(kioskId: string, tenantId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("kiosks")
    .select("id")
    .eq("id", kioskId)
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) throw new Error(`Unable to validate kiosk: ${error.message}`);
  if (!data) throw new Error("kiosk_id does not belong to tenant.");
}

function normalizeOptionalLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const uuidV4ish = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4ish.test(normalized) ? normalized : null;
}

async function assertProductBelongsToTenant(productId: string, tenantId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("catalog_items")
    .select("id")
    .eq("id", productId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) throw new Error(`Unable to validate product: ${error.message}`);
  if (!data) throw new Error("product_id does not belong to tenant.");
}

async function assertPosUserBelongsToTenant(userId: string, tenantId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pos_users")
    .select("id")
    .eq("id", userId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) throw new Error(`Unable to validate POS user: ${error.message}`);
  if (!data) throw new Error("user_id does not belong to tenant or is inactive.");
}

async function findOrder(tenantId: string, orderId: string): Promise<OrderRow | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, tenant_id, kiosk_id, status, tab_version, is_tab")
    .eq("tenant_id", tenantId)
    .eq("id", orderId)
    .limit(1)
    .maybeSingle<OrderRow>();

  if (error) throw new Error(`Unable to load order: ${error.message}`);
  return data || null;
}

async function findCashShift(
  tenantId: string,
  cashShiftId: string,
): Promise<CashShiftRow | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cash_shifts")
    .select(
      "id, tenant_id, kiosk_id, opened_by_pos_user_id, closed_by_pos_user_id, status, opening_float_cents, declared_cash_cents, opened_at, closed_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", cashShiftId)
    .limit(1)
    .maybeSingle<CashShiftRow>();

  if (error) throw new Error(`Unable to load cash shift: ${error.message}`);
  return data || null;
}

async function findOpenCashShiftForKiosk(
  tenantId: string,
  kioskId: string,
): Promise<CashShiftRow | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cash_shifts")
    .select(
      "id, tenant_id, kiosk_id, opened_by_pos_user_id, closed_by_pos_user_id, status, opening_float_cents, declared_cash_cents, opened_at, closed_at",
    )
    .eq("tenant_id", tenantId)
    .eq("kiosk_id", kioskId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle<CashShiftRow>();

  if (error) throw new Error(`Unable to load open cash shift for kiosk: ${error.message}`);
  return data || null;
}

function assertExpectedVersion(
  mutation: OrderScopedMutation,
  current: number,
): void {
  if (mutation.base_tab_version == null) return;
  const expected = Number(mutation.base_tab_version);
  if (!Number.isInteger(expected) || expected < 0) {
    throw new Error("base_tab_version must be a non-negative integer when provided.");
  }
  if (expected !== current) {
    throw new MutationConflictError("base_tab_version mismatch.", {
      mutation_id: mutation.mutation_id,
      order_id: mutation.order_id,
      expected_tab_version: expected,
      current_tab_version: current,
    });
  }
}

function assertOrderOpen(order: OrderRow, mutation: OrderScopedMutation): void {
  if (order.status !== "OPEN") {
    throw new MutationConflictError("Order is not OPEN.", {
      mutation_id: mutation.mutation_id,
      order_id: mutation.order_id,
      current_tab_version: order.tab_version,
    });
  }
}

async function isMutationAlreadyApplied(tenantId: string, mutationId: string): Promise<boolean> {
  // Some legacy tablet payloads still carry non-UUID mutation ids like
  // `mutation-...`. The canonical DB columns are uuid, so querying PostgREST
  // with those values raises a cast error and blocks the whole sync batch.
  // Treat them as "not yet applied" and let the mutation be processed normally.
  if (!isUuid(mutationId)) {
    return false;
  }

  const supabase = getSupabaseAdminClient();
  const [eventRes, lineRes] = await Promise.all([
    supabase
      .from("order_events")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("mutation_id", mutationId)
      .limit(1)
      .maybeSingle<{ id: string }>(),
    supabase
      .from("order_lines")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("mutation_id", mutationId)
      .limit(1)
      .maybeSingle<{ id: string }>(),
  ]);

  if (eventRes.error) throw new Error(`Unable to verify event idempotency: ${eventRes.error.message}`);
  if (lineRes.error) throw new Error(`Unable to verify line idempotency: ${lineRes.error.message}`);
  return Boolean(eventRes.data || lineRes.data);
}

async function insertOrderEvent(input: {
  tenantId: string;
  orderId: string;
  mutationId?: string | null;
  type: string;
  createdAt: string;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("order_events").insert({
    id: randomUUID(),
    tenant_id: input.tenantId,
    order_id: input.orderId,
    mutation_id: normalizeMutationTrackingId(input.mutationId),
    type: input.type,
    meta: input.meta ?? null,
    created_at: input.createdAt,
  });
  if (error) {
    throw new Error(`order_events insert failed: ${error.message}`);
  }
}

async function applyOpenTab(tenantId: string, mutation: PosSyncMutationV2): Promise<number> {
  if (mutation.type !== "OPEN_TAB") throw new Error("Invalid mutation type.");
  const supabase = getSupabaseAdminClient();
  const createdAt = parseIsoOrNow(mutation.opened_at ?? mutation.created_at, "opened_at");
  const folioNumber = ensureNonNegativeInt(mutation.folio_number, "folio_number");
  const totalCents = ensureNonNegativeInt(mutation.total_cents ?? 0, "total_cents");
  const folioText = ensureNonEmptyString(mutation.folio_text, "folio_text");
  const posTableLabel = normalizeOptionalLabel(mutation.pos_table_label);
  const posTableId = normalizeOptionalUuid(mutation.pos_table_id);

  await assertKioskBelongsToTenant(mutation.kiosk_id, tenantId);

  const existing = await findOrder(tenantId, mutation.order_id);
  if (existing) {
    throw new MutationConflictError("Order already exists.", {
      mutation_id: mutation.mutation_id,
      order_id: mutation.order_id,
      current_tab_version: existing.tab_version,
    });
  }

  const { error } = await supabase.from("orders").insert({
    id: mutation.order_id,
    tenant_id: tenantId,
    kiosk_id: mutation.kiosk_id,
    folio_number: folioNumber,
    folio_text: folioText,
    status: "OPEN",
    total_cents: totalCents,
    print_status: "UNKNOWN",
    print_attempt_count: 0,
    is_tab: true,
    pos_table_id: posTableId,
    pos_table_label: posTableLabel,
    opened_at: createdAt,
    tab_version: 1,
    last_mutation_id: normalizeMutationTrackingId(mutation.mutation_id),
    created_at: createdAt,
    updated_at: createdAt,
  });
  if (error) {
    throw new Error(`orders insert failed: ${error.message}`);
  }

  await insertOrderEvent({
    tenantId,
    orderId: mutation.order_id,
    mutationId: mutation.mutation_id,
    type: "TAB_OPENED",
    createdAt,
    meta: {
      ...(mutation.meta || {}),
      pos_table_label: posTableLabel,
    },
  });

  return 1;
}

async function applyOpenCashShift(
  tenantId: string,
  mutation: PosSyncMutationOpenCashShift,
): Promise<null> {
  const supabase = getSupabaseAdminClient();
  const createdAt = parseIsoOrNow(mutation.created_at ?? mutation.opened_at, "created_at");
  const openedAt = parseIsoOrNow(mutation.opened_at ?? mutation.created_at, "opened_at");
  const openingFloatCents = ensureNonNegativeInt(
    mutation.opening_float_cents,
    "opening_float_cents",
  );

  await assertPosUserBelongsToTenant(mutation.opened_by_pos_user_id, tenantId);

  const existing = await findCashShift(tenantId, mutation.cash_shift_id);
  if (existing) {
    const sameOpenState =
      existing.kiosk_id === mutation.kiosk_id &&
      existing.opened_by_pos_user_id === mutation.opened_by_pos_user_id &&
      existing.opening_float_cents === openingFloatCents &&
      existing.opened_at === openedAt &&
      existing.status === "open";

    if (sameOpenState) {
      console.info("pos.sync.cash_shift.open.noop", {
        tenantId,
        mutationId: mutation.mutation_id,
        cashShiftId: mutation.cash_shift_id,
        kioskId: mutation.kiosk_id,
      });
      return null;
    }

    console.warn("pos.sync.cash_shift.open.conflict", {
      tenantId,
      mutationId: mutation.mutation_id,
      cashShiftId: mutation.cash_shift_id,
      kioskId: mutation.kiosk_id,
    });
    throw new MutationConflictError("Cash shift already exists with a different state.", {
      mutation_id: mutation.mutation_id,
    });
  }

  const existingOpenShiftForKiosk = await findOpenCashShiftForKiosk(
    tenantId,
    mutation.kiosk_id,
  );
  if (existingOpenShiftForKiosk) {
    console.warn("pos.sync.cash_shift.open.kiosk_conflict", {
      tenantId,
      mutationId: mutation.mutation_id,
      cashShiftId: mutation.cash_shift_id,
      kioskId: mutation.kiosk_id,
      existingCashShiftId: existingOpenShiftForKiosk.id,
    });
    throw new MutationConflictError("There is already an open cash shift for this kiosk.", {
      mutation_id: mutation.mutation_id,
    });
  }

  const { error } = await supabase.from("cash_shifts").insert({
    id: mutation.cash_shift_id,
    tenant_id: tenantId,
    kiosk_id: mutation.kiosk_id,
    opened_by_pos_user_id: mutation.opened_by_pos_user_id,
    closed_by_pos_user_id: null,
    status: "open",
    opening_float_cents: openingFloatCents,
    declared_cash_cents: null,
    opened_at: openedAt,
    closed_at: null,
    created_at: createdAt,
    updated_at: createdAt,
    created_by: null,
    updated_by: null,
  });

  if (error) {
    if (error.message.includes("cash_shifts_one_open_per_kiosk_uidx")) {
      const openShiftAfterInsertRace = await findOpenCashShiftForKiosk(
        tenantId,
        mutation.kiosk_id,
      );

      if (openShiftAfterInsertRace?.id === mutation.cash_shift_id) {
        const sameOpenState =
          openShiftAfterInsertRace.opened_by_pos_user_id === mutation.opened_by_pos_user_id &&
          openShiftAfterInsertRace.opening_float_cents === openingFloatCents &&
          openShiftAfterInsertRace.opened_at === openedAt &&
          openShiftAfterInsertRace.status === "open";

        if (sameOpenState) {
          console.info("pos.sync.cash_shift.open.noop_after_race", {
            tenantId,
            mutationId: mutation.mutation_id,
            cashShiftId: mutation.cash_shift_id,
            kioskId: mutation.kiosk_id,
          });
          return null;
        }
      }

      console.warn("pos.sync.cash_shift.open.conflict_after_race", {
        tenantId,
        mutationId: mutation.mutation_id,
        cashShiftId: mutation.cash_shift_id,
        kioskId: mutation.kiosk_id,
        existingCashShiftId: openShiftAfterInsertRace?.id || null,
      });
      throw new MutationConflictError("There is already an open cash shift for this kiosk.", {
        mutation_id: mutation.mutation_id,
      });
    }
    throw new Error(`cash_shifts insert failed: ${error.message}`);
  }

  console.info("pos.sync.cash_shift.open.applied", {
    tenantId,
    mutationId: mutation.mutation_id,
    cashShiftId: mutation.cash_shift_id,
    kioskId: mutation.kiosk_id,
  });

  return null;
}

async function bumpTabVersion(input: {
  tenantId: string;
  orderId: string;
  currentTabVersion: number;
  mutationId: string;
  extra?: Record<string, unknown>;
}): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const next = input.currentTabVersion + 1;
  const { data, error } = await supabase
    .from("orders")
    .update({
      tab_version: next,
      last_mutation_id: normalizeMutationTrackingId(input.mutationId),
      updated_at: new Date().toISOString(),
      ...(input.extra || {}),
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.orderId)
    .eq("tab_version", input.currentTabVersion)
    .select("id")
    .limit(1);

  if (error) throw new Error(`orders update failed: ${error.message}`);
  if (!data || data.length === 0) {
    throw new MutationConflictError("Tab version changed during mutation apply.", {
      mutation_id: input.mutationId,
      order_id: input.orderId,
      expected_tab_version: input.currentTabVersion,
    });
  }
  return next;
}

async function applyAddItem(tenantId: string, mutation: PosSyncMutationV2): Promise<number> {
  if (mutation.type !== "ADD_ITEM") throw new Error("Invalid mutation type.");
  const supabase = getSupabaseAdminClient();
  const createdAt = parseIsoOrNow(mutation.created_at, "created_at");
  const qty = ensurePositiveInt(mutation.qty, "qty");
  const unitPriceCents = ensureNonNegativeInt(mutation.unit_price_cents, "unit_price_cents");

  const order = await findOrder(tenantId, mutation.order_id);
  if (!order) throw new Error("Order does not exist.");
  assertOrderOpen(order, mutation);
  assertExpectedVersion(mutation, order.tab_version);
  await assertProductBelongsToTenant(mutation.product_id, tenantId);

  const { error: lineError } = await supabase.from("order_lines").insert({
    id: mutation.line_id,
    mutation_id: normalizeMutationTrackingId(mutation.mutation_id),
    tenant_id: tenantId,
    order_id: mutation.order_id,
    product_id: mutation.product_id,
    qty,
    unit_price_cents: unitPriceCents,
    notes: mutation.notes ?? null,
    created_at: createdAt,
  });
  if (lineError) throw new Error(`order_lines insert failed: ${lineError.message}`);

  const nextVersion = await bumpTabVersion({
    tenantId,
    orderId: mutation.order_id,
    currentTabVersion: order.tab_version,
    mutationId: mutation.mutation_id,
  });

  await insertOrderEvent({
    tenantId,
    orderId: mutation.order_id,
    mutationId: mutation.mutation_id,
    type: "TAB_ITEM_ADDED",
    createdAt,
    meta: {
      line_id: mutation.line_id,
      product_id: mutation.product_id,
      qty,
      unit_price_cents: unitPriceCents,
      ...(mutation.meta || {}),
    },
  });

  return nextVersion;
}

async function loadActiveLine(input: {
  tenantId: string;
  orderId: string;
  lineId: string;
}): Promise<{ id: string; qty: number } | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("order_lines")
    .select("id, qty")
    .eq("tenant_id", input.tenantId)
    .eq("order_id", input.orderId)
    .eq("id", input.lineId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<{ id: string; qty: number }>();
  if (error) throw new Error(`Unable to load order line: ${error.message}`);
  return data || null;
}

async function applyUpdateItemQty(tenantId: string, mutation: PosSyncMutationV2): Promise<number> {
  if (mutation.type !== "UPDATE_ITEM_QTY") throw new Error("Invalid mutation type.");
  const supabase = getSupabaseAdminClient();
  const createdAt = parseIsoOrNow(mutation.created_at, "created_at");
  const qty = ensurePositiveInt(mutation.qty, "qty");

  const order = await findOrder(tenantId, mutation.order_id);
  if (!order) throw new Error("Order does not exist.");
  assertOrderOpen(order, mutation);
  assertExpectedVersion(mutation, order.tab_version);

  const line = await loadActiveLine({
    tenantId,
    orderId: mutation.order_id,
    lineId: mutation.line_id,
  });
  if (!line) {
    throw new MutationConflictError("Line does not exist or was removed.", {
      mutation_id: mutation.mutation_id,
      order_id: mutation.order_id,
      current_tab_version: order.tab_version,
    });
  }

  const { error: lineError } = await supabase
    .from("order_lines")
    .update({
      qty,
      notes: mutation.notes ?? null,
    })
    .eq("tenant_id", tenantId)
    .eq("order_id", mutation.order_id)
    .eq("id", mutation.line_id);
  if (lineError) throw new Error(`order_lines update failed: ${lineError.message}`);

  const nextVersion = await bumpTabVersion({
    tenantId,
    orderId: mutation.order_id,
    currentTabVersion: order.tab_version,
    mutationId: mutation.mutation_id,
  });

  await insertOrderEvent({
    tenantId,
    orderId: mutation.order_id,
    mutationId: mutation.mutation_id,
    type: "TAB_ITEM_UPDATED",
    createdAt,
    meta: {
      line_id: mutation.line_id,
      qty,
      ...(mutation.meta || {}),
    },
  });

  return nextVersion;
}

async function applyRemoveItem(tenantId: string, mutation: PosSyncMutationV2): Promise<number> {
  if (mutation.type !== "REMOVE_ITEM") throw new Error("Invalid mutation type.");
  const supabase = getSupabaseAdminClient();
  const createdAt = parseIsoOrNow(mutation.created_at, "created_at");

  const order = await findOrder(tenantId, mutation.order_id);
  if (!order) throw new Error("Order does not exist.");
  assertOrderOpen(order, mutation);
  assertExpectedVersion(mutation, order.tab_version);

  const line = await loadActiveLine({
    tenantId,
    orderId: mutation.order_id,
    lineId: mutation.line_id,
  });
  if (!line) {
    throw new MutationConflictError("Line does not exist or is already removed.", {
      mutation_id: mutation.mutation_id,
      order_id: mutation.order_id,
      current_tab_version: order.tab_version,
    });
  }

  const { error: lineError } = await supabase
    .from("order_lines")
    .update({
      deleted_at: createdAt,
    })
    .eq("tenant_id", tenantId)
    .eq("order_id", mutation.order_id)
    .eq("id", mutation.line_id)
    .is("deleted_at", null);
  if (lineError) throw new Error(`order_lines remove failed: ${lineError.message}`);

  const nextVersion = await bumpTabVersion({
    tenantId,
    orderId: mutation.order_id,
    currentTabVersion: order.tab_version,
    mutationId: mutation.mutation_id,
  });

  await insertOrderEvent({
    tenantId,
    orderId: mutation.order_id,
    mutationId: mutation.mutation_id,
    type: "TAB_ITEM_REMOVED",
    createdAt,
    meta: {
      line_id: mutation.line_id,
      reason: mutation.reason ?? null,
      ...(mutation.meta || {}),
    },
  });

  return nextVersion;
}

async function applyKitchenPrint(tenantId: string, mutation: PosSyncMutationV2): Promise<number> {
  if (mutation.type !== "KITCHEN_PRINT") throw new Error("Invalid mutation type.");
  const supabase = getSupabaseAdminClient();
  const createdAt = parseIsoOrNow(mutation.created_at, "created_at");
  const printedVersion = ensureNonNegativeInt(mutation.printed_version, "printed_version");

  const order = await findOrder(tenantId, mutation.order_id);
  if (!order) throw new Error("Order does not exist.");
  assertOrderOpen(order, mutation);
  assertExpectedVersion(mutation, order.tab_version);

  const { error: orderError } = await supabase
    .from("orders")
    .update({
      kitchen_last_printed_version: printedVersion,
      kitchen_last_print_at: createdAt,
      last_mutation_id: normalizeMutationTrackingId(mutation.mutation_id),
      updated_at: createdAt,
    })
    .eq("tenant_id", tenantId)
    .eq("id", mutation.order_id)
    .eq("status", "OPEN");
  if (orderError) throw new Error(`orders kitchen print update failed: ${orderError.message}`);

  const eventType = mutation.ok === false ? "KITCHEN_PRINT_ERROR" : "KITCHEN_PRINTED";
  await insertOrderEvent({
    tenantId,
    orderId: mutation.order_id,
    mutationId: mutation.mutation_id,
    type: eventType,
    createdAt,
    meta: {
      printed_version: printedVersion,
      error: mutation.error ?? null,
      ...(mutation.meta || {}),
    },
  });

  return order.tab_version;
}

async function applyCloseTabPaid(tenantId: string, mutation: PosSyncMutationV2): Promise<number> {
  if (mutation.type !== "CLOSE_TAB_PAID") throw new Error("Invalid mutation type.");
  const closedAt = parseIsoOrNow(mutation.closed_at ?? mutation.created_at, "closed_at");
  const supabase = getSupabaseAdminClient();
  const closeMeta = parseCloseTabPaidMeta(mutation, closedAt);

  const order = await findOrder(tenantId, mutation.order_id);
  if (!order) throw new Error("Order does not exist.");
  if (!order.is_tab) {
    throw new Error("CLOSE_TAB_PAID can only be applied to tab orders.");
  }
  assertOrderOpen(order, mutation);
  assertExpectedVersion(mutation, order.tab_version);

  const nextVersion = order.tab_version + 1;
  const { data, error } = await supabase
    .from("orders")
    .update({
      status: "PAID",
      closed_at: closedAt,
      tab_version: nextVersion,
      last_mutation_id: normalizeMutationTrackingId(mutation.mutation_id),
      updated_at: closedAt,
      payment_method: closeMeta.paymentMethod,
      payment_received_cents: closeMeta.paymentReceivedCents,
      change_cents: closeMeta.changeCents,
      print_status: closeMeta.printStatus,
      print_attempt_count: closeMeta.printAttemptCount,
      last_print_error: closeMeta.printError,
      last_print_at: closeMeta.lastPrintAt,
      ...(mutation.total_cents != null ? { total_cents: ensureNonNegativeInt(mutation.total_cents, "total_cents") } : {}),
    })
    .eq("tenant_id", tenantId)
    .eq("id", mutation.order_id)
    .eq("status", "OPEN")
    .eq("tab_version", order.tab_version)
    .select("id")
    .limit(1);
  if (error) throw new Error(`orders close tab update failed: ${error.message}`);
  if (!data || data.length === 0) {
    throw new MutationConflictError("Order changed before close.", {
      mutation_id: mutation.mutation_id,
      order_id: mutation.order_id,
      expected_tab_version: order.tab_version,
    });
  }

  await insertOrderEvent({
    tenantId,
    orderId: mutation.order_id,
    mutationId: mutation.mutation_id,
    type: "TAB_CLOSED",
    createdAt: closedAt,
    meta: {
      status: "PAID",
      payment_method: closeMeta.paymentMethod,
      payment_received_cents: closeMeta.paymentReceivedCents,
      change_cents: closeMeta.changeCents,
      print_status: closeMeta.printStatus,
      print_attempt_count: closeMeta.printAttemptCount,
      print_error: closeMeta.printError,
      print_job_id: closeMeta.printJobId,
      last_print_at: closeMeta.lastPrintAt,
      ...(mutation.meta || {}),
    },
  });

  return nextVersion;
}

async function applyCancelTab(tenantId: string, mutation: PosSyncMutationV2): Promise<number> {
  if (mutation.type !== "CANCEL_TAB") throw new Error("Invalid mutation type.");
  const canceledAt = parseIsoOrNow(mutation.canceled_at ?? mutation.created_at, "canceled_at");
  const supabase = getSupabaseAdminClient();

  const order = await findOrder(tenantId, mutation.order_id);
  if (!order) throw new Error("Order does not exist.");
  assertExpectedVersion(mutation, order.tab_version);

  const nextVersion = order.tab_version + 1;
  const { data, error } = await supabase
    .from("orders")
    .update({
      status: "CANCELED",
      canceled_at: canceledAt,
      cancel_reason: mutation.cancel_reason ?? null,
      tab_version: nextVersion,
      last_mutation_id: normalizeMutationTrackingId(mutation.mutation_id),
      updated_at: canceledAt,
    })
    .eq("tenant_id", tenantId)
    .eq("id", mutation.order_id)
    .neq("status", "CANCELED")
    .eq("tab_version", order.tab_version)
    .select("id")
    .limit(1);
  if (error) throw new Error(`orders cancel update failed: ${error.message}`);
  if (!data || data.length === 0) {
    throw new MutationConflictError("Order changed before cancel.", {
      mutation_id: mutation.mutation_id,
      order_id: mutation.order_id,
      expected_tab_version: order.tab_version,
    });
  }

  await insertOrderEvent({
    tenantId,
    orderId: mutation.order_id,
    mutationId: mutation.mutation_id,
    type: "CANCELED",
    createdAt: canceledAt,
    meta: {
      reason: mutation.cancel_reason ?? null,
      ...(mutation.meta || {}),
    },
  });

  return nextVersion;
}

function normalizePrintStatus(value: unknown): "QUEUED" | "SENT" | "CONFIRMED" | "FAILED" | "UNKNOWN" {
  if (typeof value !== "string") return "UNKNOWN";
  const normalized = value.trim().toUpperCase();
  if (!PRINT_STATUSES.has(normalized as "QUEUED" | "SENT" | "CONFIRMED" | "FAILED" | "UNKNOWN")) {
    return "UNKNOWN";
  }
  return normalized as "QUEUED" | "SENT" | "CONFIRMED" | "FAILED" | "UNKNOWN";
}

function parseCloseTabPaidMeta(mutation: PosSyncMutationV2, closedAt: string): CloseTabPaidMeta {
  if (mutation.type !== "CLOSE_TAB_PAID") {
    throw new Error("Invalid mutation type.");
  }
  if (!mutation.meta || typeof mutation.meta !== "object") {
    throw new Error("CLOSE_TAB_PAID requires meta with payment and print fields.");
  }
  const meta = mutation.meta as Record<string, unknown>;

  const paymentMethod = normalizePaymentMethod(meta.metodo_pago ?? meta.payment_method);
  const paymentReceivedCents = ensureNonNegativeInt(
    meta.pago_recibido_cents ?? meta.payment_received_cents,
    "meta.pago_recibido_cents",
  );
  const changeCents = ensureNonNegativeInt(
    meta.cambio_cents ?? meta.change_cents,
    "meta.cambio_cents",
  );
  const printStatus = normalizePrintStatus(meta.print_status);
  if (printStatus === "UNKNOWN") {
    throw new Error("meta.print_status must be one of: QUEUED, SENT, CONFIRMED, FAILED.");
  }
  const printAttemptCount = ensureNonNegativeInt(meta.print_attempt_count ?? 1, "meta.print_attempt_count");
  if (printAttemptCount < 1) {
    throw new Error("meta.print_attempt_count must be >= 1.");
  }
  const printError = typeof meta.print_error === "string" ? meta.print_error : null;
  const lastPrintAt = parseIsoOrNow(
    (typeof meta.last_print_at === "string" ? meta.last_print_at : null) ?? closedAt,
    "meta.last_print_at",
  );
  const printJobId = typeof meta.print_job_id === "string" && meta.print_job_id.trim() ? meta.print_job_id.trim() : null;

  return {
    paymentMethod,
    paymentReceivedCents,
    changeCents,
    printStatus,
    printAttemptCount,
    printError,
    lastPrintAt,
    printJobId,
  };
}

async function applySaleCreate(tenantId: string, mutation: PosSyncMutationV2): Promise<number> {
  if (mutation.type !== "SALE_CREATE") throw new Error("Invalid mutation type.");
  const supabase = getSupabaseAdminClient();
  const createdAt = parseIsoOrNow(mutation.created_at, "created_at");
  const folioNumber = ensureNonNegativeInt(mutation.folio_number, "folio_number");
  const folioText = ensureNonEmptyString(mutation.folio_text, "folio_text");
  const totalCents = ensureNonNegativeInt(mutation.total_cents, "total_cents");
  const paymentReceivedCents = ensureNonNegativeInt(
    mutation.payment_received_cents ?? mutation.pago_recibido_cents,
    "payment_received_cents",
  );
  const changeCents = ensureNonNegativeInt(
    mutation.change_cents ?? mutation.cambio_cents,
    "change_cents",
  );
  const paymentMethod = normalizePaymentMethod(mutation.payment_method ?? mutation.metodo_pago);
  const userId = ensureNonEmptyString(mutation.user_id, "user_id");
  const lines = Array.isArray(mutation.lines) ? mutation.lines : [];

  await assertKioskBelongsToTenant(mutation.kiosk_id, tenantId);
  await assertPosUserBelongsToTenant(userId, tenantId);
  const existing = await findOrder(tenantId, mutation.order_id);
  if (existing) {
    throw new MutationConflictError("Order already exists.", {
      mutation_id: mutation.mutation_id,
      order_id: mutation.order_id,
      current_tab_version: existing.tab_version,
    });
  }

  const { error: orderError } = await supabase.from("orders").insert({
    id: mutation.order_id,
    tenant_id: tenantId,
    kiosk_id: mutation.kiosk_id,
    folio_number: folioNumber,
    folio_text: folioText,
    status: "PAID",
    total_cents: totalCents,
    payment_received_cents: paymentReceivedCents,
    change_cents: changeCents,
    payment_method: paymentMethod,
    print_status: normalizePrintStatus(mutation.print_status),
    print_attempt_count: ensureNonNegativeInt(mutation.print_attempt_count ?? 1, "print_attempt_count"),
    last_print_error: typeof mutation.last_print_error === "string" ? mutation.last_print_error : null,
    last_print_at: parseIsoOrNow(mutation.last_print_at ?? createdAt, "last_print_at"),
    is_tab: false,
    created_at: createdAt,
    updated_at: createdAt,
  });
  if (orderError) throw new Error(`orders insert failed: ${orderError.message}`);

  const saleLines = lines.map((lineRaw) => {
    const line = lineRaw as Record<string, unknown>;
    const lineTotal = ensureNonNegativeInt(line.line_total_cents, "lines[].line_total_cents");
    return {
      id: ensureNonEmptyString(line.id, "lines[].id"),
      tenant_id: tenantId,
      order_id: mutation.order_id,
      catalog_item_id: ensureNonEmptyString(line.catalog_item_id, "lines[].catalog_item_id"),
      qty: ensurePositiveInt(line.qty, "lines[].qty"),
      unit_price_cents: ensureNonNegativeInt(line.unit_price_cents, "lines[].unit_price_cents"),
      line_total_cents: lineTotal,
      variants: null,
      created_at: createdAt,
      updated_at: createdAt,
    };
  });

  if (saleLines.length) {
    const calcTotal = saleLines.reduce((acc, row) => acc + row.line_total_cents, 0);
    if (calcTotal !== totalCents) {
      throw new Error(`Order total mismatch. expected=${totalCents} actual=${calcTotal}`);
    }
    const { error: itemsError } = await supabase.from("order_items").upsert(saleLines, { onConflict: "id" });
    if (itemsError) throw new Error(`order_items upsert failed: ${itemsError.message}`);
  }

  await insertOrderEvent({
    tenantId,
    orderId: mutation.order_id,
    mutationId: null,
    type: "PAYMENT_CAPTURED",
    createdAt,
    meta: {
      total_cents: totalCents,
      payment_received_cents: paymentReceivedCents,
      change_cents: changeCents,
      payment_method: paymentMethod,
      source: "quick_sale",
      user_id: userId,
    },
  });

  await insertOrderEvent({
    tenantId,
    orderId: mutation.order_id,
    mutationId: mutation.mutation_id,
    type: normalizePrintStatus(mutation.print_status) === "FAILED" ? "PRINT_ERROR" : "PRINTED",
    createdAt,
    meta: {
      source: "quick_sale",
      user_id: userId,
      ...(mutation.meta || {}),
    },
  });

  return 0;
}

async function applySaleReprint(tenantId: string, mutation: PosSyncMutationV2): Promise<number> {
  if (mutation.type !== "SALE_REPRINT") throw new Error("Invalid mutation type.");
  const supabase = getSupabaseAdminClient();
  const createdAt = parseIsoOrNow(mutation.created_at, "created_at");
  const userId = ensureNonEmptyString(mutation.user_id, "user_id");
  await assertPosUserBelongsToTenant(userId, tenantId);
  const order = await findOrder(tenantId, mutation.order_id);
  if (!order) throw new Error("Order does not exist.");

  const printStatus = normalizePrintStatus(mutation.print_status ?? "UNKNOWN");
  const { error } = await supabase
    .from("orders")
    .update({
      print_status: printStatus,
      print_attempt_count: ensureNonNegativeInt(mutation.print_attempt_count ?? 1, "print_attempt_count"),
      last_print_error: typeof mutation.last_print_error === "string" ? mutation.last_print_error : null,
      last_print_at: parseIsoOrNow(mutation.last_print_at ?? createdAt, "last_print_at"),
      updated_at: createdAt,
    })
    .eq("tenant_id", tenantId)
    .eq("id", mutation.order_id);
  if (error) throw new Error(`orders reprint update failed: ${error.message}`);

  await insertOrderEvent({
    tenantId,
    orderId: mutation.order_id,
    mutationId: mutation.mutation_id,
    type: printStatus === "FAILED" ? "PRINT_ERROR" : "REPRINTED",
    createdAt,
    meta: {
      source: "quick_sale",
      user_id: userId,
      ...(mutation.meta || {}),
    },
  });

  return order.tab_version;
}

async function applySaleCancel(tenantId: string, mutation: PosSyncMutationV2): Promise<number> {
  if (mutation.type !== "SALE_CANCEL") throw new Error("Invalid mutation type.");
  const supabase = getSupabaseAdminClient();
  const canceledAt = parseIsoOrNow(mutation.canceled_at ?? mutation.created_at, "canceled_at");
  const userId = ensureNonEmptyString(mutation.user_id, "user_id");
  await assertPosUserBelongsToTenant(userId, tenantId);
  const order = await findOrder(tenantId, mutation.order_id);
  if (!order) throw new Error("Order does not exist.");

  const { error } = await supabase
    .from("orders")
    .update({
      status: "CANCELED",
      canceled_at: canceledAt,
      cancel_reason: mutation.cancel_reason ?? null,
      updated_at: canceledAt,
    })
    .eq("tenant_id", tenantId)
    .eq("id", mutation.order_id)
    .neq("status", "CANCELED");
  if (error) throw new Error(`orders cancel update failed: ${error.message}`);

  await insertOrderEvent({
    tenantId,
    orderId: mutation.order_id,
    mutationId: mutation.mutation_id,
    type: "CANCELED",
    createdAt: canceledAt,
    meta: {
      source: "quick_sale",
      user_id: userId,
      reason: mutation.cancel_reason ?? null,
      ...(mutation.meta || {}),
    },
  });

  return order.tab_version;
}

function normalizeCashShiftTerminalStatus(
  value: unknown,
): "closed" | "canceled" {
  if (value === "canceled") return "canceled";
  return "closed";
}

async function applyCloseCashShift(
  tenantId: string,
  mutation: PosSyncMutationCloseCashShift,
): Promise<null> {
  const supabase = getSupabaseAdminClient();
  const closedAt = parseIsoOrNow(mutation.closed_at ?? mutation.created_at, "closed_at");
  const declaredCashCents = ensureNonNegativeInt(
    mutation.declared_cash_cents,
    "declared_cash_cents",
  );
  const status = normalizeCashShiftTerminalStatus(mutation.status);

  await assertPosUserBelongsToTenant(mutation.closed_by_pos_user_id, tenantId);

  const existing = await findCashShift(tenantId, mutation.cash_shift_id);
  if (!existing) {
    console.warn("pos.sync.cash_shift.close.missing", {
      tenantId,
      mutationId: mutation.mutation_id,
      cashShiftId: mutation.cash_shift_id,
      kioskId: mutation.kiosk_id,
    });
    throw new Error("cash_shift_id does not exist.");
  }
  if (existing.kiosk_id !== mutation.kiosk_id) {
    console.warn("pos.sync.cash_shift.close.kiosk_conflict", {
      tenantId,
      mutationId: mutation.mutation_id,
      cashShiftId: mutation.cash_shift_id,
      kioskId: mutation.kiosk_id,
      existingKioskId: existing.kiosk_id,
    });
    throw new MutationConflictError("Cash shift does not belong to kiosk.", {
      mutation_id: mutation.mutation_id,
    });
  }

  if (existing.status !== "open") {
    const sameTerminalState =
      existing.status === status &&
      existing.closed_by_pos_user_id === mutation.closed_by_pos_user_id &&
      existing.declared_cash_cents === declaredCashCents &&
      existing.closed_at === closedAt;

    if (sameTerminalState) {
      console.info("pos.sync.cash_shift.close.noop", {
        tenantId,
        mutationId: mutation.mutation_id,
        cashShiftId: mutation.cash_shift_id,
        kioskId: mutation.kiosk_id,
        status,
      });
      return null;
    }

    console.warn("pos.sync.cash_shift.close.conflict", {
      tenantId,
      mutationId: mutation.mutation_id,
      cashShiftId: mutation.cash_shift_id,
      kioskId: mutation.kiosk_id,
      currentStatus: existing.status,
      requestedStatus: status,
    });
    throw new MutationConflictError("Cash shift is already closed with a different state.", {
      mutation_id: mutation.mutation_id,
    });
  }

  const { error } = await supabase
    .from("cash_shifts")
    .update({
      status,
      closed_by_pos_user_id: mutation.closed_by_pos_user_id,
      declared_cash_cents: declaredCashCents,
      closed_at: closedAt,
      updated_at: closedAt,
      updated_by: null,
    })
    .eq("tenant_id", tenantId)
    .eq("id", mutation.cash_shift_id)
    .eq("status", "open");

  if (error) {
    throw new Error(`cash_shifts update failed: ${error.message}`);
  }

  console.info("pos.sync.cash_shift.close.applied", {
    tenantId,
    mutationId: mutation.mutation_id,
    cashShiftId: mutation.cash_shift_id,
    kioskId: mutation.kiosk_id,
    status,
  });

  return null;
}

function validateMutationShape(input: unknown): PosSyncMutationV2 {
  if (!input || typeof input !== "object") {
    throw new Error("Mutation must be an object.");
  }

  const mutation = input as Record<string, unknown>;
  const mutationId = ensureNonEmptyString(mutation.mutation_id, "mutation_id");
  const kioskId = ensureNonEmptyString(mutation.kiosk_id, "kiosk_id");
  const type = ensureNonEmptyString(mutation.type, "type");

  if (!MUTATION_TYPES.has(type as PosSyncMutationV2["type"])) {
    throw new Error(`Unsupported mutation type: ${type}`);
  }

  if (type === "OPEN_CASH_SHIFT" || type === "CLOSE_CASH_SHIFT") {
    const cashShiftId = ensureNonEmptyString(
      mutation.cash_shift_id,
      "cash_shift_id",
    );

    return {
      ...mutation,
      mutation_id: mutationId,
      cash_shift_id: cashShiftId,
      kiosk_id: kioskId,
      type: type as PosSyncMutationV2["type"],
    } as PosSyncMutationV2;
  }

  const orderId = ensureNonEmptyString(mutation.order_id, "order_id");

  return {
    ...mutation,
    mutation_id: mutationId,
    order_id: orderId,
    kiosk_id: kioskId,
    type: type as PosSyncMutationV2["type"],
  } as PosSyncMutationV2;
}

async function applyMutation(
  tenantId: string,
  mutation: PosSyncMutationV2,
): Promise<number | null> {
  switch (mutation.type) {
    case "OPEN_CASH_SHIFT":
      return applyOpenCashShift(tenantId, mutation);
    case "CLOSE_CASH_SHIFT":
      return applyCloseCashShift(tenantId, mutation);
    case "OPEN_TAB":
      return applyOpenTab(tenantId, mutation);
    case "ADD_ITEM":
      return applyAddItem(tenantId, mutation);
    case "UPDATE_ITEM_QTY":
      return applyUpdateItemQty(tenantId, mutation);
    case "REMOVE_ITEM":
      return applyRemoveItem(tenantId, mutation);
    case "KITCHEN_PRINT":
      return applyKitchenPrint(tenantId, mutation);
    case "CLOSE_TAB_PAID":
      return applyCloseTabPaid(tenantId, mutation);
    case "CANCEL_TAB":
      return applyCancelTab(tenantId, mutation);
    case "SALE_CREATE":
      return applySaleCreate(tenantId, mutation);
    case "SALE_REPRINT":
      return applySaleReprint(tenantId, mutation);
    case "SALE_CANCEL":
      return applySaleCancel(tenantId, mutation);
    default:
      throw new Error(`Unsupported mutation type: ${(mutation as { type: string }).type}`);
  }
}

export async function syncMutationsBatch(input: {
  tenantId: string;
  tenantSlug: string;
  mutations: unknown[];
}): Promise<PosSyncMutationsResponse> {
  const acks: PosSyncMutationAck[] = [];
  const conflicts: PosSyncMutationConflict[] = [];

  for (const rawMutation of input.mutations) {
    let mutation: PosSyncMutationV2 | null = null;
    try {
      mutation = validateMutationShape(rawMutation);
      const duplicate = await isMutationAlreadyApplied(input.tenantId, mutation.mutation_id);
      if (duplicate) {
        acks.push({
          mutation_id: mutation.mutation_id,
          status: "DUPLICATE",
          order_id: "order_id" in mutation ? mutation.order_id : undefined,
          message: "Mutation already applied.",
        });
        continue;
      }

      await assertKioskBelongsToTenant(mutation.kiosk_id, input.tenantId);
      const tabVersion = await applyMutation(input.tenantId, mutation);
      acks.push({
        mutation_id: mutation.mutation_id,
        status: "APPLIED",
        order_id: "order_id" in mutation ? mutation.order_id : undefined,
        tab_version: tabVersion ?? undefined,
      });
    } catch (error) {
      if (error instanceof MutationConflictError) {
        conflicts.push({
          mutation_id: error.details.mutation_id,
          order_id: error.details.order_id,
          reason: error.message,
          expected_tab_version: error.details.expected_tab_version ?? null,
          current_tab_version: error.details.current_tab_version ?? null,
        });
        acks.push({
          mutation_id: error.details.mutation_id,
          status: "CONFLICT",
          order_id: error.details.order_id,
          message: error.message,
        });
        continue;
      }

      const rawMutationRecord =
        rawMutation && typeof rawMutation === "object"
          ? (rawMutation as Record<string, unknown>)
          : null;
      console.error("pos.sync.mutation.unexpected_error", {
        tenantId: input.tenantId,
        tenantSlug: input.tenantSlug,
        mutationId:
          mutation?.mutation_id ||
          (typeof rawMutationRecord?.mutation_id === "string"
            ? rawMutationRecord.mutation_id
            : null),
        mutationType:
          mutation?.type ||
          (typeof rawMutationRecord?.type === "string"
            ? rawMutationRecord.type
            : null),
        aggregateId:
          mutation && "cash_shift_id" in mutation
            ? mutation.cash_shift_id
            : mutation && "order_id" in mutation
              ? mutation.order_id
              : typeof rawMutationRecord?.cash_shift_id === "string"
                ? rawMutationRecord.cash_shift_id
                : typeof rawMutationRecord?.order_id === "string"
                  ? rawMutationRecord.order_id
                  : null,
        kioskId:
          mutation?.kiosk_id ||
          (typeof rawMutationRecord?.kiosk_id === "string"
            ? rawMutationRecord.kiosk_id
            : null),
        message:
          error instanceof Error ? error.message : "Unexpected mutation error.",
      });

      const fallbackMutationId =
        mutation?.mutation_id ||
        (rawMutation && typeof rawMutation === "object" && "mutation_id" in rawMutation
          ? String((rawMutation as { mutation_id?: unknown }).mutation_id || "")
          : "");
        acks.push({
          mutation_id: fallbackMutationId || randomUUID(),
          status: "ERROR",
          order_id:
            mutation && "order_id" in mutation ? mutation.order_id : undefined,
          message: error instanceof Error ? error.message : "Unexpected mutation error.",
        });
    }
  }

  return {
    ok: conflicts.length === 0,
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    server_time: new Date().toISOString(),
    acks,
    conflicts,
  };
}
