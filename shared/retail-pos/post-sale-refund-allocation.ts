import type {
  RetailPosPaymentEvidence,
  RetailPosPostSaleRefundAllocation,
  RetailPosPostSaleRefundTender,
} from "../types/retail-pos";

export const RETAIL_POS_POST_SALE_REFUND_ERRORS = {
  evidenceRequired: "POST_SALE_PAYMENT_EVIDENCE_REQUIRED",
  evidenceInconsistent: "POST_SALE_PAYMENT_EVIDENCE_INCONSISTENT",
  methodUnsupported: "POST_SALE_PAYMENT_METHOD_UNSUPPORTED",
  allocationInvalid: "POST_SALE_REFUND_ALLOCATION_INVALID",
  alreadyCancelled: "POST_SALE_ALREADY_CANCELLED",
  cardAmountMismatch: "POST_SALE_CARD_REFUND_AMOUNT_MISMATCH",
  cashAmountMismatch: "POST_SALE_CASH_REFUND_AMOUNT_MISMATCH",
} as const;
export const RETAIL_POS_POST_SALE_REFUND_ALLOCATION_ERROR =
  RETAIL_POS_POST_SALE_REFUND_ERRORS.allocationInvalid;

export class RetailPosPostSaleRefundAllocationError extends Error {
  readonly code: (typeof RETAIL_POS_POST_SALE_REFUND_ERRORS)[keyof typeof RETAIL_POS_POST_SALE_REFUND_ERRORS] =
    RETAIL_POS_POST_SALE_REFUND_ALLOCATION_ERROR;

  constructor(message: string) {
    super(message);
    this.name = "RetailPosPostSaleRefundAllocationError";
  }
}

function invalid(
  message: string,
  code: (typeof RETAIL_POS_POST_SALE_REFUND_ERRORS)[keyof typeof RETAIL_POS_POST_SALE_REFUND_ERRORS] =
    RETAIL_POS_POST_SALE_REFUND_ERRORS.allocationInvalid,
): never {
  const error = new RetailPosPostSaleRefundAllocationError(message);
  Object.defineProperty(error, "code", { value: code, enumerable: true });
  throw error;
}

function assertSafeCents(value: unknown, field: string, allowZero = true): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    (allowZero ? value < 0 : value <= 0)
  ) {
    invalid(`${field} must be a safe integer in cents.`);
  }
}

function assertId(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") invalid(`${field} is required.`);
}

