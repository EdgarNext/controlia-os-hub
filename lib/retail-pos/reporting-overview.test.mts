import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRetailCommercialWaterfall,
  buildRetailOverviewAttentionSignals,
  buildRetailPaymentMix,
  buildRetailPostSaleTrend,
  buildRetailSalesActivityTrend,
  buildRetailSalesAdjustmentsTrend,
  buildRetailSalesTrend,
  selectRetailSalesTrendGranularity,
} from "./reporting-overview";

test("waterfall conserva orden y no resta reembolsos pendientes", () => {
  const rows = buildRetailCommercialWaterfall({
    grossSalesCents: 100_000,
    discountsCents: 10_000,
    netSalesCents: 90_000,
    cancelledSalesCents: 15_000,
    returnedCents: 5_000,
    commercialNetCents: 70_000,
  });

  assert.deepEqual(
    rows.map((row) => row.key),
    ["gross_sales", "discounts", "collected_sales", "sale_cancellations", "returns", "commercial_result"],
  );
  assert.deepEqual(
    rows.map((row) => row.kind),
    ["total", "decrease", "subtotal", "decrease", "decrease", "total"],
  );
  assert.equal(rows[5]?.amountCents, 70_000);
});

test("mezcla de cobro calcula porcentajes y tolera total cero", () => {
  const withTotals = buildRetailPaymentMix([
    { method: "cash", totalCents: 40_000 },
    { method: "card", totalCents: 60_000 },
  ]);
  assert.equal(withTotals[0]?.share, 0.4);
  assert.equal(withTotals[1]?.share, 0.6);

  const withoutTotals = buildRetailPaymentMix([
    { method: "cash", totalCents: 0 },
    { method: "card", totalCents: 0 },
  ]);
  assert.equal(withoutTotals[0]?.share, null);
  assert.equal(withoutTotals[1]?.share, null);
});

test("selecciona granularidad correcta para none, día, semana y mes", () => {
  assert.equal(selectRetailSalesTrendGranularity("2026-07-14", "2026-07-14"), "none");
  assert.equal(selectRetailSalesTrendGranularity("2026-07-14", "2026-07-15"), "day");
  assert.equal(selectRetailSalesTrendGranularity("2026-07-01", "2026-08-15"), "week");
  assert.equal(selectRetailSalesTrendGranularity("2026-01-01", "2026-05-31"), "month");
});

test("agrega tendencia diaria con puntos en cero cuando no hubo actividad", () => {
  const trend = buildRetailSalesTrend({
    dateFrom: "2026-07-13",
    dateTo: "2026-07-15",
    paidOrders: [
      { paidAt: "2026-07-13T18:00:00.000Z", totalCents: 50_000 },
      { paidAt: "2026-07-15T18:00:00.000Z", totalCents: 10_000 },
    ],
    completedPostSaleDocuments: [
      {
        createdAt: "2026-07-15T19:00:00.000Z",
        documentType: "sale_cancellation",
        netAmountCents: 2_000,
      },
    ],
  });

  assert.equal(trend.granularity, "day");
  assert.equal(trend.points.length, 3);
  assert.equal(trend.points[1]?.collectedSalesCents, 0);
  assert.equal(trend.points[1]?.commercialResultCents, 0);
  assert.equal(trend.points[2]?.commercialResultCents, 8_000);
});

test("agrega tendencia semanal respetando venta cobrada menos postventa del bucket", () => {
  const trend = buildRetailSalesTrend({
    dateFrom: "2026-07-01",
    dateTo: "2026-08-15",
    paidOrders: [
      { paidAt: "2026-07-02T18:00:00.000Z", totalCents: 30_000 },
      { paidAt: "2026-07-10T18:00:00.000Z", totalCents: 20_000 },
    ],
    completedPostSaleDocuments: [
      {
        createdAt: "2026-07-10T19:00:00.000Z",
        documentType: "return_full",
        netAmountCents: 5_000,
      },
    ],
  });

  assert.equal(trend.granularity, "week");
  assert.ok(trend.points.length > 1);
  const weekWithReturn = trend.points.find((point) => point.dateFrom <= "2026-07-10" && point.dateTo >= "2026-07-10");
  assert.equal(weekWithReturn?.collectedSalesCents, 20_000);
  assert.equal(weekWithReturn?.commercialResultCents, 15_000);
});

