import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's strip-types runner needs explicit extensions.
import { buildPostSaleReportSummary } from "./post-sale-report-summary.ts";

const base = {
  document_type: "sale_cancellation" as const,
  original_folio: "RP-TEST",
  cash_shift_id: "shift",
  status: "completed" as const,
  refund_status: "completed" as const,
  gross_amount_cents: 10000,
  discount_amount_cents: 0,
  net_amount_cents: 10000,
  refund_amount_cents: 10000,
  reason_code: "operator_error",
  comment: null,
  created_by_pos_user_id: "operator",
  responsible_user_name: "Caja",
  created_at: "2026-08-02T10:00:00Z",
  confirmed_at: "2026-08-02T10:01:00Z",
};

function document(id: string, orderId: string, amount: number, method: "cash" | "card_external" | "mixed" = "cash") {
  return { ...base, id, original_order_id: orderId, refund_amount_cents: amount, net_amount_cents: amount, refund_method: method };
}

function component(id: string, documentId: string, method: "cash" | "card", amount: number, status: "completed" | "pending_external_confirmation" = "completed") {
  return { id, post_sale_document_id: documentId, refund_method: method, amount_cents: amount, status };
}

const filters = {
  operationType: "all" as const,
  refundStatus: "all" as const,
  refundMethod: "all" as const,
  reasonCode: null,
  responsibleUserId: null,
};

test("counts modern documents once and separates cash, card and mixed components", () => {
  const result = buildPostSaleReportSummary({
    documents: [document("cash-doc", "cash-order", 10000), document("card-doc", "card-order", 20000, "card_external"), document("mixed-doc", "mixed-order", 30000, "mixed")],
    legacyRefunds: [],
    components: [component("cash-component", "cash-doc", "cash", 10000), component("card-component", "card-doc", "card", 20000), component("mixed-cash", "mixed-doc", "cash", 5000), component("mixed-card", "mixed-doc", "card", 25000)],
    payments: [{ order_id: "cash-order", payment_method: "cash" }, { order_id: "card-order", payment_method: "card" }, { order_id: "mixed-order", payment_method: "cash" }, { order_id: "mixed-order", payment_method: "card" }],
    cashMovements: [{ post_sale_document_id: "cash-doc", amount_cents: 10000 }, { post_sale_document_id: "mixed-doc", amount_cents: 5000 }],
    lines: [],
    filters,
  });
  assert.equal(result.summary.cancellation_documents_count, 3);
  assert.equal(result.summary.refund_components_count, 4);
  assert.equal(result.summary.cash_components_count, 2);
  assert.equal(result.summary.card_components_count, 2);
  assert.equal(result.summary.total_cancelled_cents, 60000);
  assert.equal(result.summary.completed_cash_refunds_cents, 15000);
  assert.equal(result.summary.completed_card_refunds_cents, 45000);
  assert.equal(result.summary.mixed_cancellations_count, 1);
  assert.equal(result.summary.reconciliation.completed_cash_matches_cash_movements, true);
});

test("keeps a mixed document as one pending document and separates completed cash from pending card", () => {
  const result = buildPostSaleReportSummary({
    documents: [{ ...document("pending-doc", "pending-order", 30000, "mixed"), refund_amount_cents: 30000 }],
    legacyRefunds: [],
    components: [component("pending-cash", "pending-doc", "cash", 10000), component("pending-card", "pending-doc", "card", 20000, "pending_external_confirmation")],
    payments: [{ order_id: "pending-order", payment_method: "cash" }, { order_id: "pending-order", payment_method: "card" }],
    cashMovements: [{ post_sale_document_id: "pending-doc", amount_cents: 10000 }],
    lines: [],
    filters,
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.summary.pending_documents_count, 1);
  assert.equal(result.summary.completed_cash_refunds_cents, 10000);
  assert.equal(result.summary.pending_card_refunds_cents, 20000);
});

test("uses legacy refund only when modern components are absent", () => {
  const result = buildPostSaleReportSummary({
    documents: [document("legacy-doc", "legacy-order", 12000, "card_external")],
    legacyRefunds: [{ id: "legacy-refund", post_sale_document_id: "legacy-doc", refund_method: "card_external", status: "completed", amount_cents: 12000, external_reference: "ref", processed_at: "2026-08-02T10:02:00Z" }],
    components: [],
    payments: [{ order_id: "legacy-order", payment_method: "card" }],
    cashMovements: [],
    lines: [],
    filters,
  });
  assert.equal(result.summary.refund_components_count, 1);
  assert.equal(result.rows[0]?.coverageLabel, "Registro histórico");
  assert.equal(result.summary.warnings.includes("No fue posible demostrar la distribución del reembolso histórico."), false);
});

test("flags component and cash movement mismatches", () => {
  const result = buildPostSaleReportSummary({
    documents: [document("mismatch-doc", "mismatch-order", 10000)],
    legacyRefunds: [],
    components: [component("mismatch-component", "mismatch-doc", "cash", 9000)],
    payments: [{ order_id: "mismatch-order", payment_method: "cash" }],
    cashMovements: [{ post_sale_document_id: "other-doc", amount_cents: 9000 }],
    lines: [],
    filters,
  });
  assert.equal(result.summary.reconciliation.component_totals_match_documents, false);
  assert.equal(result.summary.reconciliation.completed_cash_matches_cash_movements, false);
  assert.ok(result.summary.warnings.length >= 2);
});
