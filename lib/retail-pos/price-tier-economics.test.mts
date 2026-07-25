import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node's strip-types runner needs an explicit extension; Next's bundler resolves the extensionless import in production.
import { calculatePriceTierEconomics, classifyPriceTier, classifyPriceTierDecision } from "./price-tier-economics.ts";

test("price tier economics separates wholesale difference from manual discounts", () => {
  const line = { quantity: "2.000", publicUnitPriceSnapshotCents: 250, wholesaleUnitPriceSnapshotCents: 200, approvedPriceTier: "wholesale" as const, approvedUnitPriceCents: 200, directDiscountCents: 10, orderDiscountAllocationCents: 5, unitCostSnapshotCents: 120 };
  assert.deepEqual(calculatePriceTierEconomics(line), { tier: "wholesale", publicReferenceCents: 500, approvedBaseCents: 400, priceTierDifferenceCents: 100, manualLineDiscountCents: 10, allocatedOrderDiscountCents: 5, manualDiscountCents: 15, finalNetCents: 385, baseMarginCents: 160, finalMarginCents: 145 });
  assert.equal(classifyPriceTier([line, { quantity: 1, approvedPriceTier: "public" }]), "mixed");
  assert.equal(classifyPriceTierDecision({ ...line, requestedPriceTier: "wholesale" }), "requested_approved");
  assert.equal(classifyPriceTierDecision({ ...line, requestedPriceTier: "public" }), "cashier_direct");
});
