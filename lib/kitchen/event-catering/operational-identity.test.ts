import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOperationalConfigurationPayload,
  hasSameOperationalConfiguration,
} from "./operational-identity";

const event = { id: "event-1" };
const plans = [{ id: "plan-b", planned_guest_count: 45, status: "draft" }, { id: "plan-a", planned_guest_count: 20, status: "approved" }];
const recipes = [
  { id: "recipe-b", plan_id: "plan-b", recipe_id: "recipe-2", recipe_version_id: "version-2", planned_servings: 45, multiplier: 1 },
  { id: "recipe-a", plan_id: "plan-b", recipe_id: "recipe-1", recipe_version_id: "version-1", planned_servings: 45, multiplier: 1.5 },
];

test("operational identity ignores presentation, lifecycle and pricing", () => {
  const current = buildOperationalConfigurationPayload(event, plans, recipes);
  const snapshotPayload = {
    event_id: "event-1",
    event_name: "Nombre anterior",
    pricing_model_version: "service_margin_v1",
    pricing: [{ plan_id: "plan-b", targetMarginPct: 35 }],
    services: [
      {
        plan_id: "plan-a",
        service_name: "Servicio renombrado",
        planned_guest_count: 20,
        status: "planned",
        recipes: [],
      },
      {
        plan_id: "plan-b",
        service_name: "Desayuno",
        planned_guest_count: 45,
        status: "approved",
        recipes: [
          { plan_recipe_id: "recipe-a", recipe_id: "recipe-1", recipe_version_id: "version-1", recipe_name: "Renombrada", planned_servings: 45, multiplier: 1.5 },
          { plan_recipe_id: "recipe-b", recipe_id: "recipe-2", recipe_version_id: "version-2", recipe_name: "Otra", planned_servings: 45, multiplier: 1 },
        ],
      },
    ],
  };

  assert.equal(hasSameOperationalConfiguration(current, snapshotPayload), true);
});

test("operational identity changes for a canceled plan or planned servings", () => {
  const current = buildOperationalConfigurationPayload(event, plans, recipes);
  const canceled = buildOperationalConfigurationPayload(event, [{ ...plans[0], status: "canceled" }, plans[1]], recipes);
  const changedServings = buildOperationalConfigurationPayload(event, plans, [{ ...recipes[0], planned_servings: 46 }, recipes[1]]);

  assert.notDeepEqual(current, canceled);
  assert.notDeepEqual(current, changedServings);
});
