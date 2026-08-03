import type {
  RetailPosOrder,
  RetailPosOrderLine,
  RetailPosOrderPaymentApplication,
  RetailPosPaidOrderEvidence,
  RetailPosPayment,
  RetailPosPaymentEvidence,
  RetailPosPaymentTransaction,
} from "../../shared/types/retail-pos.ts";
// @ts-expect-error Node's strip-types runner needs explicit extensions.
import { RetailPosRuntimeError } from "./errors.ts";

export const PAYMENT_APPLICATION_SELECT =
  "id, tenant_id, payment_transaction_id, order_id, application_sequence, amount_cents, created_at";

type EvidencePayment = RetailPosPayment & {
  payment_transaction_id: string | null;
  payment_sequence: number | null;
};

type EvidenceOrderSource = Pick<
  RetailPosOrder,
  | "id"
  | "tenant_id"
  | "folio"
  | "origin_local_folio"
  | "status"
  | "subtotal_cents"
  | "discount_cents"
  | "total_cents"
  | "paid_at"
  | "created_at"
  | "cashier_pos_user_id"
  | "paid_by_device_id"
> & { revision?: number };

type EvidenceLineSource = Pick<
  RetailPosOrderLine,
  | "id"
  | "line_number"
  | "product_name"
  | "variant_name"
  | "sku"
  | "sales_unit_label"
  | "approved_price_tier"
  | "approved_unit_price_cents"
  | "unit_price_cents"
  | "discount_cents"
  | "line_total_cents"
> & {
  quantity: string | number;
  direct_discount_cents?: number | null;
  order_discount_allocation_cents?: number | null;
  total_discount_cents?: number | null;
};

function evidenceError(code: string): never {
  throw new RetailPosRuntimeError(500, code, code);
}

function buildEvidenceOrder(order: EvidenceOrderSource, lines: EvidenceLineSource[]): RetailPosPaidOrderEvidence {
  return {
    id: order.id,
    tenant_id: order.tenant_id,
    folio: order.folio,
    origin_local_folio: order.origin_local_folio,
    status: order.status,
    revision: typeof order.revision === "number" ? order.revision : 0,
    subtotal_cents: order.subtotal_cents,
    discount_cents: order.discount_cents,
    total_cents: order.total_cents,
    created_at: order.created_at,
    paid_at: order.paid_at,
    cashier_pos_user_id: order.cashier_pos_user_id,
    paid_by_device_id: order.paid_by_device_id,
    lines: lines.map((line) => ({
      id: line.id,
      line_number: line.line_number,
      product_name: line.product_name,
      variant_name: line.variant_name,
      sku: line.sku,
      quantity: String(line.quantity),
      sales_unit_label: line.sales_unit_label,
      approved_price_tier: line.approved_price_tier ?? "unknown",
      approved_unit_price_cents: line.approved_unit_price_cents ?? line.unit_price_cents,
      unit_price_cents: line.unit_price_cents,
      direct_discount_cents: line.direct_discount_cents ?? 0,
      order_discount_allocation_cents: line.order_discount_allocation_cents ?? 0,
      total_discount_cents: line.total_discount_cents ?? line.discount_cents,
      line_total_cents: line.line_total_cents,
    })),
  };
}

export function buildRetailPosPaymentEvidence(input: {
  order: EvidenceOrderSource;
  lines: EvidenceLineSource[];
  paymentTransaction: RetailPosPaymentTransaction | null;
  application: RetailPosOrderPaymentApplication | null;
  payments: EvidencePayment[];
}): RetailPosPaymentEvidence {
  const { order, lines, paymentTransaction, application } = input;
  if (!paymentTransaction) evidenceError("PAYMENT_TRANSACTION_NOT_FOUND");
  if (!application) evidenceError("PAYMENT_APPLICATION_NOT_FOUND");

  const payments = input.payments
    .slice()
    .sort((left, right) => (left.payment_sequence ?? 0) - (right.payment_sequence ?? 0))
    .map((payment) => {
      const sequence = payment.payment_sequence;
      if (!payment.payment_transaction_id || payment.payment_transaction_id !== paymentTransaction.id) {
        evidenceError("PAYMENT_EVIDENCE_INCONSISTENT");
      }
      if (typeof sequence !== "number" || !Number.isSafeInteger(sequence) || sequence < 1) {
        evidenceError("PAYMENT_EVIDENCE_INCONSISTENT");
      }
      if (payment.payment_method !== "cash" && payment.payment_method !== "card") {
        evidenceError("PAYMENT_EVIDENCE_UNSUPPORTED_METHOD");
      }
      return {
        ...payment,
        payment_transaction_id: payment.payment_transaction_id,
        payment_sequence: sequence,
      };
    });

  if (payments.length < 1 || payments.length > 2) evidenceError("PAYMENT_TENDERS_NOT_FOUND");
  const sequences = payments.map((payment) => payment.payment_sequence);
  if (new Set(sequences).size !== payments.length || sequences.some((sequence, index) => sequence !== index + 1)) {
    evidenceError("PAYMENT_EVIDENCE_INCONSISTENT");
  }
  const methods = payments.map((payment) => payment.payment_method);
  if (new Set(methods).size !== methods.length) evidenceError("PAYMENT_EVIDENCE_INCONSISTENT");

  for (const payment of payments) {
    if (payment.payment_method === "cash") {
      if (payment.received_amount_cents === null || payment.change_cents !== payment.received_amount_cents - payment.amount_cents) {
        evidenceError("PAYMENT_EVIDENCE_INCONSISTENT");
      }
      if (payment.card_reference !== null) evidenceError("PAYMENT_EVIDENCE_INCONSISTENT");
    } else if (payment.received_amount_cents !== null || payment.change_cents !== 0) {
      evidenceError("PAYMENT_EVIDENCE_INCONSISTENT");
    }
  }

  const paymentsTotal = payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
  if (
    application.amount_cents !== order.total_cents ||
    paymentTransaction.total_applied_cents !== order.total_cents ||
    paymentsTotal !== order.total_cents ||
    application.amount_cents !== paymentTransaction.total_applied_cents
  ) {
    evidenceError("PAYMENT_EVIDENCE_INCONSISTENT");
  }

  const hasCash = methods.includes("cash");
  const hasCard = methods.includes("card");
  const paymentSummary = hasCash && hasCard ? "mixed" : hasCash ? "cash" : "card";
  return {
    order: buildEvidenceOrder(order, lines),
    payment_transaction: paymentTransaction,
    application,
    payments,
    payment_summary: paymentSummary,
    payment: payments.length === 1 ? payments[0] ?? null : null,
  };
}
