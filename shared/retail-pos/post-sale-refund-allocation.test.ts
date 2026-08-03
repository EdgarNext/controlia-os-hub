import assert from "node:assert/strict";
import test from "node:test";
import type { RetailPosPaymentEvidence } from "../types/retail-pos";
import {
  buildRetailPosPostSaleRefundAllocation,
  RetailPosPostSaleRefundAllocationError,
// @ts-expect-error Node's native strip-types runner requires the explicit extension.
} from "./post-sale-refund-allocation.ts";

const base = {
  order: { id: "order-1", tenant_id: "tenant-1", status: "paid", total_cents: 143200 },
  payment_transaction: { id: "tx-1", tenant_id: "tenant-1", total_applied_cents: 143200 },
  application: { id: "app-1", tenant_id: "tenant-1", payment_transaction_id: "tx-1", order_id: "order-1", application_sequence: 1, amount_cents: 143200 },
} as const;

function evidence(payments: Array<Record<string, unknown>>, summary: "cash" | "card" | "mixed", legacy = payments.length === 1) {
  return { ...base, payments, payment_summary: summary, payment: legacy ? payments[0] : null } as unknown as RetailPosPaymentEvidence;
}
function tender(overrides: Record<string, unknown> = {}) {
  return { id: "payment-1", tenant_id: "tenant-1", order_id: "order-1", payment_transaction_id: "tx-1", payment_sequence: 1, payment_method: "cash", amount_cents: 143200, received_amount_cents: 150000, change_cents: 6800, card_reference: null, ...overrides };
}
function assertInvalid(value: RetailPosPaymentEvidence) {
  assert.throws(() => buildRetailPosPostSaleRefundAllocation(value), RetailPosPostSaleRefundAllocationError);
}

test("allocates a singular cash payment using applied amount, not received/change", () => {
  const result = buildRetailPosPostSaleRefundAllocation(evidence([tender()], "cash"));
  assert.deepEqual(result, { original_order_id: "order-1", original_payment_transaction_id: "tx-1", total_refund_cents: 143200, cash_refund_cents: 143200, card_refund_cents: 0, requires_cash_refund: true, requires_external_card_refund: false, original_tenders: [{ payment_id: "payment-1", payment_sequence: 1, payment_method: "cash", applied_amount_cents: 143200, received_amount_cents: 150000, change_cents: 6800, card_reference: null }], refund_summary: "cash" });
});

test("allocates singular card and preserves card reference", () => {
  const result = buildRetailPosPostSaleRefundAllocation(evidence([tender({ id: "card-1", payment_method: "card", received_amount_cents: null, change_cents: 0, card_reference: "auth-1" })], "card"));
  assert.equal(result.card_refund_cents, 143200);
  assert.equal(result.original_tenders[0].card_reference, "auth-1");
});

test("allocates mixed payment independently", () => {
  const result = buildRetailPosPostSaleRefundAllocation(evidence([
    tender({ amount_cents: 100000, received_amount_cents: 100000, change_cents: 0 }),
    tender({ id: "card-1", payment_sequence: 2, payment_method: "card", amount_cents: 43200, received_amount_cents: null, change_cents: 0, card_reference: "auth-2" }),
  ], "mixed"));
  assert.equal(result.cash_refund_cents, 100000);
  assert.equal(result.card_refund_cents, 43200);
  assert.equal(result.refund_summary, "mixed");
});

test("rejects missing, unpaid, unsupported, duplicate, noncontiguous, and inconsistent evidence", () => {
  assertInvalid({} as RetailPosPaymentEvidence);
  assertInvalid({ ...evidence([tender()], "cash"), order: { ...base.order, status: "voided" } } as unknown as RetailPosPaymentEvidence);
  assertInvalid(evidence([tender({ payment_method: "transfer" })], "cash"));
  assertInvalid(evidence([tender(), tender({ id: "payment-2", payment_sequence: 2 })], "mixed"));
  assertInvalid(evidence([tender({ payment_sequence: 2 })], "cash"));
  assertInvalid(evidence([tender({ amount_cents: 1 })], "cash"));
});

