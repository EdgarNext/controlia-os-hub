import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node's strip-types runner needs an explicit extension.
import { getRecipeDisclosureLabels, hasComparableCostValues, hasMaterialContribution, hasMaterialCostVariation } from "./cost-breakdown-presentation.ts";

test("cost breakdown distinguishes material changes from unchanged values", () => {
  assert.equal(hasMaterialCostVariation(100, 100, 0), false);
  assert.equal(hasMaterialCostVariation(100, 100.005, null), false);
  assert.equal(hasMaterialCostVariation(100, 101, null), true);
  assert.equal(hasComparableCostValues(100, null), false);
  assert.equal(hasComparableCostValues(100, 100), true);
});

test("cost breakdown only surfaces meaningful event contribution", () => {
  assert.equal(hasMaterialContribution(null), false);
  assert.equal(hasMaterialContribution(0), false);
  assert.equal(hasMaterialContribution(0.009), false);
  assert.equal(hasMaterialContribution(42), true);
});

test("recipe disclosure labels communicate the collapsed and expanded states", () => {
  assert.deepEqual(getRecipeDisclosureLabels(3), { closed: "Ver 3 recetas", open: "Ocultar recetas" });
});