test("agrega tendencia mensual en rangos amplios", () => {
  const trend = buildRetailSalesTrend({
    dateFrom: "2026-01-01",
    dateTo: "2026-05-31",
    paidOrders: [
      { paidAt: "2026-01-15T18:00:00.000Z", totalCents: 10_000 },
      { paidAt: "2026-03-15T18:00:00.000Z", totalCents: 20_000 },
    ],
    completedPostSaleDocuments: [
      {
        createdAt: "2026-03-16T18:00:00.000Z",
        documentType: "sale_cancellation",
        netAmountCents: 4_000,
      },
    ],
  });

  assert.equal(trend.granularity, "month");
  assert.equal(trend.points.length, 5);
  assert.equal(trend.points[0]?.collectedSalesCents, 10_000);
  assert.equal(trend.points[2]?.commercialResultCents, 16_000);
});

test("genera asuntos de atención solo cuando existen incidencias reales", () => {
  const signals = buildRetailOverviewAttentionSignals({
    pendingRefundsCount: 2,
    pendingRefundCents: 1_500,
    pendingOrdersCount: 1,
    openShiftsCount: 0,
    belowCostOrdersCount: 3,
    failedPrintCount: 0,
  });

  assert.deepEqual(
    signals.map((signal) => signal.key),
    ["pending_reimbursements", "pending_orders", "below_cost_orders"],
  );
});

test("calcula ticket promedio por bucket y soporta cero ventas", () => {
  const trend = buildRetailSalesActivityTrend({
    dateFrom: "2026-07-13",
    dateTo: "2026-07-15",
    paidOrders: [
      { paidAt: "2026-07-13T18:00:00.000Z", totalCents: 50_000, discountCents: 5_000 },
      { paidAt: "2026-07-13T19:00:00.000Z", totalCents: 30_000, discountCents: 0 },
    ],
  });

  assert.equal(trend.granularity, "day");
  assert.equal(trend.points[0]?.collectedSalesCents, 80_000);
  assert.equal(trend.points[0]?.paidSalesCount, 2);
  assert.equal(trend.points[0]?.averageTicketCents, 40_000);
  assert.equal(trend.points[1]?.paidSalesCount, 0);
  assert.equal(trend.points[1]?.averageTicketCents, null);
});

test("agrega descuentos, anulaciones y devoluciones por bucket", () => {
  const trend = buildRetailSalesAdjustmentsTrend({
    dateFrom: "2026-07-13",
    dateTo: "2026-07-15",
    paidOrders: [
      { paidAt: "2026-07-13T18:00:00.000Z", totalCents: 50_000, discountCents: 5_000 },
      { paidAt: "2026-07-15T18:00:00.000Z", totalCents: 10_000, discountCents: 1_000 },
    ],
    completedPostSaleDocuments: [
      {
        createdAt: "2026-07-15T19:00:00.000Z",
        documentType: "sale_cancellation",
        netAmountCents: 2_000,
      },
      {
        createdAt: "2026-07-15T20:00:00.000Z",
        documentType: "return_partial",
        netAmountCents: 1_500,
      },
    ],
  });

  assert.equal(trend.points[0]?.discountsCents, 5_000);
  assert.equal(trend.points[2]?.discountsCents, 1_000);
  assert.equal(trend.points[2]?.saleCancellationsCents, 2_000);
  assert.equal(trend.points[2]?.returnsCents, 1_500);
});

