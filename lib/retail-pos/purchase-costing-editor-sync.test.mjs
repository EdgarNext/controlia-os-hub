import assert from "node:assert/strict";
import test from "node:test";
import { reconcilePurchaseCostingDocument } from "./purchase-costing-editor-sync.ts";

function document(overrides = {}) {
  return {
    id: "costing-1", tenantId: "tenant-1", supplierId: null, supplierName: null, invoiceReference: null, invoiceDate: null,
    status: "draft", taxRateBps: 0, discountRateBps: 0, defaultPublicMarkupBps: 0, defaultWholesaleMarkupBps: 0,
    subtotalCents: 0, taxCents: 0, grossTotalCents: 0, discountCents: 0, netTotalCents: 0, totalSaleUnits: "0", revision: 1,
    createdByPosUserId: null, createdByPosUserName: null, calculatedByPosUserId: null, calculatedByPosUserName: null,
    appliedByPosUserId: null, appliedByPosUserName: null, createdAt: "now", updatedAt: "now", calculatedAt: null, appliedAt: null, lines: [], ...overrides,
  };
}

test("preserves a newer local header edit while confirming the older response", () => {
  const base = document();
  const local = document({ invoiceReference: "B" });
  const server = document({ invoiceReference: "A", revision: 2, updatedAt: "later" });
  const result = reconcilePurchaseCostingDocument(server, local, { mutationId: 1, expectedRevision: 1, baseDocument: base, patch: { invoiceReference: "A" } });
  assert.equal(result.invoiceReference, "B");
  assert.equal(result.revision, 2);
  assert.equal(result.updatedAt, "later");
});

test("accepts server-confirmed fields and calculated values when no newer edit exists", () => {
  const baseLine = { id: "line-1", productId: "product-1", invoiceUnitCostCents: 1000, baseUnitCostCents: null };
  const base = document({ lines: [baseLine] });
  const local = document({ lines: [{ ...baseLine, invoiceUnitCostCents: 1500 }] });
  const server = document({ revision: 2, lines: [{ ...baseLine, invoiceUnitCostCents: 1500, baseUnitCostCents: 1200 }] });
  const result = reconcilePurchaseCostingDocument(server, local, { mutationId: 1, expectedRevision: 1, baseDocument: base, patch: { invoiceUnitCostCents: 1500 } });
  assert.equal(result.lines[0].invoiceUnitCostCents, 1500);
  assert.equal(result.lines[0].baseUnitCostCents, 1200);
});
