import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node's strip-types runner needs an explicit extension.
import { costingStatusRequiresAttention, getChefCostingStatusPresentation, listChefCostingStatusPresentations, serviceRequiresManagerialAttention } from "./costing-status.ts";

const expected = [
  "Sin servicios",
  "Sin recetas",
  "Configuración incompleta",
  "Pendiente de costeo",
  "Configuración modificada",
  "Precios por revisar",
  "Hay precios nuevos",
  "Costo actualizado",
  "Costo inicial vigente",
];

test("every costing status has canonical product metadata", () => {
  const presentations = listChefCostingStatusPresentations();
  assert.deepEqual(presentations.map((item) => item.label), expected);
  for (const item of presentations) {
    assert.ok(item.label.trim());
    assert.ok(item.meaning.trim());
    assert.ok(item.suggestedAction.trim());
    assert.ok(["informational", "attention", "action_required"].includes(item.severity));
  }
});

test("canonical metadata remains addressable by status", () => {
  assert.equal(getChefCostingStatusPresentation("hay_precios_nuevos").label, "Hay precios nuevos");
  assert.equal(getChefCostingStatusPresentation("precios_necesitan_revision").label, "Precios por revisar");
});

test("only actionable costing states require attention", () => {
  assert.equal(costingStatusRequiresAttention("costo_inicial_vigente"), false);
  assert.equal(costingStatusRequiresAttention("costo_actualizado"), false);
  for (const status of ["sin_servicios", "sin_recetas", "configuracion_incompleta", "pendiente_costeo", "configuracion_modificada", "precios_necesitan_revision", "hay_precios_nuevos"] as const) {
    assert.equal(costingStatusRequiresAttention(status), true);
  }
});

test("managerial attention combines canonical status and incomplete pricing", () => {
  assert.equal(serviceRequiresManagerialAttention({ costingStatus: "costo_inicial_vigente", pricingStatus: "ready" }), false);
  assert.equal(serviceRequiresManagerialAttention({ costingStatus: "costo_inicial_vigente", pricingStatus: "incomplete" }), true);
  const activeStatuses = ["costo_inicial_vigente", "costo_inicial_vigente", "costo_inicial_vigente", "costo_inicial_vigente", "costo_inicial_vigente", "costo_inicial_vigente", "hay_precios_nuevos", "hay_precios_nuevos", "pendiente_costeo", "costo_inicial_vigente"] as const;
  const requiresAttention = activeStatuses.filter((status, index) => serviceRequiresManagerialAttention({ costingStatus: status, pricingStatus: index === 9 ? "incomplete" : "ready" })).length;
  assert.equal(requiresAttention, 4);
});