test("la suma de buckets coincide con KPIs monetarios de ventas", () => {
  const activity = buildRetailSalesActivityTrend({
    dateFrom: "2026-07-13",
    dateTo: "2026-07-15",
    paidOrders: [
      { paidAt: "2026-07-13T18:00:00.000Z", totalCents: 50_000, discountCents: 5_000 },
      { paidAt: "2026-07-15T18:00:00.000Z", totalCents: 10_000, discountCents: 1_000 },
    ],
  });
  const adjustments = buildRetailSalesAdjustmentsTrend({
    dateFrom: "2026-07-13",
    dateTo: "2026-07-15",
    paidOrders: [
      { paidAt: "2026-07-13T18:00:00.000Z", totalCents: 50_000, discountCents: 5_000 },
      { paidAt: "2026-07-15T18:00:00.000Z", totalCents: 10_000, discountCents: 1_000 },
    ],
    completedPostSaleDocuments: [
      {
        createdAt: "2026-07-15T19:00:00.000Z",
        documentType: "sale_cancellation",
        netAmountCents: 2_000,
      },
      {
        createdAt: "2026-07-15T20:00:00.000Z",
        documentType: "return_partial",
        netAmountCents: 1_500,
      },
    ],
  });

  assert.equal(
    activity.points.reduce((sum, point) => sum + point.collectedSalesCents, 0),
    60_000,
  );
  assert.equal(
    adjustments.points.reduce((sum, point) => sum + point.discountsCents, 0),
    6_000,
  );
  assert.equal(
    adjustments.points.reduce((sum, point) => sum + point.saleCancellationsCents, 0),
    2_000,
  );
  assert.equal(
    adjustments.points.reduce((sum, point) => sum + point.returnsCents, 0),
    1_500,
  );
});

test("agrega postventa por tipo con conteos y montos por bucket", () => {
  const trend = buildRetailPostSaleTrend({
    dateFrom: "2026-07-13",
    dateTo: "2026-07-15",
    completedPostSaleDocuments: [
      {
        createdAt: "2026-07-13T18:00:00.000Z",
        documentType: "sale_cancellation",
        netAmountCents: 20_000,
      },
      {
        createdAt: "2026-07-15T18:00:00.000Z",
        documentType: "return_full",
        netAmountCents: 5_000,
      },
      {
        createdAt: "2026-07-15T19:00:00.000Z",
        documentType: "return_partial",
        netAmountCents: 1_500,
      },
    ],
  });

  assert.equal(trend.granularity, "day");
  assert.equal(trend.points[0]?.saleCancellationsCount, 1);
  assert.equal(trend.points[0]?.saleCancellationsCents, 20_000);
  assert.equal(trend.points[2]?.fullReturnsCount, 1);
  assert.equal(trend.points[2]?.fullReturnsCents, 5_000);
  assert.equal(trend.points[2]?.partialReturnsCount, 1);
  assert.equal(trend.points[2]?.partialReturnsCents, 1_500);
});

test("la suma de buckets de postventa coincide con los KPIs del rango", () => {
  const trend = buildRetailPostSaleTrend({
    dateFrom: "2026-07-01",
    dateTo: "2026-08-15",
    completedPostSaleDocuments: [
      {
        createdAt: "2026-07-02T18:00:00.000Z",
        documentType: "sale_cancellation",
        netAmountCents: 30_000,
      },
      {
        createdAt: "2026-07-10T18:00:00.000Z",
        documentType: "return_full",
        netAmountCents: 20_000,
      },
      {
        createdAt: "2026-07-10T19:00:00.000Z",
        documentType: "return_partial",
        netAmountCents: 5_000,
      },
    ],
  });

  assert.equal(trend.granularity, "week");
  assert.equal(
    trend.points.reduce((sum, point) => sum + point.saleCancellationsCount, 0),
    1,
  );
  assert.equal(
    trend.points.reduce((sum, point) => sum + point.fullReturnsCount, 0),
    1,
  );
  assert.equal(
    trend.points.reduce((sum, point) => sum + point.partialReturnsCount, 0),
    1,
  );
  assert.equal(
    trend.points.reduce((sum, point) => sum + point.saleCancellationsCents, 0),
    30_000,
  );
  assert.equal(
    trend.points.reduce((sum, point) => sum + point.fullReturnsCents, 0),
    20_000,
  );
  assert.equal(
    trend.points.reduce((sum, point) => sum + point.partialReturnsCents, 0),
    5_000,
  );
});
