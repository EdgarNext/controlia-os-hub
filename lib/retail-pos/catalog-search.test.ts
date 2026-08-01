import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRetailPosCostingSearchQuery,
  parseBooleanQueryParam,
} from "./catalog-search";

test("costing search normalizes accepted filters and keeps the server limit bounded", () => {
  assert.deepEqual(
    normalizeRetailPosCostingSearchQuery({
      query: "  Café  ",
      supplierId: "11111111-1111-4111-8111-111111111111",
      supplierOnly: true,
      limit: 20,
    }),
    {
      query: "Café",
      supplierId: "11111111-1111-4111-8111-111111111111",
      supplierOnly: true,
      limit: 20,
    },
  );
});

test("costing search accepts only the documented boolean encodings", () => {
  assert.equal(parseBooleanQueryParam("true", "supplierOnly"), true);
  assert.equal(parseBooleanQueryParam("1", "supplierOnly"), true);
  assert.equal(parseBooleanQueryParam("false", "supplierOnly"), false);
  assert.equal(parseBooleanQueryParam("0", "supplierOnly"), false);
  assert.throws(() => parseBooleanQueryParam("yes", "supplierOnly"), /supplierOnly/);
});

test("costing search rejects invalid UUIDs and limits", () => {
  assert.throws(
    () =>
      normalizeRetailPosCostingSearchQuery({
        query: "cable",
        supplierId: "not-a-uuid",
        supplierOnly: false,
        limit: 20,
      }),
    /supplierId/,
  );
  assert.throws(
    () =>
      normalizeRetailPosCostingSearchQuery({
        query: "cable",
        supplierId: null,
        supplierOnly: false,
        limit: 21,
      }),
    /limit/,
  );
});
