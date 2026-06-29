import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  RetailPosTicketEvent,
  RetailPosTicketEventRequest,
  RetailPosTicketEventResponse,
  RetailPosTicketEventType,
  RetailPosTicketType,
} from "@/shared/types/retail-pos";
import {
  assertRetailPosOrderTicketAccess,
  assertRetailPosDeviceRole,
  resolveRetailPosRuntimeActor,
} from "./auth";
import { RetailPosRuntimeError } from "./errors";

type OrderRow = {
  id: string;
  tenant_id: string;
  status: "pending_payment" | "paid" | "cancelled";
};

type PaymentRow = {
  id: string;
  order_id: string;
};

type TicketEventRow = RetailPosTicketEvent & {
  payload: Record<string, unknown>;
};

function normalizeRequiredString(value: unknown, field: string) {
  if (typeof value !== "string") {
    throw new RetailPosRuntimeError(400, `${field} must be a string.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new RetailPosRuntimeError(400, `${field} is required.`);
  }

  return normalized;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeTicketType(value: unknown): RetailPosTicketType {
  const normalized = normalizeRequiredString(value, "ticket_type");

  if (normalized === "order_ticket" || normalized === "order") {
    return "order";
  }

  if (normalized === "payment_ticket" || normalized === "payment") {
    return "payment";
  }

  throw new RetailPosRuntimeError(400, "ticket_type is invalid.");
}

function normalizeEventType(value: unknown): RetailPosTicketEventType {
  const normalized = normalizeRequiredString(value, "event_type");

  if (
    normalized === "printed" ||
    normalized === "reprinted" ||
    normalized === "print_failed"
  ) {
    return normalized;
  }

  throw new RetailPosRuntimeError(400, "event_type is invalid.");
}

function normalizePrintedAt(value: unknown) {
  if (value == null) {
    return new Date().toISOString();
  }

  const normalized = normalizeRequiredString(value, "printed_at");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new RetailPosRuntimeError(400, "printed_at must be a valid ISO timestamp.");
  }

  return date.toISOString();
}

function normalizeMetadata(value: unknown) {
  if (value == null) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new RetailPosRuntimeError(400, "metadata must be an object.");
  }

  return value as Record<string, unknown>;
}

async function loadOrder(tenantId: string, orderId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_orders")
    .select("id, tenant_id, status")
    .eq("tenant_id", tenantId)
    .eq("id", orderId)
    .limit(1)
    .maybeSingle<OrderRow>();

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos order: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(404, "retail_pos order not found.");
  }

  return data;
}

async function loadPaymentForOrder(tenantId: string, orderId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_payments")
    .select("id, order_id")
    .eq("tenant_id", tenantId)
    .eq("order_id", orderId)
    .limit(1)
    .maybeSingle<PaymentRow>();

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos payment: ${error.message}`);
  }

  return data ?? null;
}

async function findExistingTicketEventByClientEventId(input: {
  tenantId: string;
  clientEventId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_ticket_events")
    .select(
      "id, tenant_id, order_id, device_id, pos_user_id, ticket_type, event_type, printer_name, payload, occurred_at, created_at, created_by",
    )
    .eq("tenant_id", input.tenantId)
    .contains("payload", { client_event_id: input.clientEventId })
    .limit(1)
    .maybeSingle<TicketEventRow>();

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to resolve retail_pos ticket event idempotency: ${error.message}`);
  }

  return data ?? null;
}

export async function recordRetailPosTicketEvent(input: {
  tenantSlug: string;
  request: RetailPosTicketEventRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
}): Promise<RetailPosTicketEventResponse> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
  });

  if (actor.mode !== "device" || !actor.deviceRecordId) {
    throw new RetailPosRuntimeError(401, "device auth is required for retail_pos ticket events.");
  }

  const orderId = normalizeRequiredString(input.request.order_id, "order_id");
  const ticketType = normalizeTicketType(input.request.ticket_type);
  const eventType = normalizeEventType(input.request.event_type);
  const clientEventId = normalizeRequiredString(input.request.client_event_id, "client_event_id");
  const printedAt = normalizePrintedAt(input.request.printed_at);
  const printerName = normalizeOptionalString(input.request.printer_name);
  const errorMessage = normalizeOptionalString(input.request.error_message);
  const metadata = normalizeMetadata(input.request.metadata);

  if (ticketType === "payment") {
    assertRetailPosDeviceRole(actor, ["cashier_station"]);
  } else {
    assertRetailPosOrderTicketAccess(actor);
  }

  const existing = await findExistingTicketEventByClientEventId({
    tenantId: actor.tenantId,
    clientEventId,
  });

  if (existing) {
    return {
      event: existing,
      idempotent: true,
      synced_at: new Date().toISOString(),
    };
  }

  const order = await loadOrder(actor.tenantId, orderId);
  if (ticketType === "payment") {
    const payment = await loadPaymentForOrder(actor.tenantId, orderId);
    if (order.status !== "paid" || !payment) {
      throw new RetailPosRuntimeError(409, "payment_ticket requires a paid retail_pos order with confirmed payment.");
    }
  }

  const payload: Record<string, unknown> = {
    client_event_id: clientEventId,
    printed_at: printedAt,
    error_message: errorMessage,
    metadata,
  };

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_ticket_events")
    .insert({
      tenant_id: actor.tenantId,
      order_id: order.id,
      device_id: actor.deviceRecordId,
      pos_user_id: null,
      ticket_type: ticketType,
      event_type: eventType,
      printer_name: printerName,
      payload,
      occurred_at: printedAt,
    })
    .select(
      "id, tenant_id, order_id, device_id, pos_user_id, ticket_type, event_type, printer_name, payload, occurred_at, created_at, created_by",
    )
    .limit(1)
    .maybeSingle<TicketEventRow>();

  if (error) {
    throw new RetailPosRuntimeError(400, `Unable to record retail_pos ticket event: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(500, "retail_pos ticket event insert did not return a record.");
  }

  return {
    event: data,
    idempotent: false,
    synced_at: new Date().toISOString(),
  };
}