export function buildRetailPosPostSaleRefundAllocation(
  evidence: RetailPosPaymentEvidence,
): RetailPosPostSaleRefundAllocation {
  if (!evidence || typeof evidence !== "object") invalid("payment evidence is required.", RETAIL_POS_POST_SALE_REFUND_ERRORS.evidenceRequired);
  const { order, payment_transaction: transaction, application, payments } = evidence;
  if (!order || !transaction || !application || !Array.isArray(payments)) {
    invalid("complete payment evidence is required.", RETAIL_POS_POST_SALE_REFUND_ERRORS.evidenceRequired);
  }
  if (order.status === "voided" || order.status === "cancelled") {
    invalid("the sale is already cancelled.", RETAIL_POS_POST_SALE_REFUND_ERRORS.alreadyCancelled);
  }
  if (order.status !== "paid") invalid("only paid orders can be refunded.", RETAIL_POS_POST_SALE_REFUND_ERRORS.evidenceInconsistent);
  if (payments.length < 1 || payments.length > 2) invalid("one or two original tenders are required.");

  assertId(order.id, "order.id");
  assertId(transaction.id, "payment_transaction.id");
  assertId(application.id, "application.id");
  if (transaction.tenant_id !== order.tenant_id || application.tenant_id !== order.tenant_id) {
    invalid("payment evidence tenant mismatch.");
  }
  if (transaction.id !== application.payment_transaction_id) invalid("application transaction mismatch.");
  if (application.order_id !== order.id) invalid("application order mismatch.");
  if (application.application_sequence !== 1) invalid("the order payment application must be the first application.");

  assertSafeCents(order.total_cents, "order.total_cents");
  assertSafeCents(transaction.total_applied_cents, "payment_transaction.total_applied_cents");
  assertSafeCents(application.amount_cents, "application.amount_cents");
  if (
    order.total_cents !== transaction.total_applied_cents ||
    order.total_cents !== application.amount_cents
  ) {
    invalid("order, transaction, and application totals must match.");
  }

  const originalTenders: RetailPosPostSaleRefundTender[] = [];
  const seenPaymentIds = new Set<string>();
  const seenMethods = new Set<string>();
  const seenSequences = new Set<number>();
  let cash = 0;
  let card = 0;

  for (const payment of payments) {
    assertId(payment.id, "payment.id");
    assertSafeCents(payment.amount_cents, "payment.amount_cents", false);
    if (payment.received_amount_cents !== null) {
      assertSafeCents(payment.received_amount_cents, "payment.received_amount_cents");
    }
    assertSafeCents(payment.change_cents, "payment.change_cents");
    if (payment.tenant_id !== order.tenant_id || payment.order_id !== order.id) {
      invalid("payment relationship mismatch.");
    }
    if (payment.payment_transaction_id !== transaction.id) invalid("payment transaction mismatch.");
    if (!Number.isSafeInteger(payment.payment_sequence) || payment.payment_sequence < 1) {
      invalid("payment sequence is invalid.");
    }
    if (seenPaymentIds.has(payment.id) || seenSequences.has(payment.payment_sequence) || seenMethods.has(payment.payment_method)) {
      invalid("payment methods and sequences must be unique.");
    }
    seenPaymentIds.add(payment.id);
    seenSequences.add(payment.payment_sequence);
    seenMethods.add(payment.payment_method);
    if (payment.payment_method !== "cash" && payment.payment_method !== "card") {
    invalid("payment method is unsupported.", RETAIL_POS_POST_SALE_REFUND_ERRORS.methodUnsupported);
    }
    if (payment.payment_method === "cash") {
      if (payment.received_amount_cents === null || payment.received_amount_cents < payment.amount_cents) {
        invalid("cash received amount must cover the applied amount.");
      }
      if (payment.change_cents !== payment.received_amount_cents - payment.amount_cents) {
        invalid("cash change is inconsistent.");
      }
      cash += payment.amount_cents;
    } else {
      if (payment.received_amount_cents !== null || payment.change_cents !== 0) {
        invalid("card tender cannot contain cash received or change.");
      }
      card += payment.amount_cents;
    }
    originalTenders.push({
      payment_id: payment.id,
      payment_sequence: payment.payment_sequence,
      payment_method: payment.payment_method,
      applied_amount_cents: payment.amount_cents,
      received_amount_cents: payment.received_amount_cents,
      change_cents: payment.change_cents,
      card_reference: payment.card_reference,
    });
  }

  originalTenders.sort((a, b) => a.payment_sequence - b.payment_sequence);
  if (originalTenders.some((tender, index) => tender.payment_sequence !== index + 1)) {
    invalid("payment sequences must be contiguous.");
  }
  if (cash + card !== order.total_cents) invalid("payment tenders must equal the order total.");

  const summary = cash > 0 && card > 0 ? "mixed" : cash > 0 ? "cash" : "card";
  if (evidence.payment_summary !== summary) invalid("payment summary is inconsistent.");
  if (payments.length === 1) {
    if (!evidence.payment || evidence.payment.id !== payments[0].id) invalid("legacy payment is inconsistent.");
  } else if (evidence.payment !== null) {
    invalid("legacy payment must be null for mixed payments.");
  }

  return {
    original_order_id: order.id,
    original_payment_transaction_id: transaction.id,
    total_refund_cents: order.total_cents,
    cash_refund_cents: cash,
    card_refund_cents: card,
    requires_cash_refund: cash > 0,
    requires_external_card_refund: card > 0,
    original_tenders: originalTenders,
    refund_summary: summary,
  };
}
