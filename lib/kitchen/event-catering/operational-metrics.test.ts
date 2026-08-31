import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node's strip-types runner needs an explicit extension; Next's bundler resolves the extensionless import in production.
import { calculateOperationalExecutionCosts, calculateOperationalQuantityMetrics } from "./operational-metrics.ts";

const calculate = (received: number[]) => calculateOperationalQuantityMetrics(
  [{ unitId: "kg", quantity: 100 }],
  received.map((quantity) => ({ status: "received", unitId: "kg", quantity })),
  [],
);

test("partial, complete, over, and absent receipts preserve quantity variance", () => {
  assert.equal(calculate([60]).totalReceivedQty, 60);
  assert.equal(calculate([60]).varianceReceivedVsRequired, -40);
  assert.equal(calculate([100]).varianceReceivedVsRequired, 0);
  assert.equal(calculate([110]).varianceReceivedVsRequired, 10);
  assert.equal(calculate([]).totalReceivedQty, 0);
});

test("sums multiple valid receipt lines and excludes draft/canceled lines", () => {
  const result = calculateOperationalQuantityMetrics(
    [{ unitId: "kg", quantity: 100 }],
    [
      { status: "received", unitId: "kg", quantity: 30 },
      { status: "received", unitId: "kg", quantity: 25 },
      { status: "draft", unitId: "kg", quantity: 40 },
      { status: "canceled", unitId: "kg", quantity: 50 },
    ],
    [],
  );
  assert.equal(result.totalReceivedQty, 55);
  assert.equal(result.varianceReceivedVsRequired, -45);
});

test("does not compare quantities from incompatible units", () => {
  const result = calculateOperationalQuantityMetrics(
    [{ unitId: "kg", quantity: 100 }],
    [{ status: "received", unitId: "l", quantity: 100 }],
    [],
  );
  assert.equal(result.totalReceivedQty, 100);
  assert.equal(result.varianceReceivedVsRequired, null);
  assert.equal(result.comparable, false);
});

test("shares execution cost aggregation across operational and financial reporting", () => {
  const result = calculateOperationalExecutionCosts({
    receivedCosts: [100, 25],
    consumptionCosts: [{ consumedCost: 80, wasteCost: 5 }, { consumedCost: 10, wasteCost: 2 }],
  });
  assert.deepEqual(result, { receivedCost: 125, consumedCost: 90, wasteCost: 7 });
});
