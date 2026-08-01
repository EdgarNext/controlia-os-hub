import assert from "node:assert/strict";
import test from "node:test";
import { centsToInput, formatBpsPercent, inputToCents, parsePercentToBps, pluralizeRetailPosUnit, resolvePurchaseCostingFinalPrice, roundCentsUpToPeso, singularizeRetailPosPresentation } from "./purchase-costing-ui.ts";

test("converts visible percentages to basis points without floating authority", () => {
  assert.equal(parsePercentToBps("16", 10_000), 1_600);
  assert.equal(parsePercentToBps("35.5", 100_000), 3_550);
  assert.equal(parsePercentToBps("10.123", 10_000), null);
  assert.equal(formatBpsPercent(1_600), "16");
  assert.equal(formatBpsPercent(3_550), "35.5");
});

test("converts monetary inputs to integer cents", () => {
  assert.equal(inputToCents("140.94"), 14_094);
  assert.equal(inputToCents("140,9"), 14_090);
  assert.equal(inputToCents("0"), 0);
  assert.equal(inputToCents("140.999"), null);
  assert.equal(centsToInput(14_094), "140.94");
  assert.equal(centsToInput(0), "");
});

test("rounds final prices up to the next whole peso", () => {
  assert.equal(roundCentsUpToPeso(25_134), 25_200);
  assert.equal(roundCentsUpToPeso(35_700), 35_700);
});

test("resolves each final price mode independently", () => {
  assert.equal(resolvePurchaseCostingFinalPrice("suggested", 25_134, 99_999), 25_134);
  assert.equal(resolvePurchaseCostingFinalPrice("rounded", 25_134, 99_999), 25_200);
  assert.equal(resolvePurchaseCostingFinalPrice("rounded", 25_100, 99_999), 25_100);
  assert.equal(resolvePurchaseCostingFinalPrice("manual", 25_134, 25_500), 25_500);
  assert.equal(resolvePurchaseCostingFinalPrice("rounded", null, null), null);
});

test("builds compact purchase conversion labels", () => {
  assert.equal(pluralizeRetailPosUnit("Pieza"), "Piezas");
  assert.equal(pluralizeRetailPosUnit("Kilogramo"), "Kilogramos");
  assert.equal(singularizeRetailPosPresentation("cajas"), "caja");
  assert.equal(singularizeRetailPosPresentation("tubos"), "tubo");
});
