import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  PosOrderSyncBatchEntry,
  PosOrderSyncEvent,
  PosOrderSyncItem,
  PosOrderSyncOrder,
  PosSyncOrdersRejected,
  PosSyncOrdersResponse,
} from "@/types/pos";

const ALLOWED_ORDER_STATUS = new Set(["OPEN", "PAID", "CANCELED"]);
const ALLOWED_PRINT_STATUS = new Set(["QUEUED", "SENT", "CONFIRMED", "FAILED", "UNKNOWN"]);
const ALLOWED_PAYMENT_METHODS = new Set(["cash", "card", "employee", "efectivo", "tarjeta"]);
const ALLOWED_EVENT_TYPES = new Set([
  "PRINTED",
  "REPRINTED",
  "PRINT_ERROR",
  "CANCELED",
  "CUT_PRINTED",
  "PAYMENT_CAPTURED",
  "TAB_OPENED",
  "TAB_ITEM_ADDED",
  "TAB_ITEM_UPDATED",
  "TAB_ITEM_REMOVED",
  "KITCHEN_PRINTED",
  "KITCHEN_PRINT_ERROR",
  "TAB_CLOSED",
]);

function parseOptionalIsoTimestamp(value: unknown, fieldName: string): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be an ISO timestamp string.`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO timestamp.`);
  }

  return parsed.toISOString();
}

function parseOptionalNonNegativeInt(value: unknown, fieldName: string): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }
  return parsed;
}

function normalizePaymentMethod(value: unknown, fieldName: string): "cash" | "card" | "employee" | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }
  const normalized = value.trim().toLowerCase();
  if (!ALLOWED_PAYMENT_METHODS.has(normalized)) {
    throw new Error(`${fieldName} must be one of: cash, card, employee.`);
  }
  if (normalized === "efectivo") return "cash";
  if (normalized === "tarjeta") return "card";
  return normalized as "cash" | "card" | "employee";
}

function sanitizeOrder(order: PosOrderSyncOrder, tenantId: string) {
  if (!order?.id || !order?.kiosk_id) {
    throw new Error("order.id and order.kiosk_id are required.");
  }

  if (!ALLOWED_ORDER_STATUS.has(order.status)) {
    throw new Error(`Unsupported order status: ${order.status}`);
  }

  if (!ALLOWED_PRINT_STATUS.has(order.print_status)) {
    throw new Error(`Unsupported print status: ${order.print_status}`);
  }

  const canceledAt = parseOptionalIsoTimestamp(order.canceled_at, "order.canceled_at");
  const paymentReceivedCents = parseOptionalNonNegativeInt(
    order.payment_received_cents ?? order.pago_recibido_cents,
    "order.payment_received_cents",
  );
  const changeCents = parseOptionalNonNegativeInt(
    order.change_cents ?? order.cambio_cents,
    "order.change_cents",
  );
  const paymentMethod = normalizePaymentMethod(
    order.payment_method ?? order.metodo_pago,
    "order.payment_method",
  );
  const cancelReason =
    typeof order.cancel_reason === "string" && order.cancel_reason.trim()
      ? order.cancel_reason.trim()
      : null;

  return {
    id: order.id,
    tenant_id: tenantId,
    kiosk_id: order.kiosk_id,
    folio_number: order.folio_number,
    folio_text: order.folio_text,
    status: order.status,
    total_cents: order.total_cents,
    payment_received_cents: paymentReceivedCents,
    change_cents: changeCents,
    payment_method: paymentMethod,
    canceled_at: canceledAt,
    cancel_reason: cancelReason,
    print_status: order.print_status,
    print_attempt_count: order.print_attempt_count,
    last_print_error: order.last_print_error ?? null,
    last_print_at: order.last_print_at ?? null,
  };
}

function sanitizeItems(items: PosOrderSyncItem[], tenantId: string) {
  return (items || []).map((item) => {
    if (!item?.id || !item?.order_id || !item?.catalog_item_id) {
      throw new Error("order item requires id, order_id and catalog_item_id.");
    }

    return {
      id: item.id,
      tenant_id: tenantId,
      order_id: item.order_id,
      catalog_item_id: item.catalog_item_id,
      qty: item.qty,
      unit_price_cents: item.unit_price_cents,
      line_total_cents: item.line_total_cents,
      variants: item.variants ?? null,
    };
  });
}

function sanitizeEvents(events: PosOrderSyncEvent[], tenantId: string) {
  return (events || [])
    .filter((event) => ALLOWED_EVENT_TYPES.has(event.type))
    .map((event) => {
      if (!event?.id || !event?.order_id) {
        throw new Error("order event requires id and order_id.");
      }

      const createdAt = parseOptionalIsoTimestamp(event.created_at, "event.created_at");

      return {
        id: event.id,
        tenant_id: tenantId,
        order_id: event.order_id,
        type: event.type,
        meta: event.meta ?? null,
        ...(createdAt ? { created_at: createdAt } : {}),
      };
    });
}

async function assertKioskBelongsToTenant(kioskId: string, tenantId: string) {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("kiosks")
    .select("id")
    .eq("id", kioskId)
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(`Unable to validate kiosk: ${error.message}`);
  }

  if (!data) {
    throw new Error("kiosk_id does not belong to tenant.");
  }
}

export async function syncOrderBatch(input: {
  tenantId: string;
  tenantSlug: string;
  batch: PosOrderSyncBatchEntry[];
}): Promise<PosSyncOrdersResponse> {
  const supabase = getSupabaseAdminClient();
  const acceptedIds: string[] = [];
  const rejected: PosSyncOrdersRejected[] = [];

  for (const entry of input.batch) {
    const outboxId = entry?.outboxId;

    if (!outboxId) {
      rejected.push({ outboxId: "", reason: "Missing outboxId." });
      continue;
    }

    try {
      const order = sanitizeOrder(entry.order, input.tenantId);
      if (entry.order.tenant_id && entry.order.tenant_id !== input.tenantId) {
        throw new Error("Order tenant_id mismatch.");
      }

      await assertKioskBelongsToTenant(order.kiosk_id, input.tenantId);

      const items = sanitizeItems(entry.items, input.tenantId);
      const events = sanitizeEvents(entry.events, input.tenantId);

      const itemsTotal = items.reduce((acc, item) => acc + item.line_total_cents, 0);
      if (items.length && itemsTotal !== order.total_cents) {
        throw new Error(`Order total mismatch. expected=${order.total_cents} actual=${itemsTotal}`);
      }

      const { error: orderError } = await supabase.from("orders").upsert(order, { onConflict: "id" });
      if (orderError) {
        throw new Error(`orders upsert failed: ${orderError.message}`);
      }

      if (items.length) {
        const { error: itemsError } = await supabase.from("order_items").upsert(items, { onConflict: "id" });
        if (itemsError) {
          throw new Error(`order_items upsert failed: ${itemsError.message}`);
        }
      }

      if (events.length) {
        const { error: eventsError } = await supabase.from("order_events").upsert(events, { onConflict: "id" });
        if (eventsError) {
          throw new Error(`order_events upsert failed: ${eventsError.message}`);
        }
      }

      acceptedIds.push(outboxId);
    } catch (error) {
      rejected.push({
        outboxId,
        reason: error instanceof Error ? error.message : "Unknown sync failure.",
      });
    }
  }

  return {
    ok: rejected.length === 0,
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    syncedAt: new Date().toISOString(),
    acceptedIds,
    rejected,
  };
}
