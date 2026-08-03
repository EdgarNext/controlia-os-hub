import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's strip-types runner needs an explicit extension.
import { adaptLegacyPaymentToTransactionDraft, buildRetailPosPaymentFingerprintPayload, deriveRetailPosCashChangeCents, deriveRetailPosPaymentSummary, normalizeRetailPosPaymentRequest, normalizeRetailPosPaymentTenders, sumRetailPosAppliedAmountCents, validateRetailPosPaymentTransactionAgainstTotal, type RetailPosPaymentTenderDraft, type RetailPosPaymentTransactionDraft } from "./mixed-payments.ts";

const cash = (amount_cents: number, received_amount_cents: number | null = amount_cents, sequence = 1): RetailPosPaymentTenderDraft => ({ sequence, method: "cash", amount_cents, received_amount_cents, reference: null });
const card = (amount_cents: number, sequence = 1): RetailPosPaymentTenderDraft => ({ sequence, method: "card", amount_cents, received_amount_cents: null, reference: " auth-1 " });
const transaction = (tenders: RetailPosPaymentTenderDraft[]): RetailPosPaymentTransactionDraft => ({ command_id: "cmd-1", order_id: "order-1", expected_order_revision: 3, tenders });

test("acepta efectivo y tarjeta por el total exacto", () => {
  assert.equal(validateRetailPosPaymentTransactionAgainstTotal(transaction([cash(1000)]), 1000).ok, true);
  assert.equal(validateRetailPosPaymentTransactionAgainstTotal(transaction([card(1000)]), 1000).ok, true);
});

test("acepta mixto en orden inverso y normaliza 40/60", () => {
  const result = normalizeRetailPosPaymentTenders([card(600, 2), cash(400, 500, 1)]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.tenders.map(({ sequence, method }) => ({ sequence, method })), [{ sequence: 1, method: "cash" }, { sequence: 2, method: "card" }]);
  assert.equal(deriveRetailPosPaymentSummary(result.tenders).method, "mixed");
  assert.equal(sumRetailPosAppliedAmountCents(result.tenders), 1000);
  assert.equal(result.tenders[0]?.change_cents, 100);
});

test("el cambio solo deriva del efectivo aplicado", () => {
  assert.equal(deriveRetailPosCashChangeCents(cash(400, 500)), 100);
  assert.equal(deriveRetailPosCashChangeCents(card(600)), 0);
});

test("rechaza totales, cantidades, métodos y reglas de efectivo inválidas", () => {
  const cases = [
    [[], "EMPTY_TENDERS"],
    [[cash(1), card(1), cash(1, 1, 3)], "TOO_MANY_TENDERS"],
    [[cash(1), cash(1, 1, 2)], "DUPLICATE_METHOD"],
    [[cash(-1)], "INVALID_AMOUNT"],
    [[cash(100, null)], "CASH_RECEIVED_REQUIRED"],
    [[cash(100, 99)], "CASH_RECEIVED_INSUFFICIENT"],
    [[{ ...card(100), received_amount_cents: 1 }], "CARD_RECEIVED_NOT_ALLOWED"],
    [[cash(100, 100, 2)], "INVALID_SEQUENCE"],
  ] as const;
  for (const [tenders, code] of cases) {
    const result = normalizeRetailPosPaymentTenders(tenders as unknown as RetailPosPaymentTenderDraft[]);
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.equal(result.errors[0]?.code, code);
  }
  assert.equal(validateRetailPosPaymentTransactionAgainstTotal(transaction([cash(99)]), 100).errors[0]?.code, "TOTAL_MISMATCH");
  assert.equal(validateRetailPosPaymentTransactionAgainstTotal(transaction([cash(101)]), 100).errors[0]?.code, "TOTAL_MISMATCH");
});

test("rechaza métodos duplicados, transferencias, fracciones y fuera de rango seguro", () => {
  assert.equal(normalizeRetailPosPaymentTenders([{ ...card(100), method: "transfer" } as unknown as RetailPosPaymentTenderDraft]).ok, false);
  assert.equal(normalizeRetailPosPaymentTenders([cash(1.5)]).ok, false);
  assert.equal(normalizeRetailPosPaymentTenders([cash(Number.MAX_SAFE_INTEGER + 1)]).ok, false);
  assert.equal(normalizeRetailPosPaymentTenders([cash(100, 100, 1), card(100, 1)]).ok, false);
});

test("resumen es independiente del orden y fingerprint es canónico", () => {
  const first = transaction([cash(400, 500, 1), card(600, 2)]);
  const second = transaction([card(600, 2), cash(400, 500, 1)]);
  assert.deepEqual(deriveRetailPosPaymentSummary(first.tenders), deriveRetailPosPaymentSummary(second.tenders));
  assert.deepEqual(buildRetailPosPaymentFingerprintPayload(first), buildRetailPosPaymentFingerprintPayload(second));
  assert.notDeepEqual(
    buildRetailPosPaymentFingerprintPayload(first),
    buildRetailPosPaymentFingerprintPayload(transaction([cash(500, 500, 1), card(500, 2)])),
  );
});

test("adaptador legacy no cambia el contrato singular", () => {
  const adapted = adaptLegacyPaymentToTransactionDraft({ command_id: "cmd", order_id: "order", expected_order_revision: 1, payment_method: "card", amount_cents: 100, received_amount_cents: null, card_reference: "ref" });
  assert.deepEqual(adapted.tenders, [{ sequence: 1, method: "card", amount_cents: 100, received_amount_cents: null, reference: "ref" }]);
});

test("el contrato exige exactamente payment o tenders", () => {
  const legacy = normalizeRetailPosPaymentRequest({
    payment: { command_id: "cmd", order_id: "order", expected_order_revision: 1, payment_method: "cash", amount_cents: 100, received_amount_cents: 100, card_reference: null },
  });
  assert.equal("tenders" in legacy, true);
  const missing = normalizeRetailPosPaymentRequest({});
  assert.equal("ok" in missing && missing.ok, false);
  const ambiguous = normalizeRetailPosPaymentRequest({ payment: { command_id: "cmd", order_id: "order", expected_order_revision: 1, payment_method: "cash", amount_cents: 100, received_amount_cents: 100, card_reference: null }, tenders: [cash(100)] });
  assert.equal("ok" in ambiguous && ambiguous.ok, false);
});