test("rejects relationship, summary, cash/change, card, and total mismatches", () => {
  assertInvalid(evidence([tender({ order_id: "other" })], "cash"));
  assertInvalid(evidence([tender()], "card"));
  assertInvalid(evidence([tender({ received_amount_cents: 143199 })], "cash"));
  assertInvalid(evidence([tender({ payment_method: "card", received_amount_cents: 143200 })], "card"));
  assertInvalid({ ...evidence([tender()], "cash"), payment_transaction: { ...base.payment_transaction, total_applied_cents: 1 } } as unknown as RetailPosPaymentEvidence);
  assertInvalid({ ...evidence([tender()], "cash"), payment: null } as unknown as RetailPosPaymentEvidence);
  assertInvalid({ ...evidence([tender(), tender({ id: "card-1", payment_sequence: 2, payment_method: "card", amount_cents: 1, received_amount_cents: null, change_cents: 0 })], "mixed"), payment: tender() } as unknown as RetailPosPaymentEvidence);
});

test("cash singular does not require external card refund", () => assert.equal(buildRetailPosPostSaleRefundAllocation(evidence([tender()], "cash")).requires_external_card_refund, false));
test("cash singular requires cash refund", () => assert.equal(buildRetailPosPostSaleRefundAllocation(evidence([tender()], "cash")).requires_cash_refund, true));
test("cash singular summary is cash", () => assert.equal(buildRetailPosPostSaleRefundAllocation(evidence([tender()], "cash")).refund_summary, "cash"));
test("cash applied amount is retained", () => assert.equal(buildRetailPosPostSaleRefundAllocation(evidence([tender()], "cash")).cash_refund_cents, 143200));
test("cash received is retained only as evidence", () => assert.equal(buildRetailPosPostSaleRefundAllocation(evidence([tender()], "cash")).original_tenders[0].received_amount_cents, 150000));
test("cash change is retained only as evidence", () => assert.equal(buildRetailPosPostSaleRefundAllocation(evidence([tender()], "cash")).original_tenders[0].change_cents, 6800));
test("card singular does not require cash refund", () => assert.equal(buildRetailPosPostSaleRefundAllocation(evidence([tender({ payment_method: "card", received_amount_cents: null, change_cents: 0 })], "card")).requires_cash_refund, false));
test("card singular requires external refund", () => assert.equal(buildRetailPosPostSaleRefundAllocation(evidence([tender({ payment_method: "card", received_amount_cents: null, change_cents: 0 })], "card")).requires_external_card_refund, true));
test("card singular summary is card", () => assert.equal(buildRetailPosPostSaleRefundAllocation(evidence([tender({ payment_method: "card", received_amount_cents: null, change_cents: 0 })], "card")).refund_summary, "card"));
test("card singular amount is applied amount", () => assert.equal(buildRetailPosPostSaleRefundAllocation(evidence([tender({ payment_method: "card", received_amount_cents: null, change_cents: 0 })], "card")).card_refund_cents, 143200));
test("null historical card reference is allowed", () => assert.equal(buildRetailPosPostSaleRefundAllocation(evidence([tender({ payment_method: "card", received_amount_cents: null, change_cents: 0, card_reference: null })], "card")).original_tenders[0].card_reference, null));
test("mixed total remains exact", () => { const r = buildRetailPosPostSaleRefundAllocation(evidence([tender({ amount_cents: 100000, received_amount_cents: 100000, change_cents: 0 }), tender({ id: "card-1", payment_sequence: 2, payment_method: "card", amount_cents: 43200, received_amount_cents: null, change_cents: 0 })], "mixed")); assert.equal(r.cash_refund_cents + r.card_refund_cents, r.total_refund_cents); });
test("mixed requires cash refund", () => { const r = buildRetailPosPostSaleRefundAllocation(evidence([tender({ amount_cents: 100000, received_amount_cents: 100000, change_cents: 0 }), tender({ id: "card-1", payment_sequence: 2, payment_method: "card", amount_cents: 43200, received_amount_cents: null, change_cents: 0 })], "mixed")); assert.equal(r.requires_cash_refund, true); });
test("mixed requires card refund", () => { const r = buildRetailPosPostSaleRefundAllocation(evidence([tender({ amount_cents: 100000, received_amount_cents: 100000, change_cents: 0 }), tender({ id: "card-1", payment_sequence: 2, payment_method: "card", amount_cents: 43200, received_amount_cents: null, change_cents: 0 })], "mixed")); assert.equal(r.requires_external_card_refund, true); });
test("mixed has one allocation operation", () => assert.equal(buildRetailPosPostSaleRefundAllocation(evidence([tender({ amount_cents: 100000, received_amount_cents: 100000, change_cents: 0 }), tender({ id: "card-1", payment_sequence: 2, payment_method: "card", amount_cents: 43200, received_amount_cents: null, change_cents: 0 })], "mixed")).original_tenders.length, 2));
test("mixed preserves tender sequence one", () => assert.equal(buildRetailPosPostSaleRefundAllocation(evidence([tender({ amount_cents: 100000, received_amount_cents: 100000, change_cents: 0 }), tender({ id: "card-1", payment_sequence: 2, payment_method: "card", amount_cents: 43200, received_amount_cents: null, change_cents: 0 })], "mixed")).original_tenders[0].payment_sequence, 1));
test("mixed preserves tender sequence two", () => assert.equal(buildRetailPosPostSaleRefundAllocation(evidence([tender({ amount_cents: 100000, received_amount_cents: 100000, change_cents: 0 }), tender({ id: "card-1", payment_sequence: 2, payment_method: "card", amount_cents: 43200, received_amount_cents: null, change_cents: 0 })], "mixed")).original_tenders[1].payment_sequence, 2));
test("rejects three tenders", () => assertInvalid(evidence([tender({ amount_cents: 50000, received_amount_cents: 50000, change_cents: 0 }), tender({ id: "card-1", payment_sequence: 2, payment_method: "card", amount_cents: 43200, received_amount_cents: null, change_cents: 0 }), tender({ id: "cash-2", payment_sequence: 3, amount_cents: 49800, received_amount_cents: 49800, change_cents: 0 })], "mixed")));
test("rejects duplicate payment ids", () => assertInvalid(evidence([tender(), tender({ payment_sequence: 2, payment_method: "card", received_amount_cents: null, change_cents: 0 })], "mixed")));
test("rejects duplicate cash methods", () => assertInvalid(evidence([tender({ amount_cents: 50000, received_amount_cents: 50000, change_cents: 0 }), tender({ id: "cash-2", payment_sequence: 2, amount_cents: 93200, received_amount_cents: 93200, change_cents: 0 })], "cash")));
test("rejects duplicate card methods", () => assertInvalid(evidence([tender({ payment_method: "card", received_amount_cents: null, change_cents: 0 }), tender({ id: "card-2", payment_sequence: 2, payment_method: "card", received_amount_cents: null, change_cents: 0 })], "card")));
test("rejects negative payment amount", () => assertInvalid(evidence([tender({ amount_cents: -1 })], "cash")));
test("rejects unsafe payment amount", () => assertInvalid(evidence([tender({ amount_cents: Number.MAX_SAFE_INTEGER + 1 })], "cash")));
test("rejects application mismatch", () => assertInvalid({ ...evidence([tender()], "cash"), application: { ...base.application, amount_cents: 1 } } as unknown as RetailPosPaymentEvidence));
test("rejects transaction mismatch", () => assertInvalid({ ...evidence([tender()], "cash"), payment_transaction: { ...base.payment_transaction, id: "other" } } as unknown as RetailPosPaymentEvidence));
test("rejects order total mismatch", () => assertInvalid({ ...evidence([tender()], "cash"), order: { ...base.order, total_cents: 1 } } as unknown as RetailPosPaymentEvidence));
test("rejects cash received below applied", () => assertInvalid(evidence([tender({ received_amount_cents: 143199, change_cents: 0 })], "cash")));
test("rejects nonzero card change", () => assertInvalid(evidence([tender({ payment_method: "card", received_amount_cents: null, change_cents: 1 })], "card")));
test("rejects legacy payment in mixed evidence", () => assertInvalid({ ...evidence([tender({ amount_cents: 100000, received_amount_cents: 100000, change_cents: 0 }), tender({ id: "card-1", payment_sequence: 2, payment_method: "card", amount_cents: 43200, received_amount_cents: null, change_cents: 0 })], "mixed"), payment: tender() } as unknown as RetailPosPaymentEvidence));
test("retains original order identity", () => assert.equal(buildRetailPosPostSaleRefundAllocation(evidence([tender()], "cash")).original_order_id, "order-1"));
test("retains original transaction identity", () => assert.equal(buildRetailPosPostSaleRefundAllocation(evidence([tender()], "cash")).original_payment_transaction_id, "tx-1"));
