import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertRetailPosCashierAccess,
  resolveRetailPosRuntimeActor,
} from "./auth";
import { RetailPosRuntimeError } from "./errors";
import { calculatePriceTierEconomics, classifyPriceTier, type PriceTier } from "./price-tier-economics";
import { buildRetailPosPaymentEvidence, PAYMENT_APPLICATION_SELECT } from "./payment-evidence";
import type {
  RetailPosOrderPaymentApplication,
  RetailPosPaymentTransaction,
} from "@/shared/types/retail-pos";

type PaymentHistoryPaymentRow = {
  id: string;
  tenant_id: string;
  order_id: string;
  pos_user_id: string;
  payment_method: "cash" | "card";
  amount_cents: number;
  received_amount_cents: number | null;
  change_cents: number;
  card_reference: string | null;
  cash_shift_id: string;
  device_id: string;
  paid_at: string;
  created_at: string;
  created_by: string | null;
  payment_transaction_id: string | null;
  payment_sequence: number | null;
};

type PaymentHistoryOrderRow = {
  id: string;
  tenant_id: string;
  folio: string;
  origin_local_folio: string | null;
  status: "pending_payment" | "paid" | "voided";
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  direct_discount_cents: number | null;
  order_discount_cents: number | null;
  revision: number;
  paid_at: string | null;
  created_at: string;
  cashier_pos_user_id: string | null;
  paid_by_device_id: string | null;
};
type PaymentHistoryLineRow = {
  id: string;
  order_id: string;
  line_number: number;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  sales_unit_label: string;
  quantity: string | number;
  public_unit_price_snapshot_cents: number | null;
  wholesale_unit_price_snapshot_cents: number | null;
  approved_price_tier: PriceTier | null;
  approved_unit_price_cents: number | null;
  unit_price_cents: number;
  discount_cents: number;
  direct_discount_cents: number | null;
  order_discount_allocation_cents: number | null;
  total_discount_cents: number | null;
  line_total_cents: number;
};

type PaymentHistoryOperatorRow = {
  id: string;
  name: string;
};

type PaymentHistoryDeviceSettingsRow = {
  device_id: string;
  is_active: boolean;
};

type PaymentTicketEventRow = {
  order_id: string;
  event_type: "printed" | "reprinted" | "print_failed";
  created_at: string;
};

type PostSaleTicketEventRow = {
  order_id: string;
  event_type: "printed" | "reprinted" | "print_failed";
  payload: Record<string, unknown>;
  created_at: string;
};

type PaymentHistoryPostSaleDocumentRow = {
  id: string;
  tenant_id: string;
  original_order_id: string;
  document_type: "sale_cancellation" | "return_full" | "return_partial";
  status: "draft" | "completed" | "cancelled";
  refund_status: "not_required" | "pending" | "completed" | "failed" | "cancelled";
  refund_method: "cash" | "card_external";
  refund_amount_cents: number;
  reason_code:
    | "duplicate_charge"
    | "wrong_order"
    | "wrong_payment_method"
    | "customer_cancelled_immediately"
    | "operator_error"
    | "system_error"
    | "other";
  comment: string | null;
  created_by_pos_user_id: string;
  confirmed_by_pos_user_id: string | null;
  created_at: string;
  confirmed_at: string | null;
};

type PaymentHistoryPostSaleRefundRow = {
  post_sale_document_id: string;
  refund_method: "cash" | "card_external";
  status: "not_required" | "pending" | "completed" | "failed" | "cancelled";
  amount_cents: number;
  external_reference: string | null;
};

function getPostSalePrintEvidence(documentId: string, events: PostSaleTicketEventRow[]) {
  const matching = events
    .filter((event) => {
      const metadata = event.payload?.metadata;
      if (!metadata || typeof metadata !== "object") return false;
      const record = metadata as Record<string, unknown>;
      const legacyPayload = record.payload;
      const legacyDocumentId = legacyPayload && typeof legacyPayload === "object"
        ? (legacyPayload as Record<string, unknown>).post_sale_document_id
        : undefined;
      return record.post_sale_document_id === documentId || legacyDocumentId === documentId;
    })
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
  const latest = matching[0] ?? null;
  const successful = matching.filter((event) => event.event_type === "printed" || event.event_type === "reprinted");
  return {
    print_status: latest?.event_type ?? "not_printed",
    print_count: successful.length,
    reprint_count: successful.filter((event) => event.event_type === "reprinted").length,
    last_printed_at: successful[0]?.created_at ?? null,
  } as const;
}

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
    case "voided":
      return "Orden anulada";
    case "pending_payment":
      return "Pendiente";
    case "paid":
    default:
      return "Pagado";
  }
}

