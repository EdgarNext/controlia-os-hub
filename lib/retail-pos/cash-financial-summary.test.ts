import test from "node:test";
import assert from "node:assert/strict";
import { buildRetailPosCashFinancialSummary, getCanonicalCashTransactionIds } from "./cash-financial-summary";

test("only transactions with an effective application are canonical", () => {
  const ids = getCanonicalCashTransactionIds(
    [{ id: "settled" }, { id: "retry" }, { id: "rejected" }],
    [
      { payment_transaction_id: "settled", amount_cents: 1200 },
      { payment_transaction_id: "retry", amount_cents: 0 },
      { payment_transaction_id: "missing", amount_cents: 900 },
    ],
  );

  assert.deepEqual([...ids], ["settled"]);
});

test("mixed tender stays one transaction and two components", () => {
  const summary = buildRetailPosCashFinancialSummary({
    opening_float_cents: 10000,
    transactions: [{ id: "tx", total_applied_cents: 10000, cash_shift_id: "shift" }],
    applications: [{ payment_transaction_id: "tx", amount_cents: 10000 }],
    tenders: [
      { id: "cash", payment_transaction_id: "tx", cash_shift_id: "shift", payment_method: "cash", amount_cents: 4000, received_amount_cents: 5000, change_cents: 1000 },
      { id: "card", payment_transaction_id: "tx", cash_shift_id: "shift", payment_method: "card", amount_cents: 6000, received_amount_cents: null, change_cents: 0 },
    ],
  });

  assert.equal(summary.sales_count, 1);
  assert.equal(summary.payment_transactions_count, 1);
  assert.equal(summary.tenders_count, 2);
  assert.equal(summary.mixed_sales_count, 1);
  assert.equal(summary.expected_cash_cents, 14000);
  assert.equal(summary.warnings.length, 0);
});

test("cash refund reduces expected cash, card refund does not", () => {
  const summary = buildRetailPosCashFinancialSummary({
    opening_float_cents: 10000,
    transactions: [{ id: "tx", total_applied_cents: 5000, cash_shift_id: "shift" }],
    applications: [{ payment_transaction_id: "tx", amount_cents: 5000 }],
    tenders: [{ id: "cash", payment_transaction_id: "tx", cash_shift_id: "shift", payment_method: "cash", amount_cents: 5000, received_amount_cents: 5000, change_cents: 0 }],
    refund_components: [
      { id: "cash-refund", post_sale_document_id: "doc", refund_method: "cash", amount_cents: 1000, status: "completed" },
      { id: "card-refund", post_sale_document_id: "doc", refund_method: "card", amount_cents: 2000, status: "completed" },
    ],
  });

  assert.equal(summary.expected_cash_cents, 14000);
  assert.equal(summary.completed_cash_refunds_cents, 1000);
  assert.equal(summary.completed_card_refunds_cents, 2000);
});

test("real tender or application total inconsistency remains visible", () => {
  const summary = buildRetailPosCashFinancialSummary({
    opening_float_cents: 0,
    transactions: [{ id: "tx", total_applied_cents: 1000, cash_shift_id: "shift" }],
    applications: [{ payment_transaction_id: "tx", amount_cents: 900 }],
    tenders: [{ id: "cash", payment_transaction_id: "tx", cash_shift_id: "shift", payment_method: "cash", amount_cents: 1000, received_amount_cents: 1000, change_cents: 0 }],
  });

  assert.equal(summary.reconciliation.application_total_matches_sales, false);
  assert.match(summary.warnings.join(" "), /transaction_application_total_mismatch/);
});
