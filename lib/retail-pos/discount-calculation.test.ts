const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildRetailPosDiscountCalculationFingerprint,
  buildRetailPosDiscountCalculationFingerprintPayload,
  buildRetailPosDiscountCalculationSummary,
  buildRetailPosDiscountPreviewResponse,
} = require("./discount-calculation.ts");

const LINES = [
  {
    id: "line-2",
    tenant_id: "tenant-1",
    order_id: "order-1",
    line_number: 2,
    product_id: "product-2",
    product_variant_id: null,
    product_name: "Cable por metro",
    variant_name: null,
    sku: "CABLE-02",
    barcode: null,
    sales_unit_code: "m",
    sales_unit_label: "m",
    allow_decimal_quantity: true,
    quantity: "2.000",
    unit_price_cents: 900,
    line_subtotal_cents: 1800,
    discount_cents: 0,
    line_total_cents: 1800,
    unit_cost_snapshot_cents: null,
    direct_discount_cents: 0,
    order_discount_allocation_cents: 0,
    total_discount_cents: 0,
    cost_evaluation: "unknown" as const,
    below_cost_after_discount: false,
    created_at: "2026-07-13T00:00:00.000Z",
    updated_at: "2026-07-13T00:00:00.000Z",
    created_by: null,
    updated_by: null,
    unit_cost_source_cents: 800,
  },
  {
    id: "line-1",
    tenant_id: "tenant-1",
    order_id: "order-1",
    line_number: 1,
    product_id: "product-1",
    product_variant_id: null,
    product_name: "Herramienta",
    variant_name: null,
    sku: "TOOL-01",
    barcode: null,
    sales_unit_code: "pz",
    sales_unit_label: "pieza",
    allow_decimal_quantity: false,
    quantity: "1.000",
    unit_price_cents: 1000,
    line_subtotal_cents: 1000,
    discount_cents: 0,
    line_total_cents: 1000,
    unit_cost_snapshot_cents: null,
    direct_discount_cents: 0,
    order_discount_allocation_cents: 0,
    total_discount_cents: 0,
    cost_evaluation: "unknown" as const,
    below_cost_after_discount: false,
    created_at: "2026-07-13T00:00:00.000Z",
    updated_at: "2026-07-13T00:00:00.000Z",
    created_by: null,
    updated_by: null,
    unit_cost_source_cents: 980,
  },
];

const INTENTS = [
  {
    id: "order-10",
    scope: "order" as const,
    order_line_id: null,
    capture_type: "percentage" as const,
    percentage_bps: 1000,
    amount_cents: null,
    reason_code: "volume" as const,
    comment: null,
    source: "manual" as const,
    authorization: null,
  },
  {
    id: "line-10",
    scope: "line" as const,
    order_line_id: "line-1",
    capture_type: "fixed_amount" as const,
    percentage_bps: null,
    amount_cents: 100,
    reason_code: "price_adjustment" as const,
    comment: null,
    source: "manual" as const,
    authorization: null,
  },
];

test("discount calculation fingerprint is stable across input ordering", () => {
  const summaryA = buildRetailPosDiscountCalculationSummary({
    orderId: "order-1",
    expectedRevision: 7,
    lines: LINES,
    intents: INTENTS,
  });
  const summaryB = buildRetailPosDiscountCalculationSummary({
    orderId: "order-1",
    expectedRevision: 7,
    lines: [...LINES].reverse(),
    intents: [...INTENTS].reverse(),
  });

  const fingerprintA = buildRetailPosDiscountCalculationFingerprint(
    buildRetailPosDiscountCalculationFingerprintPayload({
      tenantId: "tenant-1",
      orderId: "order-1",
      expectedRevision: 7,
      lines: LINES,
      intents: INTENTS,
      summary: summaryA,
    }),
  );
  const fingerprintB = buildRetailPosDiscountCalculationFingerprint(
    buildRetailPosDiscountCalculationFingerprintPayload({
      tenantId: "tenant-1",
      orderId: "order-1",
      expectedRevision: 7,
      lines: [...LINES].reverse(),
      intents: [...INTENTS].reverse(),
      summary: summaryB,
    }),
  );

  assert.equal(summaryA.total_cents, summaryB.total_cents);
  assert.deepEqual(summaryA.lines, summaryB.lines);
  assert.equal(fingerprintA, fingerprintB);
});

test("discount preview response redacts exact costs without hiding below-cost state", () => {
  const summary = buildRetailPosDiscountCalculationSummary({
    orderId: "order-1",
    expectedRevision: 3,
    lines: [
      {
        ...LINES[1],
        unit_cost_source_cents: 980,
      },
    ],
    intents: [
      {
        id: "line-below-cost",
        scope: "line",
        order_line_id: "line-1",
        capture_type: "fixed_amount",
        percentage_bps: null,
        amount_cents: 200,
        reason_code: "damaged_product",
        comment: null,
        source: "manual",
        authorization: null,
      },
    ],
  });

  const response = buildRetailPosDiscountPreviewResponse({
    orderId: "order-1",
    revision: 3,
    calculationFingerprint: "fingerprint-1",
    summary,
    lines: [
      {
        ...LINES[1],
        unit_cost_source_cents: 980,
      },
    ],
    canViewCost: false,
  });

  assert.equal(response.has_below_cost_lines, true);
  assert.equal(response.requires_below_cost_acknowledgement, true);
  assert.deepEqual(response.below_cost_line_ids, ["line-1"]);
  assert.equal(response.lines[0].below_cost_after_discount, true);
  assert.equal(response.lines[0].unit_cost_snapshot_cents, null);
  assert.equal(response.lines[0].total_cost_cents, null);
  assert.equal(response.lines[0].margin_delta_cents, null);
});

test("discount calculation normalizes legacy quantity formats before calling the engine", () => {
  const summary = buildRetailPosDiscountCalculationSummary({
    orderId: "order-legacy",
    expectedRevision: 4,
    lines: [
      {
        ...LINES[1],
        quantity: "1",
      },
    ],
    intents: [
      {
        id: "line-legacy",
        scope: "line",
        order_line_id: "line-1",
        capture_type: "fixed_amount",
        percentage_bps: null,
        amount_cents: 100,
        reason_code: "price_adjustment",
        comment: null,
        source: "manual",
        authorization: null,
      },
    ],
  });

  assert.equal(summary.total_cents, 900);
  assert.equal(summary.lines[0].gross_cents, 1000);
  assert.equal(summary.lines[0].net_cents, 900);
});
