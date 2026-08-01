import assert from "node:assert/strict";
import test from "node:test";
import { toPurchaseCostingRpcPayload } from "./purchase-costing-contract.ts";

test("maps header mutations without turning omitted fields into null", () => {
  assert.deepEqual(
    toPurchaseCostingRpcPayload({
      supplierId: "supplier-1",
      invoiceReference: null,
      invoiceDate: undefined,
      taxRateBps: 1600,
    }),
    {
      supplier_id: "supplier-1",
      invoice_reference: null,
      tax_rate_bps: 1600,
    },
  );
});

test("maps the selected productId to the RPC product_id contract", () => {
  assert.deepEqual(
    toPurchaseCostingRpcPayload({
      productId: "product-1",
      purchasedQuantity: "1",
      purchaseUnitLabel: "pieza",
      unitsPerPurchaseUnit: "1",
      invoiceUnitCostCents: 1250,
      publicMarkupOverrideBps: null,
    }),
    {
      product_id: "product-1",
      purchased_quantity: "1",
      purchase_unit_label: "pieza",
      units_per_purchase_unit: "1",
      invoice_unit_cost_cents: 1250,
      public_markup_override_bps: null,
    },
  );
});

test("maps independent final price modes to the RPC contract", () => {
  assert.deepEqual(
    toPurchaseCostingRpcPayload({ publicPriceMode: "rounded", wholesalePriceMode: "manual" }),
    { public_price_mode: "rounded", wholesale_price_mode: "manual" },
  );
});
