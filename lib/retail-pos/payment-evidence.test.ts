import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's strip-types runner needs explicit extensions.
import { buildRetailPosPaymentEvidence } from "./payment-evidence.ts";

const order = (total = 1000) => ({
  id: "order-1",
  tenant_id: "tenant-1",
  folio: "RP-260801-0001",
  origin_local_folio: "0001-999-260801",
  status: "paid",
  revision: 1,
  subtotal_cents: total,
  discount_cents: 0,
  total_cents: total,
  created_at: "2026-08-01T12:00:00.000Z",
  paid_at: "2026-08-01T12:01:00.000Z",
  cashier_pos_user_id: "operator-1",
  paid_by_device_id: "device-1",
} as const);

const line = {
  id: "line-1",
  line_number: 1,
  product_name: "Producto",
  variant_name: null,
  sku: "SKU-1",
  quantity: "1.000",
  sales_unit_label: "Pieza",
  approved_price_tier: "public",
  approved_unit_price_cents: 1000,
  unit_price_cents: 1000,
  discount_cents: 0,
  line_total_cents: 1000,
} as const;

const transaction = (total = 1000) => ({
  id: "transaction-1",
  tenant_id: "tenant-1",
  command_id: "command-1",
  fingerprint: "fingerprint-1",
  total_applied_cents: total,
  expected_order_revision: 0,
  cash_shift_id: "shift-1",
  device_id: "device-1",
  pos_user_id: "operator-1",
  confirmed_at: "2026-08-01T12:01:00.000Z",
  created_at: "2026-08-01T12:01:00.000Z",
  created_by: "operator-1",
});

const payment = (method: "cash" | "card", amount: number, sequence: number, received: number | null, change: number) => ({
  id: `payment-${sequence}`,
  tenant_id: "tenant-1",
  order_id: "order-1",
  cash_shift_id: "shift-1",
  device_id: "device-1",
  pos_user_id: "operator-1",
  payment_method: method,
  amount_cents: amount,
  received_amount_cents: received,
  change_cents: change,
  card_reference: method === "card" ? "AUTH-1" : null,
  paid_at: "2026-08-01T12:01:00.000Z",
  created_at: "2026-08-01T12:01:00.000Z",
  created_by: "operator-1",
  payment_transaction_id: "transaction-1",
  payment_sequence: sequence,
});

test("construye evidencia singular con compatibilidad legacy", () => {
  const evidence = buildRetailPosPaymentEvidence({
    order: order(),
    lines: [line],
    paymentTransaction: transaction(),
    application: {
      id: "application-1",
      tenant_id: "tenant-1",
      payment_transaction_id: "transaction-1",
      order_id: "order-1",
      application_sequence: 1,
      amount_cents: 1000,
      created_at: "2026-08-01T12:01:00.000Z",
    },
    payments: [payment("cash", 1000, 1, 1000, 0)],
  });
  assert.equal(evidence.payment_summary, "cash");
  assert.equal(evidence.payment, evidence.payments[0]);
});

test("construye mixto ordenado por secuencia y no expone payment legacy", () => {
  const evidence = buildRetailPosPaymentEvidence({
    order: { ...order(1000), total_cents: 1000 },
    lines: [{ ...line, unit_price_cents: 1000, line_total_cents: 1000 }],
    paymentTransaction: transaction(1000),
    application: {
      id: "application-1",
      tenant_id: "tenant-1",
      payment_transaction_id: "transaction-1",
      order_id: "order-1",
      application_sequence: 1,
      amount_cents: 1000,
      created_at: "2026-08-01T12:01:00.000Z",
    },
    payments: [payment("card", 600, 2, null, 0), payment("cash", 400, 1, 500, 100)],
  });
  assert.deepEqual(evidence.payments.map((item) => item.payment_sequence), [1, 2]);
  assert.equal(evidence.payment_summary, "mixed");
  assert.equal(evidence.payment, null);
});

test("rechaza evidencia con suma inconsistente", () => {
  assert.throws(
    () => buildRetailPosPaymentEvidence({
      order: order(),
      lines: [line],
      paymentTransaction: transaction(),
      application: {
        id: "application-1",
        tenant_id: "tenant-1",
        payment_transaction_id: "transaction-1",
        order_id: "order-1",
        application_sequence: 1,
        amount_cents: 900,
        created_at: "2026-08-01T12:01:00.000Z",
      },
      payments: [payment("cash", 1000, 1, 1000, 0)],
    }),
    /PAYMENT_EVIDENCE_INCONSISTENT/,
  );
});
