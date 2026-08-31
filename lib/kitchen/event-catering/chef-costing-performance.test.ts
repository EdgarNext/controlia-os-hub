import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node's strip-types runner needs an explicit extension.
import { eventMatchesOverviewQuery, eventMatchesPeriod, resolveStructuralChefCostingStatus } from "./overview-performance.ts";

const event = (starts_at: string | null, name = "HONEYWELL") => ({
  id: "event-1",
  name,
  status: "published" as const,
  starts_at,
  ends_at: null,
  expected_attendance: 1500,
});

test("early overview period filtering preserves upcoming, recent, and null-date semantics", () => {
  const today = "2026-08-28";
  assert.equal(eventMatchesPeriod(event("2026-08-28T15:00:00.000Z"), "proximos", today), true);
  assert.equal(eventMatchesPeriod(event("2026-08-27T15:00:00.000Z"), "proximos", today), false);
  assert.equal(eventMatchesPeriod(event("2026-08-27T15:00:00.000Z"), "recientes", today), true);
  assert.equal(eventMatchesPeriod(event("2026-08-28T15:00:00.000Z"), "recientes", today), false);
  assert.equal(eventMatchesPeriod(event(null), "proximos", today), true);
  assert.equal(eventMatchesPeriod(event(null), "recientes", today), false);
  assert.equal(eventMatchesPeriod(event("2026-08-27T15:00:00.000Z"), "todos", today), true);
});

test("early overview search preserves case-insensitive substring matching", () => {
  assert.equal(eventMatchesOverviewQuery(event(null, "Expo HONEYWELL 2026"), "honeywell"), true);
  assert.equal(eventMatchesOverviewQuery(event(null, "Expo HONEYWELL 2026"), "expo 2027"), false);
  assert.equal(eventMatchesOverviewQuery(event(null, "Expo HONEYWELL 2026"), ""), true);
});

test("structural statuses are resolved without price-aware work", () => {
  assert.equal(resolveStructuralChefCostingStatus({ servicesCount: 0, recipesCount: 0, hasAnyRecipes: false, hasInitialSnapshot: false, configurationChanged: false }), "sin_servicios");
  assert.equal(resolveStructuralChefCostingStatus({ servicesCount: 1, recipesCount: 0, hasAnyRecipes: false, hasInitialSnapshot: false, configurationChanged: false }), "sin_recetas");
  assert.equal(resolveStructuralChefCostingStatus({ servicesCount: 2, recipesCount: 1, hasAnyRecipes: true, hasInitialSnapshot: false, configurationChanged: false }), "configuracion_incompleta");
  assert.equal(resolveStructuralChefCostingStatus({ servicesCount: 1, recipesCount: 1, hasAnyRecipes: true, hasInitialSnapshot: false, configurationChanged: false }), "pendiente_costeo");
  assert.equal(resolveStructuralChefCostingStatus({ servicesCount: 1, recipesCount: 1, hasAnyRecipes: true, hasInitialSnapshot: true, configurationChanged: true }), "configuracion_modificada");
});
