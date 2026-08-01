import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node's strip-types runner needs an explicit extension; Next's bundler resolves the extensionless import in production.
import { buildRetailCommercialCoverage, calculatePriceTierEconomics, classifyPriceTier, classifyPriceTierDecision } from "./price-tier-economics.ts";

test("public sale without additional discount uses the public snapshot", () => {
  const economics = calculatePriceTierEconomics({
    quantity: "2.000",
    publicUnitPriceSnapshotCents: 250,
    wholesaleUnitPriceSnapshotCents: 200,
    approvedPriceTier: "public",
    approvedUnitPriceCents: 250,
    unitPriceCents: 250,
    lineTotalCents: 500,
    unitCostSnapshotCents: 120,
  });

  assert.equal(economics.tier, "public");
  assert.equal(economics.approvedBaseCents, 500);
  assert.equal(economics.priceTierDifferenceCents, 0);
  assert.equal(economics.manualDiscountCents, 0);
  assert.equal(economics.finalNetCents, 500);
  assert.equal(economics.finalMarginCents, 260);
});

test("wholesale is a price level, not an additional discount", () => {
  const economics = calculatePriceTierEconomics({
    quantity: "2.000",
    publicUnitPriceSnapshotCents: 250,
    wholesaleUnitPriceSnapshotCents: 200,
    approvedPriceTier: "wholesale",
    approvedUnitPriceCents: 200,
    unitPriceCents: 200,
    lineTotalCents: 400,
    unitCostSnapshotCents: 120,
  });

  assert.equal(economics.approvedBaseCents, 400);
  assert.equal(economics.priceTierDifferenceCents, 100);
  assert.equal(economics.manualDiscountCents, 0);
});

test("public and wholesale additional discounts use persisted historical amounts", () => {
  const publicLine = calculatePriceTierEconomics({
    quantity: "1.000",
    publicUnitPriceSnapshotCents: 1000,
    wholesaleUnitPriceSnapshotCents: 900,
    approvedPriceTier: "public",
    approvedUnitPriceCents: 1000,
    unitPriceCents: 1000,
    directDiscountCents: 75,
    orderDiscountAllocationCents: 25,
    totalDiscountCents: 100,
    lineTotalCents: 900,
  });
  const wholesaleLine = calculatePriceTierEconomics({
    quantity: "1.000",
    publicUnitPriceSnapshotCents: 1000,
    wholesaleUnitPriceSnapshotCents: 900,
    approvedPriceTier: "wholesale",
    approvedUnitPriceCents: 900,
    unitPriceCents: 900,
    directDiscountCents: 50,
    orderDiscountAllocationCents: 50,
    totalDiscountCents: 100,
    lineTotalCents: 800,
  });

  assert.equal(publicLine.manualDiscountCents, 100);
  assert.equal(wholesaleLine.manualDiscountCents, 100);
  assert.equal(wholesaleLine.priceTierDifferenceCents, 100);
});

test("unknown historical tier stays unknown and still contributes net sales", () => {
  const economics = calculatePriceTierEconomics({
    quantity: "2.000",
    publicUnitPriceSnapshotCents: 250,
    wholesaleUnitPriceSnapshotCents: 200,
    approvedPriceTier: null,
    approvedUnitPriceCents: null,
    unitPriceCents: 225,
    lineTotalCents: 450,
    totalDiscountCents: 10,
  });

  assert.equal(economics.tier, "unknown");
  assert.equal(economics.approvedBaseCents, null);
  assert.equal(economics.priceTierDifferenceCents, null);
  assert.equal(economics.manualDiscountCents, null);
  assert.equal(economics.finalNetCents, 450);
});

test("missing historical cost is excluded from margin and is not treated as zero", () => {
  const economics = calculatePriceTierEconomics({
    quantity: "1.000",
    publicUnitPriceSnapshotCents: 1000,
    wholesaleUnitPriceSnapshotCents: 900,
    approvedPriceTier: "public",
    approvedUnitPriceCents: 1000,
    unitPriceCents: 1000,
    lineTotalCents: 1000,
    unitCostSnapshotCents: null,
  });

  assert.equal(economics.costCents, null);
  assert.equal(economics.finalMarginCents, null);
  assert.equal(economics.marginPercentBps, null);
});

