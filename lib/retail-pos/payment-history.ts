import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertRetailPosDeviceRole,
  resolveRetailPosRuntimeActor,
} from "./auth";
import { RetailPosRuntimeError } from "./errors";

type PaymentHistoryPaymentRow = {
  id: string;
  tenant_id: string;
  order_id: string;
  pos_user_id: string;
  payment_method: "cash" | "card";
  amount_cents: number;
  paid_at: string;
};

type PaymentHistoryOrderRow = {
  id: string;
  tenant_id: string;
  folio: string;
  origin_local_folio: string | null;
  status: "pending_payment" | "paid" | "cancelled";
};

type PaymentHistoryOperatorRow = {
  id: string;
  name: string;
};

type PaymentTicketEventRow = {
  order_id: string;
  event_type: "printed" | "reprinted" | "print_failed";
};

function normalizeIso(value: string | null | undefined, field: string) {
  if (!value?.trim()) {
    throw new RetailPosRuntimeError(400, `${field} is required.`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RetailPosRuntimeError(400, `${field} must be a valid ISO timestamp.`);
  }

  return date.toISOString();
}

function normalizeLimit(value: string | null | undefined) {
  if (!value) {
    return 100;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new RetailPosRuntimeError(400, "limit must be a positive integer.");
  }

  return Math.min(parsed, 200);
}

function getPaymentStatusLabel(orderStatus: PaymentHistoryOrderRow["status"]) {
  switch (orderStatus) {
    case "cancelled":
      return "Orden cancelada";
    case "pending_payment":
      return "Pendiente";
    case "paid":
    default:
      return "Pagado";
  }
}

export async function listRetailPosPaymentHistory(input: {
  tenantSlug: string;
  paidFrom: string | null | undefined;
  paidTo: string | null | undefined;
  limit: string | null | undefined;
  deviceId?: string | null;
  deviceSecret?: string | null;
}) {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
  });

  assertRetailPosDeviceRole(actor, ["cashier_station"]);

  const paidFromIso = normalizeIso(input.paidFrom, "paid_from");
  const paidToIso = normalizeIso(input.paidTo, "paid_to");
  const limit = normalizeLimit(input.limit);

  if (Date.parse(paidFromIso) >= Date.parse(paidToIso)) {
    throw new RetailPosRuntimeError(400, "paid_from must be earlier than paid_to.");
  }

  const supabase = getSupabaseAdminClient();
  const { data: payments, error: paymentsError } = await supabase
    .from("retail_pos_payments")
    .select("id, tenant_id, order_id, pos_user_id, payment_method, amount_cents, paid_at")
    .eq("tenant_id", actor.tenantId)
    .gte("paid_at", paidFromIso)
    .lt("paid_at", paidToIso)
    .order("paid_at", { ascending: false })
    .limit(limit)
    .returns<PaymentHistoryPaymentRow[]>();

  if (paymentsError) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos payment history: ${paymentsError.message}`,
    );
  }

  const orderIds = Array.from(new Set((payments ?? []).map((payment) => payment.order_id))).filter(Boolean);
  const operatorIds = Array.from(new Set((payments ?? []).map((payment) => payment.pos_user_id))).filter(Boolean);

  const [ordersResult, operatorsResult, ticketEventsResult] = await Promise.all([
    orderIds.length
      ? supabase
          .from("retail_pos_orders")
          .select("id, tenant_id, folio, origin_local_folio, status")
          .eq("tenant_id", actor.tenantId)
          .in("id", orderIds)
          .returns<PaymentHistoryOrderRow[]>()
      : Promise.resolve({ data: [] as PaymentHistoryOrderRow[], error: null }),
    operatorIds.length
      ? supabase
          .from("pos_users")
          .select("id, name")
          .eq("tenant_id", actor.tenantId)
          .in("id", operatorIds)
          .returns<PaymentHistoryOperatorRow[]>()
      : Promise.resolve({ data: [] as PaymentHistoryOperatorRow[], error: null }),
    orderIds.length
      ? supabase
          .from("retail_pos_ticket_events")
          .select("order_id, event_type")
          .eq("tenant_id", actor.tenantId)
          .eq("ticket_type", "payment")
          .in("order_id", orderIds)
          .in("event_type", ["printed", "reprinted"])
          .returns<PaymentTicketEventRow[]>()
      : Promise.resolve({ data: [] as PaymentTicketEventRow[], error: null }),
  ]);

  if (ordersResult.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos payment history orders: ${ordersResult.error.message}`,
    );
  }

  if (operatorsResult.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos payment history operators: ${operatorsResult.error.message}`,
    );
  }

  if (ticketEventsResult.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos payment history ticket events: ${ticketEventsResult.error.message}`,
    );
  }

  const ordersById = new Map((ordersResult.data ?? []).map((order) => [order.id, order]));
  const operatorsById = new Map((operatorsResult.data ?? []).map((operator) => [operator.id, operator]));
  const printedOrderIds = new Set((ticketEventsResult.data ?? []).map((event) => event.order_id));

  return {
    items: (payments ?? []).map((payment) => {
      const order = ordersById.get(payment.order_id);
      const operator = operatorsById.get(payment.pos_user_id);
      const orderStatus = order?.status ?? "paid";

      return {
        payment_id: payment.id,
        order_id: payment.order_id,
        order_folio: order?.folio ?? "",
        order_local_folio: order?.origin_local_folio ?? null,
        amount_cents: payment.amount_cents,
        payment_method: payment.payment_method,
        order_status: orderStatus,
        payment_status_label: getPaymentStatusLabel(orderStatus),
        paid_at: payment.paid_at,
        operator_id: payment.pos_user_id ?? null,
        operator_name: operator?.name ?? null,
        has_printed_receipt: printedOrderIds.has(payment.order_id),
        can_cancel: false,
        cancel_disabled_reason:
          "La cancelacion segura de pagos cobrados aun no esta implementada en retail_pos.",
      };
    }),
    supports_payment_cancellation: false,
    cancellation_policy_note:
      "El backend actual solo permite cancelar ordenes en estado pending_payment antes del cobro; no existe void/refund seguro para pagos ya registrados.",
  };
}