function getReceiptStatusLabel(orderId: string, events: PaymentTicketEventRow[]) {
  const latestEvent = events
    .filter((event) => event.order_id === orderId)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))[0];

  if (!latestEvent) {
    return "Sin impresión";
  }

  if (latestEvent.event_type === "reprinted") {
    return "Reimpreso";
  }

  return latestEvent.event_type === "printed" ? "Impreso" : "Sin impresión";
}

function isCompletedReturnDocument(document: PaymentHistoryPostSaleDocumentRow) {
  return (
    document.status === "completed" &&
    (document.document_type === "return_full" || document.document_type === "return_partial")
  );
}

function isCompletedSaleVoidDocument(document: PaymentHistoryPostSaleDocumentRow) {
  return (
    document.status === "completed" &&
    document.document_type === "sale_cancellation"
  );
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

  assertRetailPosCashierAccess(actor);

  const paidFromIso = normalizeIso(input.paidFrom, "paid_from");
  const paidToIso = normalizeIso(input.paidTo, "paid_to");
  const limit = normalizeLimit(input.limit);

  if (Date.parse(paidFromIso) >= Date.parse(paidToIso)) {
    throw new RetailPosRuntimeError(400, "paid_from must be earlier than paid_to.");
  }

  const supabase = getSupabaseAdminClient();
  const { data: payments, error: paymentsError } = await supabase
    .from("retail_pos_payments")
    .select("id, tenant_id, order_id, cash_shift_id, device_id, pos_user_id, payment_method, amount_cents, received_amount_cents, change_cents, card_reference, paid_at, created_at, created_by, payment_transaction_id, payment_sequence")
    .eq("tenant_id", actor.tenantId)
    .gte("paid_at", paidFromIso)
    .lt("paid_at", paidToIso)
    .order("paid_at", { ascending: false })
    .limit(Math.min(limit * 2, 200))
    .returns<PaymentHistoryPaymentRow[]>();

  if (paymentsError) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos payment history: ${paymentsError.message}`,
    );
  }

  const orderIds = Array.from(new Set((payments ?? []).map((payment) => payment.order_id))).filter(Boolean);
  const paymentTransactionIds = Array.from(
    new Set((payments ?? []).map((payment) => payment.payment_transaction_id).filter((value): value is string => Boolean(value))),
  );
  const paymentOperatorIds = Array.from(
    new Set((payments ?? []).map((payment) => payment.pos_user_id)).values(),
  ).filter(Boolean);

  const [transactionsResult, applicationsResult] = await Promise.all([
    paymentTransactionIds.length
      ? supabase
          .from("retail_pos_payment_transactions")
          .select("id, tenant_id, command_id, fingerprint, total_applied_cents, expected_order_revision, cash_shift_id, device_id, pos_user_id, confirmed_at, created_at, created_by")
          .eq("tenant_id", actor.tenantId)
          .in("id", paymentTransactionIds)
          .returns<RetailPosPaymentTransaction[]>()
      : Promise.resolve({ data: [] as RetailPosPaymentTransaction[], error: null }),
    paymentTransactionIds.length
      ? supabase
          .from("retail_pos_order_payment_applications")
          .select(PAYMENT_APPLICATION_SELECT)
          .eq("tenant_id", actor.tenantId)
          .in("payment_transaction_id", paymentTransactionIds)
          .returns<RetailPosOrderPaymentApplication[]>()
      : Promise.resolve({ data: [] as RetailPosOrderPaymentApplication[], error: null }),
  ]);

  if (transactionsResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos payment transactions: ${transactionsResult.error.message}`);
  }
  if (applicationsResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos payment applications: ${applicationsResult.error.message}`);
  }

  const [deviceSettingsResult, ordersResult, ticketEventsResult, postSaleTicketEventsResult, postSaleDocumentsResult, linesResult] =
    await Promise.all([
      supabase
        .from("retail_pos_device_settings")
        .select("device_id, is_active")
        .eq("tenant_id", actor.tenantId)
        .eq("device_id", actor.deviceRecordId ?? "")
        .limit(1)
        .maybeSingle<PaymentHistoryDeviceSettingsRow>(),
    orderIds.length
      ? supabase
          .from("retail_pos_orders")
          .select(
            "id, tenant_id, folio, origin_local_folio, status, subtotal_cents, discount_cents, total_cents, direct_discount_cents, order_discount_cents, revision, paid_at, created_at, cashier_pos_user_id, paid_by_device_id",
          )
          .eq("tenant_id", actor.tenantId)
          .in("id", orderIds)
          .returns<PaymentHistoryOrderRow[]>()
      : Promise.resolve({ data: [] as PaymentHistoryOrderRow[], error: null }),
      orderIds.length
        ? supabase
            .from("retail_pos_ticket_events")
            .select("order_id, event_type, created_at")
          .eq("tenant_id", actor.tenantId)
          .eq("ticket_type", "payment")
          .in("order_id", orderIds)
          .in("event_type", ["printed", "reprinted"])
            .returns<PaymentTicketEventRow[]>()
      : Promise.resolve({ data: [] as PaymentTicketEventRow[], error: null }),
      orderIds.length
        ? supabase
            .from("retail_pos_ticket_events")
            .select("order_id, event_type, payload, created_at")
            .eq("tenant_id", actor.tenantId)
            .in("order_id", orderIds)
            .eq("ticket_type", "post_sale")
            .in("event_type", ["printed", "reprinted", "print_failed"])
            .returns<PostSaleTicketEventRow[]>()
        : Promise.resolve({ data: [] as PostSaleTicketEventRow[], error: null }),
    orderIds.length
      ? supabase
          .from("retail_pos_post_sale_documents")
          .select(
            "id, tenant_id, original_order_id, document_type, status, refund_status, refund_method, refund_amount_cents, reason_code, comment, created_by_pos_user_id, confirmed_by_pos_user_id, created_at, confirmed_at",
          )
          .eq("tenant_id", actor.tenantId)
          .in("document_type", [
            "sale_cancellation",
            "return_full",
            "return_partial",
          ])
          .in("original_order_id", orderIds)
          .order("created_at", { ascending: false })
          .returns<PaymentHistoryPostSaleDocumentRow[]>()
      : Promise.resolve({ data: [] as PaymentHistoryPostSaleDocumentRow[], error: null }),
      orderIds.length
        ? supabase.from("retail_pos_order_lines").select("id, order_id, line_number, product_name, variant_name, sku, sales_unit_label, quantity, public_unit_price_snapshot_cents, wholesale_unit_price_snapshot_cents, approved_price_tier, approved_unit_price_cents, unit_price_cents, discount_cents, direct_discount_cents, order_discount_allocation_cents, total_discount_cents, line_total_cents").eq("tenant_id", actor.tenantId).in("order_id", orderIds).order("line_number", { ascending: true }).returns<PaymentHistoryLineRow[]>()
        : Promise.resolve({ data: [] as PaymentHistoryLineRow[], error: null }),
  ]);

  if (deviceSettingsResult.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos payment history device settings: ${deviceSettingsResult.error.message}`,
    );
  }

  if (ordersResult.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos payment history orders: ${ordersResult.error.message}`,
    );
  }

  if (postSaleDocumentsResult.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos payment history post sale documents: ${postSaleDocumentsResult.error.message}`,
    );
  }

  if (ticketEventsResult.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos payment history ticket events: ${ticketEventsResult.error.message}`,
    );
  }
  if (postSaleTicketEventsResult.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos post-sale ticket events: ${postSaleTicketEventsResult.error.message}`,
    );
  }
  if (linesResult.error) throw new RetailPosRuntimeError(500, `Unable to load retail_pos payment history lines: ${linesResult.error.message}`);

  const postSaleDocuments = postSaleDocumentsResult.data ?? [];
  const postSaleDocumentIds = Array.from(new Set(postSaleDocuments.map((document) => document.id)));
  const postSaleRefundsResult = postSaleDocumentIds.length
    ? await supabase
        .from("retail_pos_post_sale_refunds")
        .select("post_sale_document_id, refund_method, status, amount_cents, external_reference")
        .eq("tenant_id", actor.tenantId)
        .in("post_sale_document_id", postSaleDocumentIds)
        .returns<PaymentHistoryPostSaleRefundRow[]>()
    : { data: [] as PaymentHistoryPostSaleRefundRow[], error: null };

  if (postSaleRefundsResult.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos payment history post sale refunds: ${postSaleRefundsResult.error.message}`,
    );
  }

  const operatorIds = Array.from(
    new Set(
      [
        ...paymentOperatorIds,
        ...postSaleDocuments.map((document) => document.created_by_pos_user_id),
        ...postSaleDocuments
          .map((document) => document.confirmed_by_pos_user_id)
          .filter((value): value is string => Boolean(value)),
      ].filter(Boolean),
    ),
  );

  const operatorsResult = operatorIds.length
    ? await supabase
        .from("pos_users")
        .select("id, name")
        .eq("tenant_id", actor.tenantId)
        .in("id", operatorIds)
        .returns<PaymentHistoryOperatorRow[]>()
    : { data: [] as PaymentHistoryOperatorRow[], error: null };

  if (operatorsResult.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos payment history operators: ${operatorsResult.error.message}`,
    );
  }

  const postSaleCapabilitiesEnabled =
    (actor.deviceRole === "cashier_station" || actor.deviceRole === "multi_station") &&
    deviceSettingsResult.data?.is_active === true;
  const ordersById = new Map((ordersResult.data ?? []).map((order) => [order.id, order]));
  const transactionsById = new Map((transactionsResult.data ?? []).map((transaction) => [transaction.id, transaction]));
  const applicationsByTransactionId = new Map(
    (applicationsResult.data ?? []).map((application) => [application.payment_transaction_id, application]),
  );
  const operatorsById = new Map((operatorsResult.data ?? []).map((operator) => [operator.id, operator]));
  const printedOrderIds = new Set((ticketEventsResult.data ?? []).map((event) => event.order_id));
  const ticketEvents = ticketEventsResult.data ?? [];
  const refundsByDocumentId = new Map(
    (postSaleRefundsResult.data ?? []).map((refund) => [refund.post_sale_document_id, refund]),
  );
  const postSaleByOrderId = new Map<string, PaymentHistoryPostSaleDocumentRow[]>();
  const linesByOrderId = new Map<string, PaymentHistoryLineRow[]>();
  for (const line of linesResult.data ?? []) linesByOrderId.set(line.order_id, [...(linesByOrderId.get(line.order_id) ?? []), line]);
  for (const document of postSaleDocuments) {
    const current = postSaleByOrderId.get(document.original_order_id) ?? [];
    current.push(document);
    postSaleByOrderId.set(document.original_order_id, current);
  }

  const paymentGroups = new Map<string, PaymentHistoryPaymentRow[]>();
  for (const payment of payments ?? []) {
    if (!payment.payment_transaction_id) {
      throw new RetailPosRuntimeError(500, "PAYMENT_TRANSACTION_NOT_FOUND", "PAYMENT_TRANSACTION_NOT_FOUND");
    }
    const current = paymentGroups.get(payment.payment_transaction_id) ?? [];
    current.push(payment);
    paymentGroups.set(payment.payment_transaction_id, current);
  }
  const evidenceByTransactionId = new Map<string, ReturnType<typeof buildRetailPosPaymentEvidence>>();
  for (const [transactionId, group] of paymentGroups) {
    const paymentAnchor = group[0];
    const order = paymentAnchor ? ordersById.get(paymentAnchor.order_id) : null;
    if (!order) throw new RetailPosRuntimeError(500, "PAYMENT_EVIDENCE_NOT_FOUND", "PAYMENT_EVIDENCE_NOT_FOUND");
    const transaction = transactionsById.get(transactionId) ?? null;
    const application = applicationsByTransactionId.get(transactionId) ?? null;
    const evidence = buildRetailPosPaymentEvidence({
      order,
      lines: linesByOrderId.get(order.id) ?? [],
      paymentTransaction: transaction,
      application,
      payments: group,
    });
    evidenceByTransactionId.set(transactionId, evidence);
  }

  return {
    items: Array.from(paymentGroups.entries()).slice(0, limit).map(([transactionId, transactionPayments]) => {
      const paymentAnchor = transactionPayments[0];
      if (!paymentAnchor) throw new RetailPosRuntimeError(500, "PAYMENT_EVIDENCE_NOT_FOUND", "PAYMENT_EVIDENCE_NOT_FOUND");
      const evidence = evidenceByTransactionId.get(transactionId);
      if (!evidence) throw new RetailPosRuntimeError(500, "PAYMENT_EVIDENCE_NOT_FOUND", "PAYMENT_EVIDENCE_NOT_FOUND");
      const order = ordersById.get(paymentAnchor.order_id);
      const operator = operatorsById.get(paymentAnchor.pos_user_id);
      const postSaleDocumentsForOrder = (postSaleByOrderId.get(paymentAnchor.order_id) ?? [])
        .slice()
        .sort((left, right) => left.created_at.localeCompare(right.created_at));
      const latestPostSaleDocument =
        postSaleDocumentsForOrder.length > 0
          ? postSaleDocumentsForOrder[postSaleDocumentsForOrder.length - 1]
          : null;
      const latestPostSaleRefund = latestPostSaleDocument
        ? refundsByDocumentId.get(latestPostSaleDocument.id) ?? null
        : null;
      const hasCompletedSaleVoid = postSaleDocumentsForOrder.some(isCompletedSaleVoidDocument);
      const hasActiveSaleCancellation = postSaleDocumentsForOrder.some(
        (document) =>
          document.document_type === "sale_cancellation" &&
          (document.status === "completed" || document.status === "draft"),
      );
      const completedReturnDocuments = postSaleDocumentsForOrder.filter(isCompletedReturnDocument);
      const totalReturnedAmountCents = completedReturnDocuments.reduce(
        (sum, document) => sum + document.refund_amount_cents,
        0,
      );
      const eligibleAmountCents = hasCompletedSaleVoid
        ? 0
        : Math.max((order?.total_cents ?? paymentAnchor.amount_cents) - totalReturnedAmountCents, 0);
      const returnState =
        hasCompletedSaleVoid || eligibleAmountCents <= 0
          ? "fully_returned"
          : totalReturnedAmountCents > 0
            ? "partially_returned"
            : "not_returned";
      const postSaleHistoryDocuments = postSaleDocumentsForOrder.map((document) => {
        const refund = refundsByDocumentId.get(document.id) ?? null;
        const createdBy = operatorsById.get(document.created_by_pos_user_id);
        const confirmedBy = document.confirmed_by_pos_user_id
          ? operatorsById.get(document.confirmed_by_pos_user_id)
          : null;

        return {
          document_id: document.id,
          document_type: document.document_type,
          document_status: document.status,
          refund_method: refund?.refund_method ?? document.refund_method ?? null,
          refund_status: refund?.status ?? document.refund_status ?? null,
          refund_amount_cents: refund?.amount_cents ?? document.refund_amount_cents,
          external_reference: refund?.external_reference ?? null,
          reason_code: document.reason_code,
          comment: document.comment,
          created_at: document.created_at,
          created_by_pos_user_id: document.created_by_pos_user_id,
          created_by_pos_user_name: createdBy?.name ?? null,
          confirmed_at: document.confirmed_at,
          confirmed_by_pos_user_id: document.confirmed_by_pos_user_id,
          confirmed_by_pos_user_name: confirmedBy?.name ?? null,
          can_confirm_external_card_refund:
            postSaleCapabilitiesEnabled &&
            (refund?.refund_method ?? document.refund_method) === "card_external" &&
            (refund?.status ?? document.refund_status) === "pending",
          can_print_receipt: true,
          ...getPostSalePrintEvidence(document.id, postSaleTicketEventsResult.data ?? []),
        };
      });
      const pendingExternalRefundCount = postSaleHistoryDocuments.filter(
        (document) =>
          document.refund_method === "card_external" &&
          document.refund_status === "pending",
      ).length;
      const orderStatus = order?.status ?? "paid";
      const lineDiscountCents = order?.direct_discount_cents ?? 0;
      const orderDiscountCents = order?.order_discount_cents ?? 0;
      const totalDiscountCents = order?.discount_cents ?? 0;
      const priceLines = linesByOrderId.get(paymentAnchor.order_id) ?? [];
      const priceTier = classifyPriceTier(priceLines);
      const wholesaleDifferenceCents = priceLines.filter((line) => line.approved_price_tier === "wholesale").reduce((sum, line) => sum + (calculatePriceTierEconomics(line).priceTierDifferenceCents ?? 0), 0);

      return {
        payment_id: evidence.payment_transaction.id,
        payment_transaction_id: evidence.payment_transaction.id,
        payment_evidence: evidence,
        order_id: paymentAnchor.order_id,
        order_folio: order?.folio ?? "",
        order_local_folio: order?.origin_local_folio ?? null,
        amount_cents: evidence.application.amount_cents,
        gross_cents: order?.subtotal_cents ?? paymentAnchor.amount_cents,
        line_discount_cents: lineDiscountCents,
        order_discount_cents: orderDiscountCents,
        total_discount_cents: totalDiscountCents,
        payment_method: evidence.payment_summary === "card" ? "card" : "cash",
        payment_summary: evidence.payment_summary,
        payments: evidence.payments,
        order_status: orderStatus,
        payment_status_label: getPaymentStatusLabel(orderStatus),
        paid_at: paymentAnchor.paid_at,
        operator_id: paymentAnchor.pos_user_id ?? null,
        operator_name: operator?.name ?? null,
        has_printed_receipt: printedOrderIds.has(paymentAnchor.order_id),
        receipt_status_label: getReceiptStatusLabel(paymentAnchor.order_id, ticketEvents),
        has_discounts: totalDiscountCents > 0,
        price_tier: priceTier,
        wholesale_difference_cents: wholesaleDifferenceCents,
        can_cancel:
          postSaleCapabilitiesEnabled &&
          orderStatus === "paid" &&
          !hasActiveSaleCancellation,
        cancel_disabled_reason:
          hasActiveSaleCancellation
            ? "La venta ya tiene una cancelación registrada."
            : !postSaleCapabilitiesEnabled
              ? "Esta caja no tiene postventa habilitada."
              : orderStatus !== "paid"
                ? "Solo se pueden anular ventas pagadas."
                : null,
        can_start_return:
          postSaleCapabilitiesEnabled &&
          orderStatus === "paid" &&
          !hasCompletedSaleVoid &&
          eligibleAmountCents > 0,
        return_disabled_reason:
          hasCompletedSaleVoid
            ? "La venta ya fue anulada completamente."
            : !postSaleCapabilitiesEnabled
              ? "Esta caja no tiene postventa habilitada."
              : orderStatus !== "paid"
                ? "Solo se pueden devolver ventas pagadas."
                : eligibleAmountCents <= 0
                  ? "La venta ya no tiene importe devolvible."
                  : null,
        has_any_post_sale: postSaleDocumentsForOrder.length > 0,
        post_sale_return_state: returnState,
        post_sale_returned_amount_cents: totalReturnedAmountCents,
        post_sale_eligible_amount_cents: eligibleAmountCents,
        post_sale_pending_external_refund_count: pendingExternalRefundCount,
        post_sale_document_id: latestPostSaleDocument?.id ?? null,
        post_sale_document_type: latestPostSaleDocument?.document_type ?? null,
        post_sale_document_status: latestPostSaleDocument?.status ?? null,
        post_sale_refund_method:
          latestPostSaleRefund?.refund_method ?? latestPostSaleDocument?.refund_method ?? null,
        post_sale_refund_status:
          latestPostSaleRefund?.status ?? latestPostSaleDocument?.refund_status ?? null,
        post_sale_refund_amount_cents:
          latestPostSaleRefund?.amount_cents ?? latestPostSaleDocument?.refund_amount_cents ?? null,
        post_sale_external_reference: latestPostSaleRefund?.external_reference ?? null,
        post_sale_reason_code: latestPostSaleDocument?.reason_code ?? null,
        post_sale_comment: latestPostSaleDocument?.comment ?? null,
        post_sale_created_at: latestPostSaleDocument?.created_at ?? null,
        post_sale_created_by_pos_user_id: latestPostSaleDocument?.created_by_pos_user_id ?? null,
        post_sale_confirmed_at: latestPostSaleDocument?.confirmed_at ?? null,
        post_sale_confirmed_by_pos_user_id:
          latestPostSaleDocument?.confirmed_by_pos_user_id ?? null,
        can_confirm_external_card_refund:
          latestPostSaleDocument != null &&
          postSaleCapabilitiesEnabled &&
          (latestPostSaleRefund?.refund_method ?? latestPostSaleDocument.refund_method) === "card_external" &&
          (latestPostSaleRefund?.status ?? latestPostSaleDocument.refund_status) === "pending",
        can_print_post_sale_receipt: latestPostSaleDocument != null,
        post_sale_documents: postSaleHistoryDocuments,
      };
    }),
    supports_payment_cancellation: postSaleCapabilitiesEnabled,
    cancellation_policy_note:
      postSaleCapabilitiesEnabled
        ? "La anulacion total crea un documento compensatorio. La venta y el pago original permanecen intactos."
        : "Esta caja no tiene postventa habilitada para anulaciones seguras.",
  };
}
