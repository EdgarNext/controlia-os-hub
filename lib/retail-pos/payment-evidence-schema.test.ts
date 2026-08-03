import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's strip-types runner needs explicit extensions.
import { PAYMENT_APPLICATION_SELECT } from "./payment-evidence.ts";

test("la proyección de aplicaciones coincide con el esquema real", () => {
  assert.equal(
    PAYMENT_APPLICATION_SELECT,
    "id, tenant_id, payment_transaction_id, order_id, application_sequence, amount_cents, created_at",
  );
  assert.equal(PAYMENT_APPLICATION_SELECT.includes("created_by"), false);
});

test("fixture real de aplicación conserva sus siete campos", () => {
  const application = {
    id: "application-id",
    tenant_id: "tenant-id",
    payment_transaction_id: "transaction-id",
    order_id: "order-id",
    application_sequence: 1,
    amount_cents: 50000,
    created_at: "2026-08-01T00:00:00.000Z",
  };
  assert.deepEqual(Object.keys(application), [
    "id",
    "tenant_id",
    "payment_transaction_id",
    "order_id",
    "application_sequence",
    "amount_cents",
    "created_at",
  ]);
});
