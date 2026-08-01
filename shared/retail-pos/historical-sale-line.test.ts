import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's strip-types runner needs an explicit extension.
import { assertRetailPosHistoricalSaleLine, getRetailPosApprovedBasePriceCents } from "./historical-sale-line.ts";

function makeLine(overrides: Record<string, unknown> = {}) {
  return {
    lineNumber: 1,
    quantity: "1.000",
    publicUnitPriceSnapshotCents: 1000,
    wholesaleUnitPriceSnapshotCents: 900,
    approvedPriceTier: "public" as const,
    approvedUnitPriceCents: 1000,
    unitPriceCents: 1000,
    unitCostSnapshotCents: 600,
    ...overrides,
  };
}

test("approved base price follows the approved tier, not a discount", () => {
  assert.equal(
    getRetailPosApprovedBasePriceCents({
      approvedPriceTier: "wholesale",
      publicUnitPriceSnapshotCents: 1000,
      wholesaleUnitPriceSnapshotCents: 900,
    }),
    900,
  );
});

test("accepts public and wholesale historical lines", () => {
  assert.equal(assertRetailPosHistoricalSaleLine(makeLine()).ok, true);
  assert.equal(
    assertRetailPosHistoricalSaleLine(
      makeLine({
        approvedPriceTier: "wholesale",
        approvedUnitPriceCents: 900,
        unitPriceCents: 900,
      }),
    ).ok,
    true,
  );
});

test("rejects missing tier, mismatched applied price, and missing cost", () => {
  const result = assertRetailPosHistoricalSaleLine(
    makeLine({
      approvedPriceTier: null,
      approvedUnitPriceCents: null,
      unitPriceCents: 850,
      unitCostSnapshotCents: null,
    }),
  );

  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["APPROVED_PRICE_TIER_REQUIRED"],
  );

  const invalidPrice = assertRetailPosHistoricalSaleLine(
    makeLine({ unitPriceCents: 950 }),
  );
  assert.equal(invalidPrice.issues[0]?.code, "APPLIED_PRICE_MISMATCH");

  const missingCost = assertRetailPosHistoricalSaleLine(
    makeLine({ unitCostSnapshotCents: null }),
  );
  assert.equal(missingCost.issues[0]?.code, "HISTORICAL_COST_REQUIRED");
});

test("can validate the price contract before cost capture", () => {
  assert.equal(
    assertRetailPosHistoricalSaleLine(makeLine({ unitCostSnapshotCents: null }), {
      requireHistoricalCost: false,
    }).ok,
    true,
  );
});
