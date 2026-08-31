import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node's strip-types runner needs an explicit extension; Next's bundler resolves the extensionless import in production.
import { aggregateFinancialPricing, calculateServiceCostPerPerson, resolveCateringPricingSource, resolveCurrentServiceFoodCost, selectPreferredV1Snapshot } from "./financial-reporting.ts";
// @ts-expect-error Node's strip-types runner needs an explicit extension; Next's bundler resolves the extensionless import in production.
import { calculateCateringServicePricing } from "./financial-model.ts";
import type { CateringPlanFinancialPricing } from "./types";

test("prefers the latest updated V1 snapshot over initial snapshots", () => {
  const selected = selectPreferredV1Snapshot([
    { snapshotKind: "initial", pricingModelVersion: "service_margin_v1", createdAt: "2026-01-03" },
    { snapshotKind: "updated", pricingModelVersion: "service_margin_v1", createdAt: "2026-01-01" },
    { snapshotKind: "updated", pricingModelVersion: "service_margin_v1", createdAt: "2026-01-02" },
    { snapshotKind: "updated", pricingModelVersion: "legacy", createdAt: "2026-01-04" },
  ]);
  assert.equal(selected?.createdAt, "2026-01-02");
});

test("uses current preview for every editable plan, even when V1 exists", () => {
  for (const status of ["draft", "planned"] as const) {
    assert.equal(resolveCateringPricingSource(status, false), "current_preview");
    assert.equal(resolveCateringPricingSource(status, true), "current_preview");
  }
});

test("uses V1 only for historical plans and preserves legacy unavailable", () => {
  for (const status of ["approved", "canceled"] as const) {
    assert.equal(resolveCateringPricingSource(status, true), "snapshot_v1");
    assert.equal(resolveCateringPricingSource(status, false), "legacy_unavailable");
  }
});

test("editable lifecycle uses newer current economics instead of frozen historical economics", () => {
  const current = calculateCateringServicePricing({ foodCost: 23_000, extraStaffCount: 0, extraStaffUnitCost: null, targetMarginPct: 30, plannedGuestCount: 100, currency: "MXN" });
  const historical = calculateCateringServicePricing({ foodCost: 23_000, extraStaffCount: 0, extraStaffUnitCost: null, targetMarginPct: 25, plannedGuestCount: 100, currency: "MXN" });
  assert.equal(resolveCateringPricingSource("planned", true), "current_preview");
  assert.equal(current.targetMarginPct, 30);
  assert.notEqual(current.targetMarginPct, historical.targetMarginPct);
  assert.ok(Math.abs(current.suggestedServicePrice! - 32_857.142857) < 0.001);
  assert.ok(Math.abs(current.suggestedServicePrice! - historical.suggestedServicePrice!) > 1_000);
});

test("dashboard pricing source inherits the same lifecycle resolution as the individual report", () => {
  const individualSource = resolveCateringPricingSource("planned", true);
  const dashboardRowSource = resolveCateringPricingSource("planned", true);
  assert.equal(individualSource, "current_preview");
  assert.equal(dashboardRowSource, individualSource);
});

test("aggregates suggested margin as a weighted ratio and excludes incomplete pricing", () => {
  const item = (overrides: Partial<CateringPlanFinancialPricing>): CateringPlanFinancialPricing => ({
    source: "snapshot_v1", status: "ready", pricingModelVersion: "service_margin_v1", foodCost: 100,
    extraStaffCount: 0, extraStaffUnitCost: null, extraLaborCost: 0, serviceCostBasis: 100,
    targetMarginPct: 25, suggestedProfit: 25, suggestedServicePrice: 125, suggestedPricePerGuest: null,
    currentFoodCostSource: "updated_snapshot", currency: "MXN", warnings: [], ...overrides,
  });
  const result = aggregateFinancialPricing([
    item({ suggestedProfit: 25, suggestedServicePrice: 125 }),
    item({ suggestedProfit: 75, suggestedServicePrice: 375 }),
    item({ status: "incomplete", suggestedProfit: null, suggestedServicePrice: null }),
    item({ source: "legacy_unavailable", status: "unavailable", serviceCostBasis: null, suggestedProfit: null, suggestedServicePrice: null }),
  ]);
  assert.equal(result.pricingReadyServices, 2);
  assert.equal(result.pricingIncompleteServices, 1);
  assert.equal(result.legacyPricingUnavailableServices, 1);
  assert.equal(result.effectiveSuggestedMarginPct, 20);
});

test("resolves current food cost by saved updated, initial, then preview precedence", () => {
  assert.deepEqual(resolveCurrentServiceFoodCost({ updatedCost: 120, initialCost: 100, previewCost: 90, estimatedCost: 80 }), { amount: 120, source: "updated_snapshot" });
  assert.deepEqual(resolveCurrentServiceFoodCost({ updatedCost: null, initialCost: 100, previewCost: 90, estimatedCost: 80 }), { amount: 100, source: "initial_snapshot" });
  assert.deepEqual(resolveCurrentServiceFoodCost({ updatedCost: null, initialCost: null, previewCost: 90, estimatedCost: 80 }), { amount: 90, source: "current_preview" });
  assert.deepEqual(resolveCurrentServiceFoodCost({ updatedCost: null, initialCost: null, previewCost: null, estimatedCost: null }), { amount: null, source: "unavailable" });
});

test("uses planned service covers for current cost per person", () => {
  assert.equal(calculateServiceCostPerPerson(1_200, 100), 12);
  assert.equal(calculateServiceCostPerPerson(1_200, 0), null);
  assert.equal(calculateServiceCostPerPerson(null, 100), null);
});
