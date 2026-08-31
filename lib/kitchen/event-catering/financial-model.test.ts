import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node's strip-types runner needs an explicit extension; Next's bundler resolves the extensionless import in production.
import { calculateCateringServicePricing } from "./financial-model.ts";

test("calculates service price, profit, margin and per-guest price", () => {
  const result = calculateCateringServicePricing({
    foodCost: 20_000,
    extraStaffCount: 4,
    extraStaffUnitCost: 750,
    targetMarginPct: 25,
    plannedGuestCount: 100,
    currency: "MXN",
  });
  assert.equal(result.status, "ready");
  assert.equal(result.extraLaborCost, 3_000);
  assert.equal(result.serviceCostBasis, 23_000);
  assert.ok(Math.abs(result.suggestedServicePrice! - 30_666.666666666668) < 0.0001);
  assert.ok(Math.abs(result.suggestedProfit! - 7_666.666666666668) < 0.0001);
  assert.ok(Math.abs(result.resultingMarginPct! - 25) < 0.0001);
  assert.ok(Math.abs(result.suggestedPricePerGuest! - 306.6666666666667) < 0.0001);
});

test("zero staff is ready without a staff rate", () => {
  const result = calculateCateringServicePricing({ foodCost: 100, extraStaffCount: 0, extraStaffUnitCost: null, targetMarginPct: 25, plannedGuestCount: null, currency: "MXN" });
  assert.equal(result.status, "ready");
  assert.equal(result.extraLaborCost, 0);
  assert.equal(result.warnings.length, 0);
});

test("staff without a rate is incomplete and has no suggested price", () => {
  const result = calculateCateringServicePricing({ foodCost: 100, extraStaffCount: 1, extraStaffUnitCost: null, targetMarginPct: 25, plannedGuestCount: 10, currency: "MXN" });
  assert.equal(result.status, "incomplete");
  assert.deepEqual(result.warnings, ["missing_extra_staff_unit_cost"]);
  assert.equal(result.suggestedServicePrice, null);
  assert.equal(result.suggestedPricePerGuest, null);
});

test("zero margin returns the cost basis", () => {
  const result = calculateCateringServicePricing({ foodCost: 100, extraStaffCount: 2, extraStaffUnitCost: 5, targetMarginPct: 0, plannedGuestCount: 2, currency: "MXN" });
  assert.equal(result.suggestedServicePrice, 110);
  assert.equal(result.suggestedProfit, 0);
  assert.equal(result.resultingMarginPct, 0);
});

test("rejects invalid margins and negative values", () => {
  assert.throws(() => calculateCateringServicePricing({ foodCost: 1, extraStaffCount: 0, extraStaffUnitCost: null, targetMarginPct: 100, plannedGuestCount: null, currency: "MXN" }));
  assert.throws(() => calculateCateringServicePricing({ foodCost: -1, extraStaffCount: 0, extraStaffUnitCost: null, targetMarginPct: 25, plannedGuestCount: null, currency: "MXN" }));
  assert.throws(() => calculateCateringServicePricing({ foodCost: 1, extraStaffCount: 1.5, extraStaffUnitCost: 1, targetMarginPct: 25, plannedGuestCount: null, currency: "MXN" }));
  assert.throws(() => calculateCateringServicePricing({ foodCost: 1, extraStaffCount: 0, extraStaffUnitCost: -1, targetMarginPct: 25, plannedGuestCount: null, currency: "MXN" }));
});

test("zero or missing guests do not create a per-guest price", () => {
  for (const plannedGuestCount of [null, 0]) {
    const result = calculateCateringServicePricing({ foodCost: 100, extraStaffCount: 0, extraStaffUnitCost: null, targetMarginPct: 25, plannedGuestCount, currency: "MXN" });
    assert.equal(result.suggestedPricePerGuest, null);
  }
});
