import assert from "node:assert/strict";
import test from "node:test";
import {
  appendDiagnosticEvent,
  isCostingDiagnosticsEnabled,
} from "./purchase-costing-diagnostics.ts";

test("diagnostics are enabled only by debugCosting=1", () => {
  assert.equal(isCostingDiagnosticsEnabled("?debugCosting=1"), true);
  assert.equal(isCostingDiagnosticsEnabled("?debugCosting=0"), false);
  assert.equal(isCostingDiagnosticsEnabled("?foo=1"), false);
});

test("diagnostic history is limited to the latest 100 events", () => {
  let events = [];
  for (let index = 0; index < 105; index += 1) {
    events = appendDiagnosticEvent(events, { event: "state-updated", field: String(index) });
  }
  assert.equal(events.length, 100);
  assert.equal(events[0].field, "5");
  assert.equal(events.at(-1).field, "104");
});

test("event JSON has no transport headers or credentials", () => {
  const events = appendDiagnosticEvent([], {
    event: "request-start",
    requestBody: { supplierId: "supplier-1" },
  });
  const serialized = JSON.stringify(events);
  assert.equal(serialized.includes("authorization"), false);
  assert.equal(serialized.includes("cookie"), false);
  assert.equal(serialized.includes("service_role"), false);
  assert.equal(serialized.includes("supplierId"), true);
});