test("coverage separates lines and net amount with historical cost", () => {
  const coverage = buildRetailCommercialCoverage([
    {
      line: { quantity: "1.000", approvedPriceTier: "public", publicUnitPriceSnapshotCents: 100, wholesaleUnitPriceSnapshotCents: 90, approvedUnitPriceCents: 100, unitPriceCents: 100, lineTotalCents: 100, unitCostSnapshotCents: 50 },
    },
    {
      line: { quantity: "1.000", approvedPriceTier: "wholesale", publicUnitPriceSnapshotCents: 100, wholesaleUnitPriceSnapshotCents: 80, approvedUnitPriceCents: 80, unitPriceCents: 80, lineTotalCents: 80, unitCostSnapshotCents: null },
    },
    {
      line: { quantity: "1.000", approvedPriceTier: null, publicUnitPriceSnapshotCents: 100, wholesaleUnitPriceSnapshotCents: 80, unitPriceCents: 75, lineTotalCents: 75, unitCostSnapshotCents: null },
    },
  ]);

  assert.equal(coverage.totalLines, 3);
  assert.equal(coverage.linesWithCost, 1);
  assert.equal(coverage.linesWithoutCost, 2);
  assert.equal(coverage.netSalesWithCostCents, 100);
  assert.equal(coverage.netSalesWithoutCostCents, 155);
  assert.equal(coverage.costCoverageByLinesBps, 3333);
  assert.equal(coverage.costCoverageByAmountBps, 3922);
});

test("below-cost classification uses historical cost and exact quantity arithmetic", () => {
  const economics = calculatePriceTierEconomics({
    quantity: "1.500",
    approvedPriceTier: "public",
    publicUnitPriceSnapshotCents: 100,
    wholesaleUnitPriceSnapshotCents: 90,
    approvedUnitPriceCents: 100,
    unitPriceCents: 100,
    lineTotalCents: 149,
    unitCostSnapshotCents: 100,
  });

  assert.equal(economics.belowCost, true);
  assert.equal(economics.belowCostSalesCents, 149);
  assert.equal(economics.belowCostMarginCents, -1);
});

test("classification and decision preserve unknown and existing tier semantics", () => {
  const wholesale = { quantity: 1, approvedPriceTier: "wholesale" as const, requestedPriceTier: "wholesale" as const };
  assert.equal(classifyPriceTier([wholesale]), "wholesale");
  assert.equal(classifyPriceTier([{ quantity: 1, approvedPriceTier: null }, { quantity: 1, approvedPriceTier: "public" }]), "mixed");
  assert.equal(classifyPriceTier([{ quantity: 1, approvedPriceTier: null }]), "unknown");
  assert.equal(classifyPriceTierDecision(wholesale), "requested_approved");
});

test("distributed cent discounts are consumed exactly once", () => {
  const economics = calculatePriceTierEconomics({
    quantity: "1.000",
    approvedPriceTier: "public",
    publicUnitPriceSnapshotCents: 1001,
    wholesaleUnitPriceSnapshotCents: 900,
    approvedUnitPriceCents: 1001,
    unitPriceCents: 1001,
    directDiscountCents: 1,
    orderDiscountAllocationCents: 2,
    totalDiscountCents: 3,
    lineTotalCents: 998,
  });
  assert.equal(economics.finalNetCents, 998);
  assert.equal(economics.manualDiscountCents, 3);
});

test("large integer-cent values remain exact within the safe integer range", () => {
  const economics = calculatePriceTierEconomics({
    quantity: "1000000.000",
    approvedPriceTier: "public",
    publicUnitPriceSnapshotCents: 9000000000,
    wholesaleUnitPriceSnapshotCents: 8000000000,
    approvedUnitPriceCents: 9000000000,
    unitPriceCents: 9000000000,
    lineTotalCents: 9000000000000000,
    unitCostSnapshotCents: 8000000000,
  });
  assert.equal(economics.approvedBaseCents, 9000000000000000);
  assert.equal(economics.finalMarginCents, 1000000000000000);
});
