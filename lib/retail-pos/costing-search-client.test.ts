import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCostingSearchUrl,
  fetchCostingProducts,
  normalizeCostingSearchClientQuery,
} from "./costing-search-client";

test("builds the tenant-scoped costing search URL with only supported parameters", () => {
  const url = buildCostingSearchUrl({
    tenantSlug: "las-quintas/ignored",
    query: "disco corte",
    supplierId: "supplier-1",
    supplierOnly: true,
    limit: 20,
  });

  assert.equal(
    url,
    "/api/tenant/las-quintas%2Fignored/retail-pos/catalog/costing-search?q=disco+corte&supplierId=supplier-1&supplierOnly=true&limit=20",
  );
  assert.equal(url.includes("tenantId"), false);
  assert.equal(url.includes("barcode"), false);
});

test("fetches result DTOs and hides internal HTTP error details behind a user-safe error", async () => {
  const result = await fetchCostingProducts(
    {
      tenantSlug: "las-quintas",
      query: "cable",
      supplierOnly: false,
    },
    async () =>
      new Response(
        JSON.stringify({ results: [{ productId: "product-1" }], meta: { count: 1 } }),
        { status: 200 },
      ),
  );
  assert.equal(result[0]?.productId, "product-1");

  await assert.rejects(
    () =>
      fetchCostingProducts(
        { tenantSlug: "las-quintas", query: "cable", supplierOnly: false },
        async () => new Response(JSON.stringify({ error: "SQL detail" }), { status: 500 }),
      ),
    /No fue posible buscar productos/,
  );
});

test("normalizes the cache key query without changing the request text", () => {
  assert.equal(normalizeCostingSearchClientQuery("  CÁBLE   PVC  "), "cable pvc");
});
