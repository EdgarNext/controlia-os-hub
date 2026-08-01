import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's strip-types runner needs an explicit extension.
import { calculateRetailShareBps, getRetailCostCoverageNotice, getRetailPriceTierLabel } from "./reporting-presentation.ts";

test("presenta niveles y participación sin confundir mayoreo con descuento", () => {
  assert.equal(getRetailPriceTierLabel("wholesale"), "Precio mayoreo");
  assert.equal(calculateRetailShareBps(25_000, 100_000), 2500);
});

test("explica cobertura parcial de costo histórico", () => {
  assert.equal(
    getRetailCostCoverageNotice({ linesWithCost: 2, totalLines: 4, costCoverageByAmountBps: 7500 }),
    "Margen calculado solo con costo histórico disponible: 2 de 4 líneas (75.0% del importe).",
  );
  assert.equal(getRetailCostCoverageNotice({ linesWithCost: 4, totalLines: 4, costCoverageByAmountBps: 10000 }), null);
  assert.equal(
    getRetailCostCoverageNotice({ linesWithCost: 0, totalLines: 3, costCoverageByAmountBps: 0 }),
    "Margen calculado solo con costo histórico disponible: 0 de 3 líneas (0.0% del importe).",
  );
});
