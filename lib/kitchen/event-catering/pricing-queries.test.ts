import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node's strip-types runner needs an explicit extension.
import { buildBatchPlanPricing } from "./pricing-batch.ts";

test("batch pricing applies persisted values and tenant defaults", () => {
  const result = buildBatchPlanPricing({
    tenantId: "tenant-1",
    planIds: ["plan-1", "plan-2", "plan-2"],
    planIdsFound: ["plan-1", "plan-2"],
    pricingRows: [{
        id: "pricing-1",
        tenant_id: "tenant-1",
        plan_id: "plan-1",
        extra_staff_count: 2,
        extra_staff_unit_cost: 100,
        target_margin_pct: 30,
        staff_rate_source: "plan_override",
        margin_source: "plan_override",
        currency: "MXN",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      }],
    settings: {
        tenant_id: "tenant-1",
        default_target_margin_pct: 25,
        default_extra_staff_unit_cost: 75,
        currency: "MXN",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
    },
  });
  assert.deepEqual([...result.keys()], ["plan-1", "plan-2"]);
  assert.equal(result.get("plan-1")?.extra_staff_count, 2);
  assert.equal(result.get("plan-2")?.extra_staff_unit_cost, 75);
  assert.equal(result.get("plan-2")?.target_margin_pct, 25);
});

test("batch pricing rejects a plan outside the tenant result set", () => {
  assert.throws(
    () => buildBatchPlanPricing({ tenantId: "tenant-1", planIds: ["plan-3"], planIdsFound: [], pricingRows: [], settings: null }),
    /Plan inválido para el tenant/,
  );
});
