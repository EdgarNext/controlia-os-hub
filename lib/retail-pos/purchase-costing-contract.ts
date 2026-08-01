const CAMEL_TO_SNAKE: Record<string, string> = {
  supplierId: "supplier_id",
  invoiceReference: "invoice_reference",
  invoiceDate: "invoice_date",
  taxRateBps: "tax_rate_bps",
  discountRateBps: "discount_rate_bps",
  defaultPublicMarkupBps: "default_public_markup_bps",
  defaultWholesaleMarkupBps: "default_wholesale_markup_bps",
  defaultPublicPriceMode: "default_public_price_mode",
  defaultWholesalePriceMode: "default_wholesale_price_mode",
  productId: "product_id",
  purchasedQuantity: "purchased_quantity",
  purchaseUnitLabel: "purchase_unit_label",
  unitsPerPurchaseUnit: "units_per_purchase_unit",
  invoiceUnitCostCents: "invoice_unit_cost_cents",
  publicMarkupOverrideBps: "public_markup_override_bps",
  wholesaleMarkupOverrideBps: "wholesale_markup_override_bps",
  finalPublicPriceCents: "final_public_price_cents",
  finalWholesalePriceCents: "final_wholesale_price_cents",
  publicPriceMode: "public_price_mode",
  wholesalePriceMode: "wholesale_price_mode",
};

/** Maps the public Hub mutation DTO to the snake_case JSON consumed by the RPC.
 * Undefined remains omitted; null remains explicit so clearing a field works.
 */
export function toPurchaseCostingRpcPayload(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [CAMEL_TO_SNAKE[key] ?? key, value]),
  );
}
