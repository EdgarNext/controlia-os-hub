import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildRetailCommercialWaterfall,
  buildRetailOverviewAttentionSignals,
  buildRetailPaymentMix,
  buildRetailPostSaleTrend,
  buildRetailSalesActivityTrend,
  buildRetailSalesAdjustmentsTrend,
  buildRetailSalesTrend,
  type RetailCommercialWaterfallDatum,
  type RetailOverviewAttentionSignal,
  type RetailPaymentMixDatum,
  type RetailPostSaleTrendPoint,
  type RetailSalesActivityTrendPoint,
  type RetailSalesAdjustmentsTrendPoint,
  type RetailSalesTrendGranularity,
  type RetailSalesTrendPoint,
} from "./reporting-overview";
import type {
  RetailPosDeviceRole,
  RetailPosPostSaleDocumentStatus,
  RetailPosPostSaleReasonCode,
  RetailPosPostSaleRefundMethod,
  RetailPosPostSaleRefundStatus,
  RetailPosZReportV1,
} from "@/shared/types/retail-pos";
import {
  buildRetailCommercialCoverage,
  calculatePriceTierEconomics,
  classifyPriceTier,
  classifyPriceTierDecision,
  type PriceTier,
  type PriceTierClassification,
} from "./price-tier-economics";

type RetailReportsFiltersInput = {
  dateFrom?: string | null;
  dateTo?: string | null;
  deviceId?: string | null;
  orderStatus?: "all" | "pending_payment" | "paid" | "voided" | null;
  priceTier?: "all" | "public" | "wholesale" | "mixed" | "unknown" | null;
};

type RetailPostSaleReportFiltersInput = {
  dateFrom?: string | null;
  dateTo?: string | null;
  operationType?: "all" | "sale_cancellation" | "return_full" | "return_partial" | null;
  refundStatus?:
    | "all"
    | "not_required"
    | "pending"
    | "completed"
    | "failed"
    | "cancelled"
    | null;
  refundMethod?: "all" | "cash" | "card_external" | "store_credit_future" | null;
  reasonCode?: string | null;
  responsibleUserId?: string | null;
};

type RetailReportsFilters = {
  dateFrom: string;
  dateTo: string;
  deviceId: string | null;
  orderStatus: "all" | "pending_payment" | "paid" | "voided";
  priceTier: "all" | "public" | "wholesale" | "mixed" | "unknown";
};

export type RetailPostSaleReportFilters = {
  dateFrom: string;
  dateTo: string;
  operationType: "all" | "sale_cancellation" | "return_full" | "return_partial";
  refundStatus: "all" | RetailPosPostSaleRefundStatus;
  refundMethod: "all" | RetailPosPostSaleRefundMethod;
  reasonCode: string | null;
  responsibleUserId: string | null;
};

type RetailDeviceOption = {
  id: string;
  name: string;
  role: RetailPosDeviceRole;
  kioskNumber: number | null;
  kioskName: string | null;
};

type RetailOrderRow = {
  id: string;
  tenant_id: string;
  folio: string;
  origin_local_folio: string | null;
  status: "pending_payment" | "paid" | "voided";
  origin_device_id: string;
  created_by_pos_user_id: string;
  cashier_pos_user_id: string | null;
  paid_by_device_id: string | null;
  subtotal_cents: number;
  discount_cents: number;
  direct_discount_cents: number | null;
  order_discount_cents: number | null;
  total_cents: number;
  paid_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
};

type RetailOrderLineRow = {
  id: string;
  order_id: string;
  line_number: number;
  product_id: string;
  product_variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  sales_unit_label: string;
  quantity: string | number;
  unit_price_cents: number;
  line_subtotal_cents: number;
  total_discount_cents: number | null;
  line_total_cents: number;
  below_cost_after_discount: boolean | null;
  public_unit_price_snapshot_cents: number | null;
  wholesale_unit_price_snapshot_cents: number | null;
  requested_price_tier: PriceTier | null;
  price_tier_request_status: "not_requested" | "pending" | "approved" | "rejected" | null;
  requested_by_pos_user_id: string | null;
  requested_at: string | null;
  approved_price_tier: PriceTier | null;
  approved_unit_price_cents: number | null;
  approved_by_pos_user_id: string | null;
  approved_at: string | null;
  direct_discount_cents: number | null;
  order_discount_allocation_cents: number | null;
  unit_cost_snapshot_cents: number | null;
};

type RetailOriginalOrderLookupRow = Pick<RetailOrderRow, "id" | "folio">;

type RetailDiscountRow = {
  order_id: string;
  scope: "line" | "order";
  order_line_id: string | null;
  effective_discount_cents: number;
  reason_code: string;
  applied_by_pos_user_id: string | null;
  applied_at: string;
};

type RetailPaymentRow = {
  id: string;
  order_id: string;
  cash_shift_id: string;
  device_id: string;
  pos_user_id: string;
  payment_method: "cash" | "card";
  amount_cents: number;
  received_amount_cents: number | null;
  change_cents: number;
  paid_at: string;
};

type RetailCashShiftRow = {
  id: string;
  device_id: string;
  opened_by_pos_user_id: string;
  closed_by_pos_user_id: string | null;
  status: "open" | "closed" | "canceled";
  opening_float_cents: number;
  expected_cash_cents: number | null;
  declared_cash_cents: number | null;
  difference_cents: number | null;
  opened_at: string;
  closed_at: string | null;
  closing_note: string | null;
};

type RetailTicketEventRow = {
  order_id: string;
  ticket_type: "order" | "payment" | "post_sale";
  event_type: "printed" | "reprinted" | "print_failed";
  created_at: string;
};

type RetailPostSaleDocumentRow = {
  id: string;
  original_order_id: string;
  original_payment_id: string;
  cash_shift_id: string | null;
  document_type: "sale_cancellation" | "return_full" | "return_partial";
  status: RetailPosPostSaleDocumentStatus;
  refund_status: RetailPosPostSaleRefundStatus;
  refund_method: RetailPosPostSaleRefundMethod;
  gross_amount_cents: number;
  discount_amount_cents: number;
  net_amount_cents: number;
  refund_amount_cents: number;
  reason_code: RetailPosPostSaleReasonCode;
  comment: string | null;
  created_by_pos_user_id: string | null;
  created_at: string;
  confirmed_at: string | null;
};

type RetailPostSaleRefundRow = {
  id: string;
  post_sale_document_id: string;
  cash_shift_id: string | null;
  refund_method: RetailPosPostSaleRefundMethod;
  status: RetailPosPostSaleRefundStatus;
  amount_cents: number;
  external_reference: string | null;
  processed_at: string | null;
  created_at: string;
};

type RetailPostSaleLineRow = {
  id: string;
  post_sale_document_id: string;
  original_order_line_id: string;
  line_number: number;
  quantity_returned_now: string | number;
  returned_gross_amount_cents: number;
  returned_total_discount_cents: number;
  returned_net_amount_cents: number;
};

type PosUserRow = {
  id: string;
  name: string | null;
};

type DeviceRow = {
  id: string;
  name: string;
  status: string;
  kiosk_id: string;
  kiosks: { number: number; name: string | null } | null;
};

type DeviceSettingsRow = {
  device_id: string;
  device_role: RetailPosDeviceRole;
};

type TenantRow = {
  id: string;
  name: string;
};

function formatKioskLabel(device: DeviceRow | undefined): string | null {
  if (!device?.kiosks) {
    return null;
  }

  return `${device.kiosks.name ?? `Kiosko ${device.kiosks.number}`} · #${device.kiosks.number}`;
}

export type RetailReportsPageFilters = RetailReportsFilters;

export type RetailReportsOverview = {
  businessDateLabel: string;
  dateRangeLabel: string;
  filters: RetailReportsFilters;
  devices: RetailDeviceOption[];
  summary: {
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    cancelledOrders: number;
    voidedOrdersCount: number;
    cancelledPaidOrders: number;
    grossSalesCents: number;
    lineDiscountsCents: number;
    orderDiscountsCents: number;
    discountsCents: number;
    netSalesCents: number;
    netAfterCancellationsCents: number;
    netCommercialCents: number;
    commercialNetCents: number;
    voidedSalesCount: number;
    voidedSalesCents: number;
    cancelledSalesCount: number;
    cancelledSalesCents: number;
    commercialNetAfterPostSaleCents: number;
    cashCents: number;
    cardCents: number;
    cashRefundsCents: number;
    cardRefundsCents: number;
    cashRefundsCompletedCents: number;
    cardRefundsCompletedCents: number;
    cardRefundsPendingCents: number;
    pendingRefundCents: number;
    pendingRefundsCount: number;
    cancellationAmountCents: number;
    returnAmountCents: number;
    returnedCents: number;
    totalReturnDocumentsCount: number;
    partialReturnDocumentsCount: number;
    fullReturnDocumentsCount: number;
    fullReturnsCount: number;
    partialReturnsCount: number;
    averageTicketCents: number;
    soldLinesCount: number;
    soldUnits: number;
    openShiftsCount: number;
    wholesaleSalesCount: number;
    wholesaleBaseCents: number;
    wholesaleDifferenceCents: number;
    wholesaleManualDiscountCents: number;
    priceComposition: Array<{ tier: PriceTierClassification; baseCents: number | null }>;
    commercialMetrics: {
      grossSalesCents: number;
      discountAdditionalCents: number;
      netSalesCents: number;
      netSalesWithCostCents: number;
      grossMarginCents: number;
      marginPercentBps: number | null;
      belowCostLinesCount: number;
      belowCostSalesCents: number;
      belowCostMarginCents: number;
    };
    priceTierCoverage: {
      publicLines: number;
      wholesaleLines: number;
      unknownLines: number;
      publicNetSalesCents: number;
      wholesaleNetSalesCents: number;
      unknownNetSalesCents: number;
    };
    costCoverage: {
      totalLines: number;
      linesWithCost: number;
      linesWithoutCost: number;
      netSalesWithCostCents: number;
      netSalesWithoutCostCents: number;
      costCoverageByLinesBps: number | null;
      costCoverageByAmountBps: number | null;
    };
    decisionCounts: Array<{ key: "requested_approved" | "requested_rejected" | "cashier_direct"; count: number }>;
    anomalies: Array<{ type: string; orderId: string; folio: string }>;
  };
  discountBreakdown: {
    byReason: Array<{
      reasonCode: string;
      discountsCount: number;
      totalDiscountCents: number;
    }>;
    byCashier: Array<{
      posUserId: string | null;
      posUserName: string | null;
      discountsCount: number;
      totalDiscountCents: number;
    }>;
    belowCostOrdersCount: number;
    belowCostLinesCount: number;
    belowCostNetSalesCents: number;
  };
  paymentMethods: Array<{
    method: "cash" | "card";
    paymentsCount: number;
    totalCents: number;
  }>;
  paymentMix: RetailPaymentMixDatum[];
  commercialWaterfall: RetailCommercialWaterfallDatum[];
  salesTrend: {
    granularity: RetailSalesTrendGranularity;
    points: RetailSalesTrendPoint[];
  };
  attention: RetailOverviewAttentionSignal[];
  audit: {
    printedCount: number;
    reprintedCount: number;
    failedPrintCount: number;
    paymentPrintedCount: number;
    paymentReprintedCount: number;
    orderPrintedCount: number;
    orderReprintedCount: number;
    postSalePrintedCount: number;
    postSaleReprintedCount: number;
    note: string;
  };
  recentOrders: Array<{
    orderId: string;
    folio: string;
    localFolio: string | null;
    status: "pending_payment" | "paid" | "voided";
    postSaleStatus: "none" | "sale_cancellation" | "return_full" | "return_partial";
    postSaleLabel: string | null;
    cancelledSalesCents: number;
    returnedCents: number;
    lastPostSaleAt: string | null;
    totalCents: number;
    grossSalesCents: number;
    paymentMethod: "cash" | "card" | null;
    originDeviceName: string | null;
    originKioskLabel: string | null;
    paidDeviceName: string | null;
    paidKioskLabel: string | null;
    createdAt: string;
    paidAt: string | null;
    relevantAt: string | null;
    voidedAtOrder: string | null;
    cancelReason: string | null;
    discountCents: number;
    hasBelowCostLine: boolean;
    priceTier: "public" | "wholesale" | "mixed" | "unknown";
    wholesaleDifferenceCents: number;
    historicalBaseCents: number | null;
    additionalDiscountCents: number | null;
    historicalCostCents: number | null;
    grossMarginCents: number | null;
    costCoverageLines: number;
    costCoverageTotalLines: number;
  }>;
};

export type RetailCashShiftReportRow = {
  cashShiftId: string;
  deviceName: string | null;
  kioskLabel: string | null;
  openedByName: string | null;
  closedByName: string | null;
  openedAt: string;
  closedAt: string | null;
  status: "open" | "closed" | "canceled";
  openingFloatCents: number;
  grossSalesCents: number;
  discountsCents: number;
  cancellationsCount: number;
  cancellationAmountCents: number;
  fullReturnsCount: number;
  partialReturnsCount: number;
  returnsCount: number;
  returnAmountCents: number;
  expectedCashCents: number | null;
  declaredCashCents: number | null;
  differenceCents: number | null;
  cashSalesCents: number;
  cardSalesCents: number;
  cashCancellationRefundsCents: number;
  cashReturnRefundsCents: number;
  cashRefundsCount: number;
  cashRefundsCents: number;
  cardRefundsCompletedCount: number;
  cardRefundsCompletedCents: number;
  cardRefundsPendingCount: number;
  cardRefundsPendingCents: number;
  cardRefundsCents: number;
  totalSalesCents: number;
  paymentsCount: number;
  ordersCount: number;
  closingNote: string | null;
};

export type RetailCashShiftReport = {
  filters: RetailReportsFilters;
  devices: RetailDeviceOption[];
  rows: RetailCashShiftReportRow[];
  openRows: RetailCashShiftReportRow[];
  closedRows: RetailCashShiftReportRow[];
  refundBreakdown: Array<{
    key: "cash_completed" | "card_completed" | "card_pending";
    label: string;
    refundsCount: number;
    amountCents: number;
    tone: "default" | "warning";
  }>;
  totals: {
    shiftsCount: number;
    openShiftsCount: number;
    closedShiftsCount: number;
    totalGrossSalesCents: number;
    totalDiscountsCents: number;
    totalCancellationAmountCents: number;
    totalReturnAmountCents: number;
    totalExpectedCashCents: number;
    totalDeclaredCashCents: number;
    totalDifferenceCents: number;
    totalCashSalesCents: number;
    totalCardSalesCents: number;
    totalCashCancellationRefundsCents: number;
    totalCashReturnRefundsCents: number;
    totalCashRefundsCents: number;
    totalCardRefundsCompletedCents: number;
    totalCardRefundsPendingCents: number;
    totalCardRefundsCents: number;
    totalSalesCents: number;
    closedDeclaredCashCents: number;
    closedExpectedCashCents: number;
    closedDifferenceCents: number;
    closedMissingDeclaredCount: number;
    closedWithDifferenceCount: number;
    completedCashRefundsCount: number;
    completedCardRefundsCount: number;
    pendingCardRefundsCount: number;
  };
};

export type RetailPostSaleReport = {
  filters: RetailPostSaleReportFilters;
  reasonOptions: Array<{
    reasonCode: string;
    operationsCount: number;
    totalAmountCents: number;
  }>;
  responsibleUsers: Array<{
    posUserId: string;
    posUserName: string;
  }>;
  summary: {
    cancelledSalesCount: number;
    cancelledSalesCents: number;
    fullReturnsCount: number;
    fullReturnsCents: number;
    partialReturnsCount: number;
    partialReturnsCents: number;
    returnsCount: number;
    returnedCents: number;
    revertedAmountCents: number;
    completedCashRefundsCount: number;
    cashRefundsCompletedCents: number;
    completedCardRefundsCount: number;
    cardRefundsCompletedCents: number;
    completedRefundsCount: number;
    completedRefundsCents: number;
    pendingRefundsCount: number;
    cardRefundsPendingCents: number;
    pendingRefundCents: number;
    failedRefundsCount: number;
    failedRefundCents: number;
  };
  refundBreakdown: Array<{
    key: "cash_completed" | "card_completed" | "card_pending" | "failed";
    label: string;
    refundStatus: RetailPosPostSaleRefundStatus;
    refundMethod: RetailPosPostSaleRefundMethod | null;
    refundsCount: number;
    amountCents: number;
  }>;
  refundStatusBreakdown: Array<{
    key: "completed" | "pending" | "failed";
    label: string;
    refundStatus: "completed" | "pending" | "failed";
    refundsCount: number;
    amountCents: number;
    share: number | null;
  }>;
  trend: {
    granularity: RetailSalesTrendGranularity;
    points: RetailPostSaleTrendPoint[];
  };
  byReason: Array<{
    reasonCode: string;
    operationsCount: number;
    totalAmountCents: number;
  }>;
  byResponsibleUser: Array<{
    posUserId: string | null;
    posUserName: string | null;
    cancelledSalesCount: number;
    returnsCount: number;
    operationsCount: number;
    totalAmountCents: number;
  }>;
  rows: Array<{
    documentId: string;
    registeredAt: string;
    confirmedAt: string | null;
    processedAt: string | null;
    operationType: "sale_cancellation" | "return_full" | "return_partial";
    operationLabel: string;
    originalOrderId: string;
    originalFolio: string;
    responsibleUserName: string | null;
    responsibleUserId: string | null;
    reasonCode: string;
    comment: string | null;
    commercialAmountCents: number;
    refundAmountCents: number | null;
    refundMethod: RetailPosPostSaleRefundMethod | null;
    refundStatus: RetailPosPostSaleRefundStatus | null;
    externalReference: string | null;
    cashShiftId: string | null;
    lineCount: number;
    quantityReturned: number;
  }>;
};

export type RetailSalesReport = {
  filters: RetailReportsFilters;
  devices: RetailDeviceOption[];
  summary: RetailReportsOverview["summary"];
  discountBreakdown: RetailReportsOverview["discountBreakdown"];
  orders: RetailReportsOverview["recentOrders"];
  activityTrend: {
    granularity: RetailSalesTrendGranularity;
    points: RetailSalesActivityTrendPoint[];
  };
  adjustmentsTrend: {
    granularity: RetailSalesTrendGranularity;
    points: RetailSalesAdjustmentsTrendPoint[];
  };
  discountInsights: {
    discountedOrdersCount: number;
    discountedOrdersShare: number | null;
    belowCostOrdersCount: number;
    belowCostLinesCount: number;
  };
};

export type RetailProductsReport = {
  filters: RetailReportsFilters;
  devices: RetailDeviceOption[];
  rows: Array<{
    productKey: string;
    productName: string;
    variantName: string | null;
    sku: string | null;
    unitLabel: string;
    quantitySold: number;
    totalSoldCents: number;
    ordersCount: number;
    averageUnitPriceCents: number;
  }>;
  totals: {
    distinctProducts: number;
    quantitySold: number;
    totalSoldCents: number;
  };
};

type RetailPosZReportPaymentRow = RetailPaymentRow;

type RetailPosZReportOrderRow = RetailOrderRow;

type RetailPosZReportOrderLineRow = {
  order_id: string;
  quantity: string | number;
};

type RetailPosZReportShiftRow = RetailCashShiftRow & {
  tenant_id: string;
};

function getMexicoCityToday() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

function normalizeDateOnly(value: string | null | undefined, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : fallback;
}

function normalizeDeviceId(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeOrderStatus(
  value: string | null | undefined,
): "all" | "pending_payment" | "paid" | "voided" {
  if (value === "pending_payment" || value === "paid" || value === "voided") {
    return value;
  }

  return "all";
}

function normalizePriceTier(value: string | null | undefined): RetailReportsFilters["priceTier"] {
  return value === "public" || value === "wholesale" || value === "mixed" || value === "unknown"
    ? value
    : "all";
}

function normalizePostSaleOperationType(
  value: string | null | undefined,
): "all" | "sale_cancellation" | "return_full" | "return_partial" {
  if (value === "sale_cancellation" || value === "return_full" || value === "return_partial") {
    return value;
  }

  return "all";
}

function normalizePostSaleRefundStatus(
  value: string | null | undefined,
): "all" | RetailPosPostSaleRefundStatus {
  if (
    value === "not_required" ||
    value === "pending" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "all";
}

function normalizePostSaleRefundMethod(
  value: string | null | undefined,
): "all" | RetailPosPostSaleRefundMethod {
  if (value === "cash" || value === "card_external" || value === "store_credit_future") {
    return value;
  }

  return "all";
}

function buildPostSaleFilters(input?: RetailPostSaleReportFiltersInput): RetailPostSaleReportFilters {
  const today = getMexicoCityToday();
  const dateFrom = normalizeDateOnly(input?.dateFrom, today);
  const rawDateTo = normalizeDateOnly(input?.dateTo, dateFrom);
  const dateTo = rawDateTo < dateFrom ? dateFrom : rawDateTo;
  const reasonCode =
    typeof input?.reasonCode === "string" && input.reasonCode.trim() && input.reasonCode !== "all"
      ? input.reasonCode.trim()
      : null;
  const responsibleUserId =
    typeof input?.responsibleUserId === "string" &&
    input.responsibleUserId.trim() &&
    input.responsibleUserId !== "all"
      ? input.responsibleUserId.trim()
      : null;

  return {
    dateFrom,
    dateTo,
    operationType: normalizePostSaleOperationType(input?.operationType),
    refundStatus: normalizePostSaleRefundStatus(input?.refundStatus),
    refundMethod: normalizePostSaleRefundMethod(input?.refundMethod),
    reasonCode,
    responsibleUserId,
  };
}

function isVoidedOrder(order: Pick<RetailOrderRow, "status">) {
  return order.status === "voided";
}

function getOrderVoidTimestamp(order: Pick<RetailOrderRow, "voided_at" | "cancelled_at">) {
  return order.voided_at ?? order.cancelled_at;
}

function getOrderVoidReason(order: Pick<RetailOrderRow, "void_reason" | "cancel_reason">) {
  return order.void_reason ?? order.cancel_reason;
}

function isSaleCancellationDocument(
  document: Pick<RetailPostSaleDocumentRow, "document_type" | "status"> | null | undefined,
) {
  return Boolean(
    document &&
      document.document_type === "sale_cancellation" &&
      document.status === "completed",
  );
}

function getCanonicalPostSaleDocumentType(
  documentType: RetailPostSaleDocumentRow["document_type"],
): "sale_cancellation" | "return_full" | "return_partial" | null {
  if (documentType === "sale_cancellation") {
    return "sale_cancellation";
  }

  if (documentType === "return_full" || documentType === "return_partial") {
    return documentType;
  }

  return null;
}

function getPostSaleOperationLabel(
  documentType: RetailPostSaleDocumentRow["document_type"],
): string {
  const canonicalType = getCanonicalPostSaleDocumentType(documentType);
  if (canonicalType === "sale_cancellation") {
    return "Venta cancelada";
  }
  if (canonicalType === "return_full") {
    return "Devolución total";
  }
  return "Devolución parcial";
}

function buildFilters(input?: RetailReportsFiltersInput): RetailReportsFilters {
  const today = getMexicoCityToday();
  const dateFrom = normalizeDateOnly(input?.dateFrom, today);
  const rawDateTo = normalizeDateOnly(input?.dateTo, dateFrom);
  const dateTo = rawDateTo < dateFrom ? dateFrom : rawDateTo;

  return {
    dateFrom,
    dateTo,
    deviceId: normalizeDeviceId(input?.deviceId),
    orderStatus: normalizeOrderStatus(input?.orderStatus),
    priceTier: normalizePriceTier(input?.priceTier),
  };
}

function parseQuantity(value: string | number) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function linesByOrderIdForBuild(lines: RetailOrderLineRow[], orderId: string) {
  return lines.filter((line) => line.order_id === orderId);
}

function parseTimeZoneOffsetMinutes(value: string) {
  if (value === "GMT" || value === "UTC") {
    return 0;
  }

  const match = value.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return 0;
  }

  const [, sign, hoursText, minutesText] = match;
  const totalMinutes = Number.parseInt(hoursText, 10) * 60 + Number.parseInt(minutesText ?? "0", 10);
  return sign === "-" ? -totalMinutes : totalMinutes;
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
  });
  const offsetPart = formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value;

  return parseTimeZoneOffsetMinutes(offsetPart ?? "UTC");
}

function getMexicoCityDayBoundaryIso(dateOnly: string, dayOffset: number) {
  const [year, month, day] = dateOnly.split("-").map((value) => Number.parseInt(value, 10));
  const utcGuess = new Date(Date.UTC(year, month - 1, day + dayOffset, 0, 0, 0, 0));
  let utcDate = utcGuess;

  for (let iteration = 0; iteration < 2; iteration += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(utcDate, "America/Mexico_City");
    utcDate = new Date(utcGuess.getTime() - offsetMinutes * 60_000);
  }

  return utcDate.toISOString();
}

function startOfDayIso(dateOnly: string) {
  return getMexicoCityDayBoundaryIso(dateOnly, 0);
}

function endExclusiveIso(dateOnly: string) {
  return getMexicoCityDayBoundaryIso(dateOnly, 1);
}

function isWithinRange(value: string | null, startIso: string, endIso: string) {
  if (!value) {
    return false;
  }

  return value >= startIso && value < endIso;
}

function formatDateRangeLabel(filters: RetailReportsFilters) {
  if (filters.dateFrom === filters.dateTo) {
    return filters.dateFrom;
  }

  return `${filters.dateFrom} -> ${filters.dateTo}`;
}

function getBusinessDateLabel(filters: RetailReportsFilters) {
  return filters.dateFrom === filters.dateTo ? filters.dateFrom : formatDateRangeLabel(filters);
}

function buildPaymentMethodSummary(payments: RetailPaymentRow[]) {
  const cash = payments.filter((payment) => payment.payment_method === "cash");
  const card = payments.filter((payment) => payment.payment_method === "card");

  return [
    {
      method: "cash" as const,
      paymentsCount: cash.length,
      totalCents: cash.reduce((sum, payment) => sum + payment.amount_cents, 0),
    },
    {
      method: "card" as const,
      paymentsCount: card.length,
      totalCents: card.reduce((sum, payment) => sum + payment.amount_cents, 0),
    },
  ];
}

function buildAudit(ticketEvents: RetailTicketEventRow[]) {
  const printedCount = ticketEvents.filter((event) => event.event_type === "printed").length;
  const reprintedCount = ticketEvents.filter((event) => event.event_type === "reprinted").length;
  const failedPrintCount = ticketEvents.filter((event) => event.event_type === "print_failed").length;
  const paymentPrintedCount = ticketEvents.filter(
    (event) => event.ticket_type === "payment" && event.event_type === "printed",
  ).length;
  const paymentReprintedCount = ticketEvents.filter(
    (event) => event.ticket_type === "payment" && event.event_type === "reprinted",
  ).length;
  const orderPrintedCount = ticketEvents.filter(
    (event) => event.ticket_type === "order" && event.event_type === "printed",
  ).length;
  const orderReprintedCount = ticketEvents.filter(
    (event) => event.ticket_type === "order" && event.event_type === "reprinted",
  ).length;
  const postSalePrintedCount = ticketEvents.filter(
    (event) => event.ticket_type === "post_sale" && event.event_type === "printed",
  ).length;
  const postSaleReprintedCount = ticketEvents.filter(
    (event) => event.ticket_type === "post_sale" && event.event_type === "reprinted",
  ).length;

  return {
    printedCount,
    reprintedCount,
    failedPrintCount,
    paymentPrintedCount,
    paymentReprintedCount,
    orderPrintedCount,
    orderReprintedCount,
    postSalePrintedCount,
    postSaleReprintedCount,
    note:
      ticketEvents.length === 0
        ? "La evidencia de impresion aun no ha sido validada en terminal real."
        : "Las metricas de impresion se muestran solo con evidencia registrada en retail_pos_ticket_events.",
  };
}

function getOrderActivityTimestamp(order: RetailOrderRow) {
  return order.paid_at ?? order.voided_at ?? order.cancelled_at ?? order.created_at;
}

async function loadBaseRetailReportData(tenantId: string, filtersInput?: RetailReportsFiltersInput) {
  const filters = buildFilters(filtersInput);
  const startIso = startOfDayIso(filters.dateFrom);
  const endIso = endExclusiveIso(filters.dateTo);
  const supabase = getSupabaseAdminClient();

  const [
    devicesResult,
    settingsResult,
    usersResult,
    createdOrdersResult,
    paidOrdersResult,
    cancelledOrdersResult,
    paymentsResult,
    shiftsResult,
    ticketEventsResult,
    postSaleDocumentsResult,
    postSaleRefundsResult,
  ] =
    await Promise.all([
      supabase
        .from("pos_devices")
        .select("id, name, status, kiosk_id, kiosks!pos_devices_kiosk_id_fkey(number, name)")
        .eq("tenant_id", tenantId)
        .returns<DeviceRow[]>(),
      supabase
        .from("retail_pos_device_settings")
        .select("device_id, device_role")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .returns<DeviceSettingsRow[]>(),
      supabase.from("pos_users").select("id, name").eq("tenant_id", tenantId).returns<PosUserRow[]>(),
      supabase
        .from("retail_pos_orders")
        .select(
          "id, tenant_id, folio, origin_local_folio, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, direct_discount_cents, order_discount_cents, total_cents, paid_at, voided_at, void_reason, cancelled_at, cancel_reason, created_at",
        )
        .eq("tenant_id", tenantId)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: false })
        .returns<RetailOrderRow[]>(),
      supabase
        .from("retail_pos_orders")
        .select(
          "id, tenant_id, folio, origin_local_folio, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, direct_discount_cents, order_discount_cents, total_cents, paid_at, voided_at, void_reason, cancelled_at, cancel_reason, created_at",
        )
        .eq("tenant_id", tenantId)
        .not("paid_at", "is", null)
        .gte("paid_at", startIso)
        .lt("paid_at", endIso)
        .order("paid_at", { ascending: false })
        .returns<RetailOrderRow[]>(),
      supabase
        .from("retail_pos_orders")
        .select(
          "id, tenant_id, folio, origin_local_folio, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, direct_discount_cents, order_discount_cents, total_cents, paid_at, voided_at, void_reason, cancelled_at, cancel_reason, created_at",
        )
        .eq("tenant_id", tenantId)
        .or("voided_at.not.is.null,cancelled_at.not.is.null")
        .order("created_at", { ascending: false })
        .returns<RetailOrderRow[]>(),
      supabase
        .from("retail_pos_payments")
        .select(
          "id, order_id, cash_shift_id, device_id, pos_user_id, payment_method, amount_cents, received_amount_cents, change_cents, paid_at",
        )
        .eq("tenant_id", tenantId)
        .gte("paid_at", startIso)
        .lt("paid_at", endIso)
        .order("paid_at", { ascending: false })
        .returns<RetailPaymentRow[]>(),
      supabase
        .from("retail_pos_cash_shifts")
        .select(
          "id, device_id, opened_by_pos_user_id, closed_by_pos_user_id, status, opening_float_cents, expected_cash_cents, declared_cash_cents, difference_cents, opened_at, closed_at, closing_note",
        )
        .eq("tenant_id", tenantId)
        .order("opened_at", { ascending: false })
        .returns<RetailCashShiftRow[]>(),
      supabase
        .from("retail_pos_ticket_events")
        .select("order_id, ticket_type, event_type, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .returns<RetailTicketEventRow[]>(),
      supabase
        .from("retail_pos_post_sale_documents")
        .select(
          "id, original_order_id, original_payment_id, document_type, cash_shift_id, status, refund_status, refund_method, gross_amount_cents, discount_amount_cents, net_amount_cents, refund_amount_cents, reason_code, comment, created_by_pos_user_id, created_at, confirmed_at",
        )
        .eq("tenant_id", tenantId)
        .in("document_type", ["sale_cancellation", "return_full", "return_partial"])
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .returns<RetailPostSaleDocumentRow[]>(),
      supabase
        .from("retail_pos_post_sale_refunds")
        .select(
          "id, post_sale_document_id, cash_shift_id, refund_method, status, amount_cents, external_reference, processed_at, created_at",
        )
        .eq("tenant_id", tenantId)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .returns<RetailPostSaleRefundRow[]>(),
    ]);

  if (devicesResult.error) {
    throw new Error(`Unable to load retail devices: ${devicesResult.error.message}`);
  }
  if (settingsResult.error) {
    throw new Error(`Unable to load retail device settings: ${settingsResult.error.message}`);
  }
  if (usersResult.error) {
    throw new Error(`Unable to load retail POS users: ${usersResult.error.message}`);
  }
  if (createdOrdersResult.error) {
    throw new Error(`Unable to load retail created orders report: ${createdOrdersResult.error.message}`);
  }
  if (paidOrdersResult.error) {
    throw new Error(`Unable to load retail paid orders report: ${paidOrdersResult.error.message}`);
  }
  if (cancelledOrdersResult.error) {
    throw new Error(
      `Unable to load retail cancelled orders report: ${cancelledOrdersResult.error.message}`,
    );
  }
  if (paymentsResult.error) {
    throw new Error(`Unable to load retail payments report: ${paymentsResult.error.message}`);
  }
  if (shiftsResult.error) {
    throw new Error(`Unable to load retail cash shifts report: ${shiftsResult.error.message}`);
  }
  if (ticketEventsResult.error) {
    throw new Error(`Unable to load retail ticket events report: ${ticketEventsResult.error.message}`);
  }
  if (postSaleDocumentsResult.error) {
    throw new Error(`Unable to load retail post sale documents report: ${postSaleDocumentsResult.error.message}`);
  }
  if (postSaleRefundsResult.error) {
    throw new Error(`Unable to load retail post sale refunds report: ${postSaleRefundsResult.error.message}`);
  }

  const deviceById = new Map((devicesResult.data ?? []).map((row) => [row.id, row]));
  const settingsByDeviceId = new Map((settingsResult.data ?? []).map((row) => [row.device_id, row]));
  const userById = new Map((usersResult.data ?? []).map((row) => [row.id, row]));
  const allOrders = new Map<string, RetailOrderRow>();
  const paymentsByOrderId = new Map<string, RetailPaymentRow[]>();
  const paymentsByShiftId = new Map<string, RetailPaymentRow[]>();
  const postSaleDocumentByOrderId = new Map<string, RetailPostSaleDocumentRow>();
  const postSaleRefundByDocumentId = new Map<string, RetailPostSaleRefundRow>();
  const cancelledOrders = (cancelledOrdersResult.data ?? []).filter((order) =>
    isWithinRange(getOrderVoidTimestamp(order), startIso, endIso),
  );

  for (const order of [
    ...(createdOrdersResult.data ?? []),
    ...(paidOrdersResult.data ?? []),
    ...cancelledOrders,
  ]) {
    allOrders.set(order.id, order);
  }

  for (const payment of paymentsResult.data ?? []) {
    const orderBucket = paymentsByOrderId.get(payment.order_id) ?? [];
    orderBucket.push(payment);
    paymentsByOrderId.set(payment.order_id, orderBucket);

    const shiftBucket = paymentsByShiftId.get(payment.cash_shift_id) ?? [];
    shiftBucket.push(payment);
    paymentsByShiftId.set(payment.cash_shift_id, shiftBucket);
  }

  const devices: RetailDeviceOption[] = (devicesResult.data ?? [])
    .map((device) => {
      const settings = settingsByDeviceId.get(device.id);
      if (!settings) {
        return null;
      }

      return {
        id: device.id,
        name: device.name,
        role: settings.device_role,
        kioskNumber: device.kiosks?.number ?? null,
        kioskName: device.kiosks?.name ?? null,
      };
    })
    .filter((device): device is RetailDeviceOption => Boolean(device))
    .sort((left, right) => left.name.localeCompare(right.name, "es-MX"));

  const shifts = (shiftsResult.data ?? []).filter((shift) => {
    const inRange =
      isWithinRange(shift.opened_at, startIso, endIso) || isWithinRange(shift.closed_at, startIso, endIso);

    if (!inRange) {
      return false;
    }

    if (!filters.deviceId) {
      return true;
    }

    return shift.device_id === filters.deviceId;
  });

  const postSaleDocuments = (postSaleDocumentsResult.data ?? []).filter((document) => {
    if (!filters.deviceId) {
      return true;
    }

    return document.cash_shift_id
      ? shifts.some((shift) => shift.id === document.cash_shift_id)
      : false;
  });

  for (const document of postSaleDocuments) {
    const current = postSaleDocumentByOrderId.get(document.original_order_id);
    if (!current || current.created_at < document.created_at) {
      postSaleDocumentByOrderId.set(document.original_order_id, document);
    }
  }

  const missingOriginalOrderIds = postSaleDocuments
    .map((document) => document.original_order_id)
    .filter((orderId, index, collection) => collection.indexOf(orderId) === index)
    .filter((orderId) => !allOrders.has(orderId));

  if (missingOriginalOrderIds.length > 0) {
    const originalOrdersResult = await supabase
      .from("retail_pos_orders")
      .select(
        "id, tenant_id, folio, origin_local_folio, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, direct_discount_cents, order_discount_cents, total_cents, paid_at, voided_at, void_reason, cancelled_at, cancel_reason, created_at",
      )
      .eq("tenant_id", tenantId)
      .in("id", missingOriginalOrderIds)
      .returns<RetailOrderRow[]>();

    if (originalOrdersResult.error) {
      throw new Error(
        `Unable to load retail original orders for post sale report: ${originalOrdersResult.error.message}`,
      );
    }

    for (const order of originalOrdersResult.data ?? []) {
      allOrders.set(order.id, order);
    }
  }

  let orders = [...allOrders.values()]
    .sort((left, right) => getOrderActivityTimestamp(right).localeCompare(getOrderActivityTimestamp(left)))
    .filter((order) => {
    if (filters.orderStatus !== "all" && order.status !== filters.orderStatus) {
      return false;
    }

    if (!filters.deviceId) {
      return true;
    }

    if (order.origin_device_id === filters.deviceId || order.paid_by_device_id === filters.deviceId) {
      return true;
    }

      return (paymentsByOrderId.get(order.id) ?? []).some((payment) => payment.device_id === filters.deviceId);
    });

  const payments = (paymentsResult.data ?? []).filter((payment) => {
    if (!filters.deviceId) {
      return true;
    }

    return payment.device_id === filters.deviceId;
  });

  const ticketEvents = (ticketEventsResult.data ?? []).filter((event) => {
    if (!filters.deviceId) {
      return true;
    }

    const order = orders.find((candidate) => candidate.id === event.order_id);
    return Boolean(order);
  });

  const postSaleRefunds = (postSaleRefundsResult.data ?? []).filter((refund) => {
    const document = postSaleDocuments.find((candidate) => candidate.id === refund.post_sale_document_id);
    if (!document) {
      return false;
    }

    if (!filters.deviceId) {
      return true;
    }

    return document.cash_shift_id
      ? shifts.some((shift) => shift.id === document.cash_shift_id)
      : false;
  });

  for (const refund of postSaleRefunds) {
    postSaleRefundByDocumentId.set(refund.post_sale_document_id, refund);
  }

  const paidOrderIds = Array.from(
    new Set(
      orders
        .filter((order) => order.status === "paid")
        .map((order) => order.id),
    ),
  );

  const linesResult = paidOrderIds.length
    ? await supabase
        .from("retail_pos_order_lines")
        .select(
          "id, order_id, line_number, product_id, product_variant_id, product_name, variant_name, sku, sales_unit_label, quantity, unit_price_cents, public_unit_price_snapshot_cents, wholesale_unit_price_snapshot_cents, requested_price_tier, price_tier_request_status, requested_by_pos_user_id, requested_at, approved_price_tier, approved_unit_price_cents, approved_by_pos_user_id, approved_at, line_subtotal_cents, direct_discount_cents, order_discount_allocation_cents, total_discount_cents, unit_cost_snapshot_cents, line_total_cents, below_cost_after_discount",
        )
        .eq("tenant_id", tenantId)
        .in("order_id", paidOrderIds)
        .returns<RetailOrderLineRow[]>()
    : { data: [] as RetailOrderLineRow[], error: null };

  if (linesResult.error) {
    throw new Error(`Unable to load retail order lines report: ${linesResult.error.message}`);
  }

  const linesByOrderId = new Map<string, RetailOrderLineRow[]>();
  for (const line of linesResult.data ?? []) {
    const bucket = linesByOrderId.get(line.order_id) ?? [];
    bucket.push(line);
    linesByOrderId.set(line.order_id, bucket);
  }
  if (filters.priceTier !== "all") {
    orders = orders.filter((order) => {
      if (order.status !== "paid") return false;
      return classifyPriceTier(linesByOrderId.get(order.id) ?? []) === filters.priceTier;
    });
  }

  const discountsResult = paidOrderIds.length
    ? await supabase
        .from("retail_pos_order_discounts")
        .select(
          "order_id, scope, order_line_id, effective_discount_cents, reason_code, applied_by_pos_user_id, applied_at",
        )
        .eq("tenant_id", tenantId)
        .eq("lifecycle_status", "active")
        .in("order_id", paidOrderIds)
        .returns<RetailDiscountRow[]>()
    : { data: [] as RetailDiscountRow[], error: null };

  if (discountsResult.error) {
    throw new Error(`Unable to load retail order discounts report: ${discountsResult.error.message}`);
  }

  return {
    filters,
    devices,
    userById,
    deviceById,
    settingsByDeviceId,
    orders,
    payments,
    paymentsByOrderId,
    paymentsByShiftId,
    shifts,
    ticketEvents,
    postSaleDocuments,
    postSaleRefunds,
    postSaleDocumentByOrderId,
    postSaleRefundByDocumentId,
    lines: (linesResult.data ?? []).filter((line) => orders.some((order) => order.id === line.order_id)),
    discounts: discountsResult.data ?? [],
    startIso,
    endIso,
  };
}

async function loadPostSaleDataForOrderIds(tenantId: string, orderIds: string[]) {
  if (orderIds.length === 0) {
    return {
      documents: [] as RetailPostSaleDocumentRow[],
      refunds: [] as RetailPostSaleRefundRow[],
      documentByOrderId: new Map<string, RetailPostSaleDocumentRow>(),
      refundByDocumentId: new Map<string, RetailPostSaleRefundRow>(),
    };
  }

  const supabase = getSupabaseAdminClient();
  const documentsResult = await supabase
    .from("retail_pos_post_sale_documents")
    .select(
      "id, original_order_id, original_payment_id, document_type, cash_shift_id, status, refund_status, refund_method, gross_amount_cents, discount_amount_cents, net_amount_cents, refund_amount_cents, reason_code, comment, created_by_pos_user_id, created_at, confirmed_at",
    )
    .eq("tenant_id", tenantId)
    .in("original_order_id", orderIds)
    .in("document_type", ["sale_cancellation", "return_full", "return_partial"])
    .returns<RetailPostSaleDocumentRow[]>();

  if (documentsResult.error) {
    throw new Error(`Unable to load retail post sale documents by order report: ${documentsResult.error.message}`);
  }

  const documents = documentsResult.data ?? [];
  const documentByOrderId = new Map<string, RetailPostSaleDocumentRow>();

  for (const document of documents) {
    const current = documentByOrderId.get(document.original_order_id);
    if (!current || current.created_at < document.created_at) {
      documentByOrderId.set(document.original_order_id, document);
    }
  }

  const documentIds = documents.map((document) => document.id);
  const refundsResult = documentIds.length
    ? await supabase
        .from("retail_pos_post_sale_refunds")
        .select(
          "id, post_sale_document_id, cash_shift_id, refund_method, status, amount_cents, external_reference, processed_at, created_at",
        )
        .eq("tenant_id", tenantId)
        .in("post_sale_document_id", documentIds)
        .returns<RetailPostSaleRefundRow[]>()
    : { data: [] as RetailPostSaleRefundRow[], error: null };

  if (refundsResult.error) {
    throw new Error(`Unable to load retail post sale refunds by order report: ${refundsResult.error.message}`);
  }

  const refundByDocumentId = new Map<string, RetailPostSaleRefundRow>();
  for (const refund of refundsResult.data ?? []) {
    const current = refundByDocumentId.get(refund.post_sale_document_id);
    const currentTimestamp = current?.processed_at ?? current?.created_at ?? "";
    const nextTimestamp = refund.processed_at ?? refund.created_at;
    if (!current || currentTimestamp < nextTimestamp) {
      refundByDocumentId.set(refund.post_sale_document_id, refund);
    }
  }

  return {
    documents,
    refunds: refundsResult.data ?? [],
    documentByOrderId,
    refundByDocumentId,
  };
}

type RetailBaseReportData = Awaited<ReturnType<typeof loadBaseRetailReportData>>;

async function buildRetailReportsOverviewFromLoadedData(
  tenantId: string,
  data: RetailBaseReportData,
): Promise<RetailReportsOverview> {
  const pendingOrders = data.orders.filter((order) => order.status === "pending_payment");
  const voidedOrders = data.orders.filter((order) => isVoidedOrder(order));
  const paidOrders = data.orders.filter((order) => order.status === "paid");
  const orderRowsPostSaleData = await loadPostSaleDataForOrderIds(
    tenantId,
    data.orders.map((order) => order.id),
  );
  const completedPostSaleDocuments = data.postSaleDocuments.filter(
    (document) =>
      document.status === "completed" &&
      getCanonicalPostSaleDocumentType(document.document_type) !== null,
  );
  const saleVoidDocuments = completedPostSaleDocuments.filter((document) =>
    isSaleCancellationDocument(document),
  );
  const returnDocuments = completedPostSaleDocuments.filter(
    (document) => document.document_type === "return_full" || document.document_type === "return_partial",
  );
  const cancelledPaidOrders = paidOrders.filter((order) =>
    saleVoidDocuments.some((document) => document.original_order_id === order.id),
  );
  const soldLines = data.lines;
  const paidLineRows = soldLines.filter((line) => paidOrders.some((order) => order.id === line.order_id));
  const priceEconomics = paidLineRows.map((line) => ({ line, economics: calculatePriceTierEconomics({
    quantity: line.quantity,
    publicUnitPriceSnapshotCents: line.public_unit_price_snapshot_cents,
    wholesaleUnitPriceSnapshotCents: line.wholesale_unit_price_snapshot_cents,
    approvedPriceTier: line.approved_price_tier,
    approvedUnitPriceCents: line.approved_unit_price_cents,
    unitPriceCents: line.unit_price_cents,
    lineSubtotalCents: line.line_subtotal_cents,
    lineTotalCents: line.line_total_cents,
    directDiscountCents: line.direct_discount_cents,
    orderDiscountAllocationCents: line.order_discount_allocation_cents,
    totalDiscountCents: line.total_discount_cents,
    unitCostSnapshotCents: line.unit_cost_snapshot_cents,
  }) }));
  const wholesaleEconomics = priceEconomics.filter(({ economics }) => economics.tier === "wholesale");
  const commercialCoverage = buildRetailCommercialCoverage(priceEconomics);
  const priceComposition = (["public", "wholesale", "unknown"] as const).map((tier) => ({
    tier,
    baseCents: tier === "unknown"
      ? null
      : priceEconomics
          .filter(({ economics }) => economics.tier === tier)
          .reduce((sum, row) => sum + (row.economics.approvedBaseCents ?? 0), 0),
  }));
  const decisionCounts = (["requested_approved", "requested_rejected", "cashier_direct"] as const).map((key) => ({
    key,
    count: paidLineRows.filter((candidate) => classifyPriceTierDecision({ requestedPriceTier: candidate.requested_price_tier, approvedPriceTier: candidate.approved_price_tier, quantity: candidate.quantity }) === key).length,
  }));
  const anomalies = paidLineRows.flatMap((line) => {
    const economics = calculatePriceTierEconomics({ quantity: line.quantity, publicUnitPriceSnapshotCents: line.public_unit_price_snapshot_cents, wholesaleUnitPriceSnapshotCents: line.wholesale_unit_price_snapshot_cents, approvedPriceTier: line.approved_price_tier, approvedUnitPriceCents: line.approved_unit_price_cents, unitPriceCents: line.unit_price_cents, directDiscountCents: line.direct_discount_cents, orderDiscountAllocationCents: line.order_discount_allocation_cents, totalDiscountCents: line.total_discount_cents, unitCostSnapshotCents: line.unit_cost_snapshot_cents });
    const order = paidOrders.find((candidate) => candidate.id === line.order_id)!;
    const issues: string[] = [];
    if (line.public_unit_price_snapshot_cents === null || line.wholesale_unit_price_snapshot_cents === null) issues.push("missing_snapshots");
    if (line.approved_price_tier === "wholesale" && line.approved_unit_price_cents !== line.wholesale_unit_price_snapshot_cents) issues.push("wholesale_snapshot_mismatch");
    if (line.approved_price_tier === "public" && line.approved_unit_price_cents !== line.public_unit_price_snapshot_cents) issues.push("public_snapshot_mismatch");
    if (line.requested_price_tier === "wholesale" && line.approved_price_tier === "wholesale" && !line.approved_by_pos_user_id) issues.push("missing_approver");
    if (economics.manualDiscountCents !== null && economics.manualDiscountCents > 0 && economics.priceTierDifferenceCents !== null && economics.priceTierDifferenceCents !== 0 && line.total_discount_cents === economics.priceTierDifferenceCents) issues.push("tier_difference_as_discount");
    return issues.map((type) => ({ type, orderId: order.id, folio: order.folio }));
  });
  const soldUnits = soldLines.reduce((sum, line) => sum + parseQuantity(line.quantity), 0);
  const paymentMethods = buildPaymentMethodSummary(data.payments);
  const lineDiscountsCents = paidOrders.reduce((sum, order) => sum + (order.direct_discount_cents ?? 0), 0);
  const orderDiscountsCents = paidOrders.reduce((sum, order) => sum + (order.order_discount_cents ?? 0), 0);
  const cashRefundsCompletedCents = data.postSaleRefunds
    .filter((refund) => refund.status === "completed" && refund.refund_method === "cash")
    .reduce((sum, refund) => sum + refund.amount_cents, 0);
  const cardRefundsCompletedCents = data.postSaleRefunds
    .filter((refund) => refund.status === "completed" && refund.refund_method === "card_external")
    .reduce((sum, refund) => sum + refund.amount_cents, 0);
  const cardRefundsPendingCents = data.postSaleRefunds
    .filter((refund) => refund.status === "pending" && refund.refund_method === "card_external")
    .reduce((sum, refund) => sum + refund.amount_cents, 0);
  const pendingRefundsCount = data.postSaleRefunds.filter((refund) => refund.status === "pending").length;
  const pendingRefundCents = data.postSaleRefunds
    .filter((refund) => refund.status === "pending")
    .reduce((sum, refund) => sum + refund.amount_cents, 0);
  const voidedSalesCents = saleVoidDocuments.reduce(
    (sum, document) => sum + document.net_amount_cents,
    0,
  );
  const voidedSalesCount = saleVoidDocuments.length;
  const cancellationAmountCents = voidedSalesCents;
  const returnAmountCents = returnDocuments.reduce((sum, document) => sum + document.net_amount_cents, 0);
  const fullReturnDocumentsCount = returnDocuments.filter(
    (document) => document.document_type === "return_full",
  ).length;
  const partialReturnDocumentsCount = returnDocuments.filter(
    (document) => document.document_type === "return_partial",
  ).length;
  const discountByReasonMap = new Map<
    string,
    { reasonCode: string; discountsCount: number; totalDiscountCents: number }
  >();
  const discountByCashierMap = new Map<
    string,
    { posUserId: string | null; posUserName: string | null; discountsCount: number; totalDiscountCents: number }
  >();

  for (const discount of data.discounts) {
    const reasonBucket = discountByReasonMap.get(discount.reason_code) ?? {
      reasonCode: discount.reason_code,
      discountsCount: 0,
      totalDiscountCents: 0,
    };
    reasonBucket.discountsCount += 1;
    reasonBucket.totalDiscountCents += discount.effective_discount_cents;
    discountByReasonMap.set(discount.reason_code, reasonBucket);

    const cashierKey = discount.applied_by_pos_user_id ?? "unknown";
    const cashierBucket = discountByCashierMap.get(cashierKey) ?? {
      posUserId: discount.applied_by_pos_user_id,
      posUserName: discount.applied_by_pos_user_id
        ? data.userById.get(discount.applied_by_pos_user_id)?.name ?? null
        : null,
      discountsCount: 0,
      totalDiscountCents: 0,
    };
    cashierBucket.discountsCount += 1;
    cashierBucket.totalDiscountCents += discount.effective_discount_cents;
    discountByCashierMap.set(cashierKey, cashierBucket);
  }

  const belowCostRows = priceEconomics.filter(({ economics }) => economics.belowCost);
  const belowCostLines = belowCostRows.map(({ line }) => line);
  const belowCostOrderIds = new Set(belowCostLines.map((line) => line.order_id));
  const belowCostNetSalesCents = belowCostRows.reduce(
    (sum, row) => sum + row.economics.belowCostSalesCents,
    0,
  );
  const belowCostMarginCents = belowCostRows.reduce(
    (sum, row) => sum + row.economics.belowCostMarginCents,
    0,
  );
  const grossMarginCents = priceEconomics.reduce(
    (sum, row) => sum + (row.economics.finalMarginCents ?? 0),
    0,
  );
  const marginPercentBps = commercialCoverage.netSalesWithCostCents === 0
    ? null
    : Math.round((grossMarginCents * 10_000) / commercialCoverage.netSalesWithCostCents);
  const commercialGrossSalesCents = priceEconomics.reduce(
    (sum, row) => sum + (row.economics.approvedBaseCents ?? 0),
    0,
  );
  const discountAdditionalCents = priceEconomics.reduce(
    (sum, row) => sum + (row.economics.manualDiscountCents ?? 0),
    0,
  );

  const netSalesCents = paidOrders.reduce((sum, order) => sum + order.total_cents, 0);
  const netAfterCancellationsCents = netSalesCents - cancellationAmountCents;
  const commercialNetAfterPostSaleCents = netSalesCents - cancellationAmountCents - returnAmountCents;
  const commercialWaterfall = buildRetailCommercialWaterfall({
    grossSalesCents: paidOrders.reduce((sum, order) => sum + order.subtotal_cents, 0),
    discountsCents: paidOrders.reduce((sum, order) => sum + order.discount_cents, 0),
    netSalesCents,
    cancelledSalesCents: cancellationAmountCents,
    returnedCents: returnAmountCents,
    commercialNetCents: commercialNetAfterPostSaleCents,
  });
  const paymentMix = buildRetailPaymentMix(paymentMethods);
  const salesTrend = buildRetailSalesTrend({
    dateFrom: data.filters.dateFrom,
    dateTo: data.filters.dateTo,
    paidOrders: paidOrders.map((order) => ({
      paidAt: order.paid_at,
      totalCents: order.total_cents,
    })),
    completedPostSaleDocuments: completedPostSaleDocuments.map((document) => ({
      createdAt: document.created_at,
      documentType: document.document_type,
      netAmountCents: document.net_amount_cents,
    })),
  });
  const attention = buildRetailOverviewAttentionSignals({
    pendingRefundsCount,
    pendingRefundCents,
    pendingOrdersCount: data.orders.filter((order) => order.status === "pending_payment").length,
    openShiftsCount: data.shifts.filter((shift) => shift.status === "open").length,
    belowCostOrdersCount: belowCostOrderIds.size,
    failedPrintCount: data.ticketEvents.filter((event) => event.event_type === "print_failed").length,
  });
  const visibleOrders = [...data.orders]
    .sort((left, right) => {
      const leftPostSaleAt = orderRowsPostSaleData.documents
        .filter((document) => document.original_order_id === left.id && document.status === "completed")
        .map((document) => document.confirmed_at ?? document.created_at)
        .sort()
        .at(-1);
      const rightPostSaleAt = orderRowsPostSaleData.documents
        .filter((document) => document.original_order_id === right.id && document.status === "completed")
        .map((document) => document.confirmed_at ?? document.created_at)
        .sort()
        .at(-1);

      return (rightPostSaleAt ?? getOrderActivityTimestamp(right)).localeCompare(
        leftPostSaleAt ?? getOrderActivityTimestamp(left),
      );
    })
    .slice(0, 25);

  return {
    businessDateLabel: getBusinessDateLabel(data.filters),
    dateRangeLabel: formatDateRangeLabel(data.filters),
    filters: data.filters,
    devices: data.devices,
    summary: {
      totalOrders: data.orders.length,
      paidOrders: paidOrders.length,
      pendingOrders: pendingOrders.length,
      cancelledOrders: voidedOrders.length,
      voidedOrdersCount: voidedOrders.length,
      cancelledPaidOrders: cancelledPaidOrders.length,
      grossSalesCents: paidOrders.reduce((sum, order) => sum + order.subtotal_cents, 0),
      lineDiscountsCents,
      orderDiscountsCents,
      discountsCents: paidOrders.reduce((sum, order) => sum + order.discount_cents, 0),
      netSalesCents,
      netAfterCancellationsCents,
      netCommercialCents: commercialNetAfterPostSaleCents,
      commercialNetCents: commercialNetAfterPostSaleCents,
      voidedSalesCount,
      voidedSalesCents,
      cancelledSalesCount: voidedSalesCount,
      cancelledSalesCents: voidedSalesCents,
      commercialNetAfterPostSaleCents,
      cashCents: paymentMethods.find((row) => row.method === "cash")?.totalCents ?? 0,
      cardCents: paymentMethods.find((row) => row.method === "card")?.totalCents ?? 0,
      cashRefundsCents: cashRefundsCompletedCents,
      cardRefundsCents: cardRefundsCompletedCents,
      cashRefundsCompletedCents,
      cardRefundsCompletedCents,
      cardRefundsPendingCents,
      pendingRefundCents,
      pendingRefundsCount,
      cancellationAmountCents,
      returnAmountCents,
      returnedCents: returnAmountCents,
      totalReturnDocumentsCount: returnDocuments.length,
      partialReturnDocumentsCount,
      fullReturnDocumentsCount,
      fullReturnsCount: fullReturnDocumentsCount,
      partialReturnsCount: partialReturnDocumentsCount,
      averageTicketCents:
        paidOrders.length > 0
          ? Math.round(paidOrders.reduce((sum, order) => sum + order.total_cents, 0) / paidOrders.length)
          : 0,
      soldLinesCount: soldLines.length,
      soldUnits,
      openShiftsCount: data.shifts.filter((shift) => shift.status === "open").length,
      wholesaleSalesCount: paidOrders.filter((order) => classifyPriceTier(linesByOrderIdForBuild(data.lines, order.id)) === "wholesale" || classifyPriceTier(linesByOrderIdForBuild(data.lines, order.id)) === "mixed").length,
      wholesaleBaseCents: wholesaleEconomics.reduce((sum, row) => sum + (row.economics.approvedBaseCents ?? 0), 0),
      wholesaleDifferenceCents: wholesaleEconomics.reduce((sum, row) => sum + (row.economics.priceTierDifferenceCents ?? 0), 0),
      wholesaleManualDiscountCents: wholesaleEconomics.reduce((sum, row) => sum + (row.economics.manualDiscountCents ?? 0), 0),
      priceComposition,
      commercialMetrics: {
        grossSalesCents: commercialGrossSalesCents,
        discountAdditionalCents,
        netSalesCents: commercialCoverage.totalNetSalesCents,
        netSalesWithCostCents: commercialCoverage.netSalesWithCostCents,
        grossMarginCents,
        marginPercentBps,
        belowCostLinesCount: belowCostRows.length,
        belowCostSalesCents: belowCostNetSalesCents,
        belowCostMarginCents,
      },
      priceTierCoverage: {
        publicLines: commercialCoverage.publicLines,
        wholesaleLines: commercialCoverage.wholesaleLines,
        unknownLines: commercialCoverage.unknownLines,
        publicNetSalesCents: commercialCoverage.publicNetSalesCents,
        wholesaleNetSalesCents: commercialCoverage.wholesaleNetSalesCents,
        unknownNetSalesCents: commercialCoverage.unknownNetSalesCents,
      },
      costCoverage: {
        totalLines: commercialCoverage.totalLines,
        linesWithCost: commercialCoverage.linesWithCost,
        linesWithoutCost: commercialCoverage.linesWithoutCost,
        netSalesWithCostCents: commercialCoverage.netSalesWithCostCents,
        netSalesWithoutCostCents: commercialCoverage.netSalesWithoutCostCents,
        costCoverageByLinesBps: commercialCoverage.costCoverageByLinesBps,
        costCoverageByAmountBps: commercialCoverage.costCoverageByAmountBps,
      },
      decisionCounts,
      anomalies,
    },
    discountBreakdown: {
      byReason: [...discountByReasonMap.values()].sort(
        (left, right) => right.totalDiscountCents - left.totalDiscountCents,
      ),
      byCashier: [...discountByCashierMap.values()].sort(
        (left, right) => right.totalDiscountCents - left.totalDiscountCents,
      ),
      belowCostOrdersCount: belowCostOrderIds.size,
      belowCostLinesCount: belowCostLines.length,
      belowCostNetSalesCents,
    },
    paymentMethods,
    paymentMix,
    commercialWaterfall,
    salesTrend,
    attention,
    audit: buildAudit(data.ticketEvents),
    recentOrders: visibleOrders.map((order) => {
      const firstPayment = (data.paymentsByOrderId.get(order.id) ?? [])[0] ?? null;
      const postSaleDocuments = orderRowsPostSaleData.documents.filter(
        (document) => document.original_order_id === order.id && document.status === "completed",
      );
      const hasSaleCancellation = postSaleDocuments.some((document) =>
        isSaleCancellationDocument(document),
      );
      const hasFullReturn = postSaleDocuments.some((document) => document.document_type === "return_full");
      const hasPartialReturn = postSaleDocuments.some((document) => document.document_type === "return_partial");
      const cancelledSalesCents = postSaleDocuments
        .filter((document) => isSaleCancellationDocument(document))
        .reduce((sum, document) => sum + document.net_amount_cents, 0);
      const returnedCents = postSaleDocuments
        .filter((document) => document.document_type === "return_full" || document.document_type === "return_partial")
        .reduce((sum, document) => sum + document.net_amount_cents, 0);
      const hasBelowCostLine = soldLines.some(
        (line) => line.order_id === order.id && line.below_cost_after_discount === true,
      );
      const orderEconomics = priceEconomics.filter(({ line }) => line.order_id === order.id);
      const knownBaseRows = orderEconomics.filter(({ economics }) => economics.approvedBaseCents !== null);
      const costRows = orderEconomics.filter(({ economics }) => economics.costCents !== null);
      const historicalBaseCents = knownBaseRows.length > 0
        ? knownBaseRows.reduce((sum, row) => sum + (row.economics.approvedBaseCents ?? 0), 0)
        : null;
      const additionalDiscountCents = knownBaseRows.length > 0
        ? knownBaseRows.reduce((sum, row) => sum + (row.economics.manualDiscountCents ?? 0), 0)
        : null;
      const historicalCostCents = orderEconomics.length > 0 && costRows.length === orderEconomics.length
        ? costRows.reduce((sum, row) => sum + (row.economics.costCents ?? 0), 0)
        : null;
      const grossMarginCents = costRows.length > 0
        ? costRows.reduce((sum, row) => sum + (row.economics.finalMarginCents ?? 0), 0)
        : null;
      const lastPostSaleAt =
        postSaleDocuments
          .map((document) => document.confirmed_at ?? document.created_at)
          .sort()
          .at(-1) ?? null;

      return {
        orderId: order.id,
        folio: order.folio,
        localFolio: order.origin_local_folio,
        status: order.status,
        postSaleStatus: hasSaleCancellation
          ? "sale_cancellation"
          : hasFullReturn
            ? "return_full"
            : hasPartialReturn
              ? "return_partial"
              : "none",
        postSaleLabel: hasSaleCancellation
          ? "Venta cancelada"
          : hasFullReturn
            ? "Devolución total"
            : hasPartialReturn
              ? "Devolución parcial"
              : null,
        cancelledSalesCents,
        returnedCents,
        lastPostSaleAt,
        totalCents: order.total_cents,
        grossSalesCents: order.subtotal_cents,
        paymentMethod: firstPayment?.payment_method ?? null,
        originDeviceName: data.deviceById.get(order.origin_device_id)?.name ?? null,
        originKioskLabel: formatKioskLabel(data.deviceById.get(order.origin_device_id)),
        paidDeviceName: order.paid_by_device_id ? data.deviceById.get(order.paid_by_device_id)?.name ?? null : null,
        paidKioskLabel: order.paid_by_device_id ? formatKioskLabel(data.deviceById.get(order.paid_by_device_id)) : null,
        createdAt: order.created_at,
        paidAt: order.paid_at,
        relevantAt: lastPostSaleAt ?? order.paid_at ?? order.voided_at ?? order.created_at,
        voidedAtOrder: order.voided_at,
        cancelReason: getOrderVoidReason(order),
        discountCents: order.discount_cents,
        hasBelowCostLine,
        priceTier: classifyPriceTier(soldLines.filter((line) => line.order_id === order.id)),
        wholesaleDifferenceCents: orderEconomics.filter(({ economics }) => economics.tier === "wholesale").reduce((sum, row) => sum + (row.economics.priceTierDifferenceCents ?? 0), 0),
        historicalBaseCents,
        additionalDiscountCents,
        historicalCostCents,
        grossMarginCents,
        costCoverageLines: costRows.length,
        costCoverageTotalLines: orderEconomics.length,
      };
    }),
  };
}

export async function getRetailReportsOverview(
  tenantId: string,
  filtersInput?: RetailReportsFiltersInput,
): Promise<RetailReportsOverview> {
  const data = await loadBaseRetailReportData(tenantId, filtersInput);
  return buildRetailReportsOverviewFromLoadedData(tenantId, data);
}

export async function getRetailCashShiftReport(
  tenantId: string,
  filtersInput?: RetailReportsFiltersInput,
): Promise<RetailCashShiftReport> {
  const data = await loadBaseRetailReportData(tenantId, filtersInput);
  const rows = data.shifts.map((shift) => {
    const payments = data.paymentsByShiftId.get(shift.id) ?? [];
    const shiftOrderIds = [...new Set(payments.map((payment) => payment.order_id))];
    const shiftOrders = shiftOrderIds
      .map((orderId) => data.orders.find((order) => order.id === orderId))
      .filter((order): order is RetailOrderRow => Boolean(order));
    const cashSalesCents = payments
      .filter((payment) => payment.payment_method === "cash")
      .reduce((sum, payment) => sum + payment.amount_cents, 0);
    const cardSalesCents = payments
      .filter((payment) => payment.payment_method === "card")
      .reduce((sum, payment) => sum + payment.amount_cents, 0);
    const ordersCount = new Set(payments.map((payment) => payment.order_id)).size;
    const grossSalesCents = shiftOrders.reduce((sum, order) => sum + order.subtotal_cents, 0);
    const discountsCents = shiftOrders.reduce((sum, order) => sum + order.discount_cents, 0);
    const shiftPostSaleDocuments = data.postSaleDocuments.filter(
      (document) =>
        document.cash_shift_id === shift.id &&
        document.status === "completed" &&
        getCanonicalPostSaleDocumentType(document.document_type) !== null,
    );
    const shiftSaleVoidDocuments = shiftPostSaleDocuments.filter(
      (document) => isSaleCancellationDocument(document),
    );
    const shiftReturnDocuments = shiftPostSaleDocuments.filter(
      (document) => document.document_type === "return_full" || document.document_type === "return_partial",
    );
    const fullReturnsCount = shiftReturnDocuments.filter(
      (document) => document.document_type === "return_full",
    ).length;
    const partialReturnsCount = shiftReturnDocuments.filter(
      (document) => document.document_type === "return_partial",
    ).length;
    const shiftDocumentById = new Map(shiftPostSaleDocuments.map((document) => [document.id, document]));
    const shiftPostSaleRefunds = data.postSaleRefunds.filter(
      (refund) => refund.cash_shift_id === shift.id && shiftDocumentById.has(refund.post_sale_document_id),
    );
    const cashCancellationRefundsCents = shiftPostSaleRefunds
      .filter((refund) => {
        if (refund.status !== "completed" || refund.refund_method !== "cash") {
          return false;
        }
        const document = shiftDocumentById.get(refund.post_sale_document_id);
        return document ? isSaleCancellationDocument(document) : false;
      })
      .reduce((sum, refund) => sum + refund.amount_cents, 0);
    const cashReturnRefundsCents = shiftPostSaleRefunds
      .filter((refund) => {
        if (refund.status !== "completed" || refund.refund_method !== "cash") {
          return false;
        }
        const document = shiftDocumentById.get(refund.post_sale_document_id);
        return document
          ? document.document_type === "return_full" || document.document_type === "return_partial"
          : false;
      })
      .reduce((sum, refund) => sum + refund.amount_cents, 0);
    const cashRefundsCents = cashCancellationRefundsCents + cashReturnRefundsCents;
    const cashRefundsCount = shiftPostSaleRefunds.filter(
      (refund) => refund.status === "completed" && refund.refund_method === "cash",
    ).length;
    const cardRefundsCompletedCount = shiftPostSaleRefunds.filter(
      (refund) => refund.status === "completed" && refund.refund_method === "card_external",
    ).length;
    const cardRefundsCompletedCents = shiftPostSaleRefunds
      .filter((refund) => refund.status === "completed" && refund.refund_method === "card_external")
      .reduce((sum, refund) => sum + refund.amount_cents, 0);
    const cardRefundsPendingCount = shiftPostSaleRefunds.filter(
      (refund) => refund.status === "pending" && refund.refund_method === "card_external",
    ).length;
    const cardRefundsPendingCents = shiftPostSaleRefunds
      .filter((refund) => refund.status === "pending" && refund.refund_method === "card_external")
      .reduce((sum, refund) => sum + refund.amount_cents, 0);
    const cardRefundsCents = cardRefundsCompletedCents;
    const expectedCashCents = shift.opening_float_cents + cashSalesCents - cashRefundsCents;
    const differenceCents =
      typeof shift.difference_cents === "number"
        ? shift.difference_cents
        : typeof shift.declared_cash_cents === "number"
          ? shift.declared_cash_cents - expectedCashCents
          : null;

    return {
      cashShiftId: shift.id,
      deviceName: data.deviceById.get(shift.device_id)?.name ?? null,
      kioskLabel: formatKioskLabel(data.deviceById.get(shift.device_id)),
      openedByName: data.userById.get(shift.opened_by_pos_user_id)?.name ?? null,
      closedByName: shift.closed_by_pos_user_id ? data.userById.get(shift.closed_by_pos_user_id)?.name ?? null : null,
      openedAt: shift.opened_at,
      closedAt: shift.closed_at,
      status: shift.status,
      openingFloatCents: shift.opening_float_cents,
      grossSalesCents,
      discountsCents,
      cancellationsCount: shiftSaleVoidDocuments.length,
      cancellationAmountCents: shiftSaleVoidDocuments.reduce(
        (sum, document) => sum + document.net_amount_cents,
        0,
      ),
      fullReturnsCount,
      partialReturnsCount,
      returnsCount: shiftReturnDocuments.length,
      returnAmountCents: shiftReturnDocuments.reduce((sum, document) => sum + document.net_amount_cents, 0),
      expectedCashCents,
      declaredCashCents: shift.declared_cash_cents,
      differenceCents,
      cashSalesCents,
      cardSalesCents,
      cashCancellationRefundsCents,
      cashReturnRefundsCents,
      cashRefundsCount,
      cashRefundsCents,
      cardRefundsCompletedCount,
      cardRefundsCompletedCents,
      cardRefundsPendingCount,
      cardRefundsPendingCents,
      cardRefundsCents,
      totalSalesCents: cashSalesCents + cardSalesCents,
      paymentsCount: payments.length,
      ordersCount,
      closingNote: shift.closing_note,
    };
  });
  const openRows = rows.filter((row) => row.status === "open");
  const closedRows = rows.filter((row) => row.status === "closed");
  const closedRowsWithDeclared = closedRows.filter((row) => typeof row.declaredCashCents === "number");
  const closedRowsWithDifference = closedRows.filter(
    (row) => typeof row.differenceCents === "number" && row.differenceCents !== 0,
  );
  const completedCashRefundsCount = rows.reduce((sum, row) => sum + row.cashRefundsCount, 0);
  const completedCardRefundsCount = rows.reduce((sum, row) => sum + row.cardRefundsCompletedCount, 0);
  const pendingCardRefundsCount = rows.reduce((sum, row) => sum + row.cardRefundsPendingCount, 0);
  const refundBreakdown: RetailCashShiftReport["refundBreakdown"] = [
    {
      key: "cash_completed",
      label: "Reembolsos en efectivo completados",
      refundsCount: completedCashRefundsCount,
      amountCents: rows.reduce((sum, row) => sum + row.cashRefundsCents, 0),
      tone: "default",
    },
    {
      key: "card_completed",
      label: "Reembolsos con tarjeta completados",
      refundsCount: completedCardRefundsCount,
      amountCents: rows.reduce((sum, row) => sum + row.cardRefundsCompletedCents, 0),
      tone: "default",
    },
    {
      key: "card_pending",
      label: "Reembolsos con tarjeta pendientes",
      refundsCount: pendingCardRefundsCount,
      amountCents: rows.reduce((sum, row) => sum + row.cardRefundsPendingCents, 0),
      tone: "warning",
    },
  ];

  return {
    filters: data.filters,
    devices: data.devices,
    rows,
    openRows,
    closedRows,
    refundBreakdown,
    totals: {
      shiftsCount: rows.length,
      openShiftsCount: openRows.length,
      closedShiftsCount: closedRows.length,
      totalGrossSalesCents: rows.reduce((sum, row) => sum + row.grossSalesCents, 0),
      totalDiscountsCents: rows.reduce((sum, row) => sum + row.discountsCents, 0),
      totalCancellationAmountCents: rows.reduce((sum, row) => sum + row.cancellationAmountCents, 0),
      totalReturnAmountCents: rows.reduce((sum, row) => sum + row.returnAmountCents, 0),
      totalExpectedCashCents: rows.reduce((sum, row) => sum + (row.expectedCashCents ?? 0), 0),
      totalDeclaredCashCents: rows.reduce((sum, row) => sum + (row.declaredCashCents ?? 0), 0),
      totalDifferenceCents: rows.reduce((sum, row) => sum + (row.differenceCents ?? 0), 0),
      totalCashSalesCents: rows.reduce((sum, row) => sum + row.cashSalesCents, 0),
      totalCardSalesCents: rows.reduce((sum, row) => sum + row.cardSalesCents, 0),
      totalCashCancellationRefundsCents: rows.reduce((sum, row) => sum + row.cashCancellationRefundsCents, 0),
      totalCashReturnRefundsCents: rows.reduce((sum, row) => sum + row.cashReturnRefundsCents, 0),
      totalCashRefundsCents: rows.reduce((sum, row) => sum + row.cashRefundsCents, 0),
      totalCardRefundsCompletedCents: rows.reduce((sum, row) => sum + row.cardRefundsCompletedCents, 0),
      totalCardRefundsPendingCents: rows.reduce((sum, row) => sum + row.cardRefundsPendingCents, 0),
      totalCardRefundsCents: rows.reduce((sum, row) => sum + row.cardRefundsCents, 0),
      totalSalesCents: rows.reduce((sum, row) => sum + row.totalSalesCents, 0),
      closedDeclaredCashCents: closedRowsWithDeclared.reduce((sum, row) => sum + (row.declaredCashCents ?? 0), 0),
      closedExpectedCashCents: closedRowsWithDeclared.reduce((sum, row) => sum + (row.expectedCashCents ?? 0), 0),
      closedDifferenceCents: closedRowsWithDeclared.reduce((sum, row) => sum + (row.differenceCents ?? 0), 0),
      closedMissingDeclaredCount: closedRows.filter((row) => typeof row.declaredCashCents !== "number").length,
      closedWithDifferenceCount: closedRowsWithDifference.length,
      completedCashRefundsCount,
      completedCardRefundsCount,
      pendingCardRefundsCount,
    },
  };
}

export async function getRetailPostSaleReport(
  tenantId: string,
  filtersInput?: RetailPostSaleReportFiltersInput,
): Promise<RetailPostSaleReport> {
  const filters = buildPostSaleFilters(filtersInput);
  const data = await loadBaseRetailReportData(tenantId, {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });
  const completedDocuments = data.postSaleDocuments.filter((document) => {
    const canonicalType = getCanonicalPostSaleDocumentType(document.document_type);
    if (document.status !== "completed" || canonicalType === null) {
      return false;
    }
    if (filters.operationType !== "all" && canonicalType !== filters.operationType) {
      return false;
    }
    if (filters.refundStatus !== "all" && document.refund_status !== filters.refundStatus) {
      return false;
    }
    if (filters.refundMethod !== "all" && document.refund_method !== filters.refundMethod) {
      return false;
    }
    return true;
  });
  const availableReasonRows = [...new Set(completedDocuments.map((document) => document.reason_code))]
    .filter(Boolean)
    .map((reasonCode) => ({
      reasonCode,
      operationsCount: completedDocuments.filter((document) => document.reason_code === reasonCode).length,
      totalAmountCents: completedDocuments
        .filter((document) => document.reason_code === reasonCode)
        .reduce((sum, document) => sum + document.net_amount_cents, 0),
    }))
    .sort((left, right) => right.totalAmountCents - left.totalAmountCents);
  const availableResponsibleUsers = [...new Map(
    completedDocuments
      .map((document) => {
        const posUserId = document.created_by_pos_user_id;
        if (!posUserId) {
          return null;
        }

        return [
          posUserId,
          {
            posUserId,
            posUserName: data.userById.get(posUserId)?.name ?? "Sin usuario",
          },
        ] as const;
      })
      .filter((entry): entry is readonly [string, { posUserId: string; posUserName: string }] => Boolean(entry)),
  ).values()].sort((left, right) => left.posUserName.localeCompare(right.posUserName, "es-MX"));
  const documents = completedDocuments.filter((document) => {
    if (filters.reasonCode && document.reason_code !== filters.reasonCode) {
      return false;
    }
    if (filters.responsibleUserId && document.created_by_pos_user_id !== filters.responsibleUserId) {
      return false;
    }
    return true;
  });
  const documentIds = documents.map((document) => document.id);
  const matchedRefunds = data.postSaleRefunds.filter((refund) => documentIds.includes(refund.post_sale_document_id));
  const latestRefundByDocumentId = new Map<string, RetailPostSaleRefundRow>();
  for (const refund of matchedRefunds) {
    const current = latestRefundByDocumentId.get(refund.post_sale_document_id);
    const currentTimestamp = current?.processed_at ?? current?.created_at ?? "";
    const nextTimestamp = refund.processed_at ?? refund.created_at;
    if (!current || currentTimestamp < nextTimestamp) {
      latestRefundByDocumentId.set(refund.post_sale_document_id, refund);
    }
  }
  const lineResult = documentIds.length
    ? await getSupabaseAdminClient()
        .from("retail_pos_post_sale_lines")
        .select(
          "id, post_sale_document_id, original_order_line_id, line_number, quantity_returned_now, returned_gross_amount_cents, returned_total_discount_cents, returned_net_amount_cents",
        )
        .eq("tenant_id", tenantId)
        .in("post_sale_document_id", documentIds)
        .returns<RetailPostSaleLineRow[]>()
    : { data: [] as RetailPostSaleLineRow[], error: null };

  if (lineResult.error) {
    throw new Error(`Unable to load retail post sale lines report: ${lineResult.error.message}`);
  }

  const postSaleLines = lineResult.data ?? [];
  const missingOriginalOrderIds = documents
    .map((document) => document.original_order_id)
    .filter((orderId) => !data.orders.some((order) => order.id === orderId));
  const originalOrdersResult = missingOriginalOrderIds.length
    ? await getSupabaseAdminClient()
        .from("retail_pos_orders")
        .select("id, folio")
        .eq("tenant_id", tenantId)
        .in("id", missingOriginalOrderIds)
        .returns<RetailOriginalOrderLookupRow[]>()
    : { data: [] as RetailOriginalOrderLookupRow[], error: null };

  if (originalOrdersResult.error) {
    throw new Error(`Unable to load retail original orders for post sale report: ${originalOrdersResult.error.message}`);
  }

  const originalOrderById = new Map<string, RetailOriginalOrderLookupRow>(
    data.orders.map((order) => [order.id, { id: order.id, folio: order.folio }]),
  );
  for (const order of originalOrdersResult.data ?? []) {
    originalOrderById.set(order.id, order);
  }
  const linesByDocumentId = new Map<string, RetailPostSaleLineRow[]>();
  for (const line of postSaleLines) {
    const bucket = linesByDocumentId.get(line.post_sale_document_id) ?? [];
    bucket.push(line);
    linesByDocumentId.set(line.post_sale_document_id, bucket);
  }

  const refundRecords = documents
    .map((document) => {
      const latestRefund = latestRefundByDocumentId.get(document.id) ?? null;

      if (latestRefund) {
        return {
          documentId: document.id,
          refundStatus: latestRefund.status,
          refundMethod: latestRefund.refund_method,
          amountCents: latestRefund.amount_cents,
          processedAt: latestRefund.processed_at,
          externalReference: latestRefund.external_reference,
        };
      }

      if (document.refund_status === "not_required" || document.refund_amount_cents <= 0) {
        return null;
      }

      return {
        documentId: document.id,
        refundStatus: document.refund_status,
        refundMethod: document.refund_method,
        amountCents: document.refund_amount_cents,
        processedAt: null,
        externalReference: null,
      };
    })
    .filter(
      (
        refund,
      ): refund is {
        documentId: string;
        refundStatus: RetailPosPostSaleRefundStatus;
        refundMethod: RetailPosPostSaleRefundMethod;
        amountCents: number;
        processedAt: string | null;
        externalReference: string | null;
      } => Boolean(refund),
    );
  const byReasonMap = new Map<string, { reasonCode: string; operationsCount: number; totalAmountCents: number }>();
  const byResponsibleUserMap = new Map<
    string,
    {
      posUserId: string | null;
      posUserName: string | null;
      cancelledSalesCount: number;
      returnsCount: number;
      operationsCount: number;
      totalAmountCents: number;
    }
  >();

  for (const document of documents) {
    const reasonBucket = byReasonMap.get(document.reason_code) ?? {
      reasonCode: document.reason_code,
      operationsCount: 0,
      totalAmountCents: 0,
    };
    reasonBucket.operationsCount += 1;
    reasonBucket.totalAmountCents += document.net_amount_cents;
    byReasonMap.set(document.reason_code, reasonBucket);

    const responsibleUserId = document.created_by_pos_user_id;
    const responsibleUserKey = responsibleUserId ?? "unknown";
    const responsibleUserBucket = byResponsibleUserMap.get(responsibleUserKey) ?? {
      posUserId: responsibleUserId,
      posUserName: responsibleUserId ? data.userById.get(responsibleUserId)?.name ?? null : null,
      cancelledSalesCount: 0,
      returnsCount: 0,
      operationsCount: 0,
      totalAmountCents: 0,
    };
    if (isSaleCancellationDocument(document)) {
      responsibleUserBucket.cancelledSalesCount += 1;
    } else {
      responsibleUserBucket.returnsCount += 1;
    }
    responsibleUserBucket.operationsCount += 1;
    responsibleUserBucket.totalAmountCents += document.net_amount_cents;
    byResponsibleUserMap.set(responsibleUserKey, responsibleUserBucket);
  }

  const cancelledSalesCount = documents.filter((document) => isSaleCancellationDocument(document)).length;
  const cancelledSalesCents = documents
    .filter((document) => isSaleCancellationDocument(document))
    .reduce((sum, document) => sum + document.net_amount_cents, 0);
  const fullReturnsCount = documents.filter((document) => document.document_type === "return_full").length;
  const fullReturnsCents = documents
    .filter((document) => document.document_type === "return_full")
    .reduce((sum, document) => sum + document.net_amount_cents, 0);
  const partialReturnsCount = documents.filter((document) => document.document_type === "return_partial").length;
  const partialReturnsCents = documents
    .filter((document) => document.document_type === "return_partial")
    .reduce((sum, document) => sum + document.net_amount_cents, 0);
  const returnedCents = fullReturnsCents + partialReturnsCents;
  const revertedAmountCents = cancelledSalesCents + returnedCents;
  const completedCashRefunds = refundRecords.filter(
    (refund) => refund.refundStatus === "completed" && refund.refundMethod === "cash",
  );
  const completedCardRefunds = refundRecords.filter(
    (refund) => refund.refundStatus === "completed" && refund.refundMethod === "card_external",
  );
  const pendingRefunds = refundRecords.filter((refund) => refund.refundStatus === "pending");
  const failedRefunds = refundRecords.filter((refund) => refund.refundStatus === "failed");
  const refundStatusBreakdown = [
    {
      key: "completed" as const,
      label: "Completados",
      refundStatus: "completed" as const,
      refundsCount: refundRecords.filter((refund) => refund.refundStatus === "completed").length,
      amountCents: refundRecords
        .filter((refund) => refund.refundStatus === "completed")
        .reduce((sum, refund) => sum + refund.amountCents, 0),
    },
    {
      key: "pending" as const,
      label: "Pendientes",
      refundStatus: "pending" as const,
      refundsCount: pendingRefunds.length,
      amountCents: pendingRefunds.reduce((sum, refund) => sum + refund.amountCents, 0),
    },
    {
      key: "failed" as const,
      label: "Fallidos",
      refundStatus: "failed" as const,
      refundsCount: failedRefunds.length,
      amountCents: failedRefunds.reduce((sum, refund) => sum + refund.amountCents, 0),
    },
  ].filter((row) => row.refundsCount > 0 || row.amountCents > 0);
  const refundStatusTotalCents = refundStatusBreakdown.reduce((sum, row) => sum + row.amountCents, 0);
  const trend = buildRetailPostSaleTrend({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    completedPostSaleDocuments: documents.map((document) => ({
      createdAt: document.created_at,
      documentType: document.document_type,
      netAmountCents: document.net_amount_cents,
    })),
  });

  return {
    filters,
    reasonOptions: availableReasonRows,
    responsibleUsers: availableResponsibleUsers,
    summary: {
      cancelledSalesCount,
      cancelledSalesCents,
      fullReturnsCount,
      fullReturnsCents,
      partialReturnsCount,
      partialReturnsCents,
      returnsCount: fullReturnsCount + partialReturnsCount,
      returnedCents,
      revertedAmountCents,
      completedCashRefundsCount: completedCashRefunds.length,
      cashRefundsCompletedCents: completedCashRefunds.reduce((sum, refund) => sum + refund.amountCents, 0),
      completedCardRefundsCount: completedCardRefunds.length,
      cardRefundsCompletedCents: completedCardRefunds.reduce((sum, refund) => sum + refund.amountCents, 0),
      completedRefundsCount: refundRecords.filter((refund) => refund.refundStatus === "completed").length,
      completedRefundsCents: refundRecords
        .filter((refund) => refund.refundStatus === "completed")
        .reduce((sum, refund) => sum + refund.amountCents, 0),
      pendingRefundsCount: pendingRefunds.length,
      cardRefundsPendingCents: pendingRefunds
        .filter((refund) => refund.refundMethod === "card_external")
        .reduce((sum, refund) => sum + refund.amountCents, 0),
      pendingRefundCents: pendingRefunds.reduce((sum, refund) => sum + refund.amountCents, 0),
      failedRefundsCount: failedRefunds.length,
      failedRefundCents: failedRefunds.reduce((sum, refund) => sum + refund.amountCents, 0),
    },
    refundBreakdown: [
      {
        key: "cash_completed" as const,
        label: "Reembolsos en efectivo completados",
        refundStatus: "completed" as const,
        refundMethod: "cash" as const,
        refundsCount: completedCashRefunds.length,
        amountCents: completedCashRefunds.reduce((sum, refund) => sum + refund.amountCents, 0),
      },
      {
        key: "card_completed" as const,
        label: "Reembolsos con tarjeta completados",
        refundStatus: "completed" as const,
        refundMethod: "card_external" as const,
        refundsCount: completedCardRefunds.length,
        amountCents: completedCardRefunds.reduce((sum, refund) => sum + refund.amountCents, 0),
      },
      {
        key: "card_pending" as const,
        label: "Reembolsos con tarjeta pendientes",
        refundStatus: "pending" as const,
        refundMethod: "card_external" as const,
        refundsCount: pendingRefunds.filter((refund) => refund.refundMethod === "card_external").length,
        amountCents: pendingRefunds
          .filter((refund) => refund.refundMethod === "card_external")
          .reduce((sum, refund) => sum + refund.amountCents, 0),
      },
      {
        key: "failed" as const,
        label: "Reembolsos fallidos",
        refundStatus: "failed" as const,
        refundMethod: null,
        refundsCount: failedRefunds.length,
        amountCents: failedRefunds.reduce((sum, refund) => sum + refund.amountCents, 0),
      },
    ].filter((row) => row.refundsCount > 0 || row.amountCents > 0),
    refundStatusBreakdown: refundStatusBreakdown.map((row) => ({
      ...row,
      share: refundStatusTotalCents > 0 ? row.amountCents / refundStatusTotalCents : null,
    })),
    trend,
    byReason: [...byReasonMap.values()].sort((left, right) => right.totalAmountCents - left.totalAmountCents),
    byResponsibleUser: [...byResponsibleUserMap.values()].sort(
      (left, right) => right.totalAmountCents - left.totalAmountCents,
    ),
    rows: documents
      .map((document) => {
        const canonicalType = getCanonicalPostSaleDocumentType(document.document_type) ?? "sale_cancellation";
        const originalOrder = originalOrderById.get(document.original_order_id) ?? null;
        const refund = refundRecords.find((entry) => entry.documentId === document.id) ?? null;
        const lines = linesByDocumentId.get(document.id) ?? [];

        return {
          documentId: document.id,
          registeredAt: document.created_at,
          confirmedAt: document.confirmed_at,
          processedAt: refund?.processedAt ?? null,
          operationType: canonicalType,
          operationLabel: getPostSaleOperationLabel(canonicalType),
          originalOrderId: document.original_order_id,
          originalFolio: originalOrder?.folio ?? "Sin folio",
          responsibleUserName: document.created_by_pos_user_id
            ? data.userById.get(document.created_by_pos_user_id)?.name ?? null
            : null,
          responsibleUserId: document.created_by_pos_user_id,
          reasonCode: document.reason_code,
          comment: document.comment,
          commercialAmountCents: document.net_amount_cents,
          refundAmountCents: refund?.amountCents ?? null,
          refundMethod: refund?.refundMethod ?? null,
          refundStatus: refund?.refundStatus ?? null,
          externalReference: refund?.externalReference ?? null,
          cashShiftId: document.cash_shift_id,
          lineCount: lines.length,
          quantityReturned: lines.reduce((sum, line) => sum + parseQuantity(line.quantity_returned_now), 0),
        };
      })
      .sort((left, right) => right.registeredAt.localeCompare(left.registeredAt)),
  };
}

export async function getRetailSalesReport(
  tenantId: string,
  filtersInput?: RetailReportsFiltersInput,
): Promise<RetailSalesReport> {
  const data = await loadBaseRetailReportData(tenantId, filtersInput);
  const overview = await buildRetailReportsOverviewFromLoadedData(tenantId, data);
  const paidOrders = data.orders.filter((order) => order.status === "paid");
  const completedPostSaleDocuments = data.postSaleDocuments.filter(
    (document) =>
      document.status === "completed" &&
      getCanonicalPostSaleDocumentType(document.document_type) !== null,
  );
  const activityTrend = buildRetailSalesActivityTrend({
    dateFrom: data.filters.dateFrom,
    dateTo: data.filters.dateTo,
    paidOrders: paidOrders.map((order) => ({
      paidAt: order.paid_at,
      totalCents: order.total_cents,
      discountCents: order.discount_cents,
    })),
  });
  const adjustmentsTrend = buildRetailSalesAdjustmentsTrend({
    dateFrom: data.filters.dateFrom,
    dateTo: data.filters.dateTo,
    paidOrders: paidOrders.map((order) => ({
      paidAt: order.paid_at,
      totalCents: order.total_cents,
      discountCents: order.discount_cents,
    })),
    completedPostSaleDocuments: completedPostSaleDocuments.map((document) => ({
      createdAt: document.created_at,
      documentType: document.document_type,
      netAmountCents: document.net_amount_cents,
    })),
  });
  const discountedOrdersCount = paidOrders.filter((order) => order.discount_cents > 0).length;

  return {
    filters: overview.filters,
    devices: overview.devices,
    summary: overview.summary,
    discountBreakdown: overview.discountBreakdown,
    orders: overview.recentOrders,
    activityTrend,
    adjustmentsTrend,
    discountInsights: {
      discountedOrdersCount,
      discountedOrdersShare:
        overview.summary.paidOrders > 0 ? discountedOrdersCount / overview.summary.paidOrders : null,
      belowCostOrdersCount: overview.discountBreakdown.belowCostOrdersCount,
      belowCostLinesCount: overview.discountBreakdown.belowCostLinesCount,
    },
  };
}

export async function getRetailProductsReport(
  tenantId: string,
  filtersInput?: RetailReportsFiltersInput,
): Promise<RetailProductsReport> {
  const data = await loadBaseRetailReportData(tenantId, filtersInput);
  const aggregate = new Map<
    string,
    {
      productKey: string;
      productName: string;
      variantName: string | null;
      sku: string | null;
      unitLabel: string;
      quantitySold: number;
      totalSoldCents: number;
      orderIds: Set<string>;
      weightedUnitPriceTotal: number;
    }
  >();

  for (const line of data.lines) {
    const key = [
      line.product_id,
      line.product_variant_id ?? "base",
      line.product_name,
      line.variant_name ?? "",
      line.sku ?? "",
      line.sales_unit_label,
    ].join("::");
    const current = aggregate.get(key) ?? {
      productKey: key,
      productName: line.product_name,
      variantName: line.variant_name,
      sku: line.sku,
      unitLabel: line.sales_unit_label,
      quantitySold: 0,
      totalSoldCents: 0,
      orderIds: new Set<string>(),
      weightedUnitPriceTotal: 0,
    };
    const quantity = parseQuantity(line.quantity);

    current.quantitySold += quantity;
    current.totalSoldCents += line.line_total_cents;
    current.orderIds.add(line.order_id);
    current.weightedUnitPriceTotal += line.unit_price_cents * quantity;
    aggregate.set(key, current);
  }

  const rows = [...aggregate.values()]
    .map((row) => ({
      productKey: row.productKey,
      productName: row.productName,
      variantName: row.variantName,
      sku: row.sku,
      unitLabel: row.unitLabel,
      quantitySold: row.quantitySold,
      totalSoldCents: row.totalSoldCents,
      ordersCount: row.orderIds.size,
      averageUnitPriceCents:
        row.quantitySold > 0 ? Math.round(row.weightedUnitPriceTotal / row.quantitySold) : 0,
    }))
    .sort((left, right) => right.totalSoldCents - left.totalSoldCents);

  return {
    filters: data.filters,
    devices: data.devices,
    rows,
    totals: {
      distinctProducts: rows.length,
      quantitySold: rows.reduce((sum, row) => sum + row.quantitySold, 0),
      totalSoldCents: rows.reduce((sum, row) => sum + row.totalSoldCents, 0),
    },
  };
}

export async function getRetailPosZReportByCashShift(params: {
  tenantId: string;
  shiftId: string;
}): Promise<RetailPosZReportV1> {
  const supabase = getSupabaseAdminClient();
  const warnings: RetailPosZReportV1["warnings"] = [];

  const [tenantResult, shiftResult] = await Promise.all([
    supabase.from("tenants").select("id, name").eq("id", params.tenantId).limit(1).maybeSingle<TenantRow>(),
    supabase
      .from("retail_pos_cash_shifts")
      .select(
        "id, tenant_id, device_id, opened_by_pos_user_id, closed_by_pos_user_id, status, opening_float_cents, expected_cash_cents, declared_cash_cents, difference_cents, opened_at, closed_at, closing_note",
      )
      .eq("tenant_id", params.tenantId)
      .eq("id", params.shiftId)
      .limit(1)
      .maybeSingle<RetailPosZReportShiftRow>(),
  ]);

  if (tenantResult.error) {
    throw new Error(`Unable to load retail tenant for Z report: ${tenantResult.error.message}`);
  }

  if (shiftResult.error) {
    throw new Error(`Unable to load retail cash shift for Z report: ${shiftResult.error.message}`);
  }

  const shift = shiftResult.data;
  if (!shift) {
    throw new Error("RETAIL_POS_Z_REPORT_NOT_FOUND");
  }

  if (shift.status === "open") {
    warnings.push({
      code: "shift_open",
      message: "El turno sigue abierto. Esta vista es operativa y no representa un Reporte Z final.",
    });
  }

  if (shift.status === "canceled") {
    warnings.push({
      code: "shift_canceled",
      message: "El turno está cancelado. La lectura se muestra solo como referencia administrativa.",
    });
  }

  const [deviceResult, settingsResult, usersResult, paymentsResult, postSaleDocumentsResult, postSaleRefundsResult, ticketEventsResult] = await Promise.all([
    supabase.from("pos_devices").select("id, name").eq("tenant_id", params.tenantId).eq("id", shift.device_id).limit(1).maybeSingle<DeviceRow>(),
    supabase
      .from("retail_pos_device_settings")
      .select("device_id, device_role")
      .eq("tenant_id", params.tenantId)
      .eq("device_id", shift.device_id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle<DeviceSettingsRow>(),
    supabase.from("pos_users").select("id, name").eq("tenant_id", params.tenantId).returns<PosUserRow[]>(),
    supabase
      .from("retail_pos_payments")
      .select("id, order_id, cash_shift_id, device_id, pos_user_id, payment_method, amount_cents, received_amount_cents, change_cents, paid_at")
      .eq("tenant_id", params.tenantId)
      .eq("cash_shift_id", shift.id)
      .order("paid_at", { ascending: true })
      .returns<RetailPosZReportPaymentRow[]>(),
    supabase
      .from("retail_pos_post_sale_documents")
      .select(
        "id, original_order_id, original_payment_id, document_type, cash_shift_id, status, refund_status, refund_method, gross_amount_cents, discount_amount_cents, net_amount_cents, refund_amount_cents, reason_code, comment, created_by_pos_user_id, created_at, confirmed_at",
      )
      .eq("tenant_id", params.tenantId)
      .in("document_type", ["sale_cancellation", "return_full", "return_partial"])
      .eq("cash_shift_id", shift.id)
      .returns<RetailPostSaleDocumentRow[]>(),
    supabase
      .from("retail_pos_post_sale_refunds")
      .select(
        "id, post_sale_document_id, cash_shift_id, refund_method, status, amount_cents, external_reference, processed_at, created_at",
      )
      .eq("tenant_id", params.tenantId)
      .eq("cash_shift_id", shift.id)
      .returns<RetailPostSaleRefundRow[]>(),
    supabase
      .from("retail_pos_ticket_events")
      .select("order_id, ticket_type, event_type, created_at")
      .eq("tenant_id", params.tenantId)
      .gte("created_at", shift.opened_at)
      .lt("created_at", shift.closed_at ?? new Date().toISOString())
      .returns<RetailTicketEventRow[]>(),
  ]);

  if (deviceResult.error) {
    throw new Error(`Unable to load retail device for Z report: ${deviceResult.error.message}`);
  }
  if (settingsResult.error) {
    throw new Error(`Unable to load retail device settings for Z report: ${settingsResult.error.message}`);
  }
  if (usersResult.error) {
    throw new Error(`Unable to load retail POS users for Z report: ${usersResult.error.message}`);
  }
  if (paymentsResult.error) {
    throw new Error(`Unable to load retail payments for Z report: ${paymentsResult.error.message}`);
  }
  if (postSaleDocumentsResult.error) {
    throw new Error(`Unable to load retail post sale documents for Z report: ${postSaleDocumentsResult.error.message}`);
  }
  if (postSaleRefundsResult.error) {
    throw new Error(`Unable to load retail post sale refunds for Z report: ${postSaleRefundsResult.error.message}`);
  }
  if (ticketEventsResult.error) {
    throw new Error(`Unable to load retail ticket events for Z report: ${ticketEventsResult.error.message}`);
  }

  const userById = new Map((usersResult.data ?? []).map((row) => [row.id, row]));
  const payments = paymentsResult.data ?? [];
  const orderIds = Array.from(new Set(payments.map((payment) => payment.order_id)));

  const ordersResult = orderIds.length
    ? await supabase
        .from("retail_pos_orders")
        .select(
          "id, tenant_id, folio, origin_local_folio, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, direct_discount_cents, order_discount_cents, total_cents, paid_at, voided_at, void_reason, cancelled_at, cancel_reason, created_at",
        )
        .eq("tenant_id", params.tenantId)
        .in("id", orderIds)
        .returns<RetailPosZReportOrderRow[]>()
    : { data: [] as RetailPosZReportOrderRow[], error: null };

  if (ordersResult.error) {
    throw new Error(`Unable to load retail orders for Z report: ${ordersResult.error.message}`);
  }

  const orders = ordersResult.data ?? [];
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const missingOrderIds = orderIds.filter((orderId) => !orderById.has(orderId));

  if (missingOrderIds.length > 0) {
    warnings.push({
      code: "missing_orders",
      message: `Se omitieron ${missingOrderIds.length} pagos porque sus órdenes no pudieron cargarse.`,
    });
  }

  const validOrderIds = orderIds.filter((orderId) => orderById.has(orderId));
  const linesResult = validOrderIds.length
    ? await supabase
        .from("retail_pos_order_lines")
        .select("order_id, quantity")
        .eq("tenant_id", params.tenantId)
        .in("order_id", validOrderIds)
        .returns<RetailPosZReportOrderLineRow[]>()
    : { data: [] as RetailPosZReportOrderLineRow[], error: null };

  if (linesResult.error) {
    throw new Error(`Unable to load retail order lines for Z report: ${linesResult.error.message}`);
  }

  const lines = linesResult.data ?? [];
  const postSaleDocuments = (postSaleDocumentsResult.data ?? []).filter(
    (document) =>
      document.status === "completed" && getCanonicalPostSaleDocumentType(document.document_type) !== null,
  );
  const saleVoidDocuments = postSaleDocuments.filter((document) => isSaleCancellationDocument(document));
  const returnDocuments = postSaleDocuments.filter(
    (document) => document.document_type === "return_full" || document.document_type === "return_partial",
  );
  const fullReturnDocuments = returnDocuments.filter((document) => document.document_type === "return_full");
  const partialReturnDocuments = returnDocuments.filter((document) => document.document_type === "return_partial");
  const postSaleRefunds = postSaleRefundsResult.data ?? [];
  const ticketEvents = ticketEventsResult.data ?? [];
  const cashPayments = payments.filter((payment) => payment.payment_method === "cash");
  const cardPayments = payments.filter((payment) => payment.payment_method === "card");
  const cashSalesCents = cashPayments.reduce((sum, payment) => sum + payment.amount_cents, 0);
  const cardSalesCents = cardPayments.reduce((sum, payment) => sum + payment.amount_cents, 0);
  const documentById = new Map(postSaleDocuments.map((document) => [document.id, document]));
  const cashCancellationRefundsCents = postSaleRefunds
    .filter((refund) => {
      if (refund.status !== "completed" || refund.refund_method !== "cash") {
        return false;
      }
      const document = documentById.get(refund.post_sale_document_id);
      return document ? isSaleCancellationDocument(document) : false;
    })
    .reduce((sum, refund) => sum + refund.amount_cents, 0);
  const cashReturnRefundsCents = postSaleRefunds
    .filter((refund) => {
      if (refund.status !== "completed" || refund.refund_method !== "cash") {
        return false;
      }
      const document = documentById.get(refund.post_sale_document_id);
      return document
        ? document.document_type === "return_full" || document.document_type === "return_partial"
        : false;
    })
    .reduce((sum, refund) => sum + refund.amount_cents, 0);
  const cashRefundsCents = cashCancellationRefundsCents + cashReturnRefundsCents;
  const cardRefundsCompletedCents = postSaleRefunds
    .filter((refund) => refund.status === "completed" && refund.refund_method === "card_external")
    .reduce((sum, refund) => sum + refund.amount_cents, 0);
  const cardRefundsPendingCents = postSaleRefunds
    .filter((refund) => refund.status === "pending" && refund.refund_method === "card_external")
    .reduce((sum, refund) => sum + refund.amount_cents, 0);
  const totalSalesCents = cashSalesCents + cardSalesCents;
  const paidOrders = validOrderIds
    .map((orderId) => orderById.get(orderId))
    .filter((order): order is RetailPosZReportOrderRow => Boolean(order));
  const paidOrdersCount = paidOrders.length;
  const averageTicketCents =
    paidOrdersCount > 0
      ? Math.round(paidOrders.reduce((sum, order) => sum + order.total_cents, 0) / paidOrdersCount)
      : 0;

  const persistedExpectedCashCents = shift.expected_cash_cents;
  const expectedCashCents = shift.opening_float_cents + cashSalesCents - cashRefundsCents;
  if (persistedExpectedCashCents === null) {
    warnings.push({
      code: "expected_cash_recalculated",
      message: "El efectivo esperado no estaba persistido y se recalculó desde fondo inicial + pagos en efectivo - reembolsos en efectivo.",
    });
  }
  if (
    typeof persistedExpectedCashCents === "number" &&
    persistedExpectedCashCents !== expectedCashCents
  ) {
    warnings.push({
      code: "expected_cash_adjusted_for_refunds",
      message: "El efectivo esperado se ajustó para reflejar reembolsos en efectivo del turno.",
    });
  }

  const differenceCents =
    typeof shift.difference_cents === "number"
      ? shift.difference_cents
      : typeof shift.declared_cash_cents === "number"
        ? shift.declared_cash_cents - expectedCashCents
        : null;
  if (shift.difference_cents === null && typeof shift.declared_cash_cents === "number") {
    warnings.push({
      code: "difference_recalculated",
      message: "La diferencia no estaba persistida y se recalculó desde efectivo declarado - efectivo esperado.",
    });
  }

  if (payments.length === 0) {
    warnings.push({
      code: "shift_without_payments",
      message: "Este turno no tiene pagos asociados. El Reporte Z v1 se muestra con montos en cero.",
    });
  }

  if (!settingsResult.data) {
    warnings.push({
      code: "missing_device_role",
      message: "No se encontró configuración activa de rol para la terminal del turno.",
    });
  }

  const printAudit = buildAudit(ticketEvents);
  const postSalePrintEvents = ticketEvents.filter((event) => event.ticket_type === "post_sale");
  const printEvidenceStatus =
    postSalePrintEvents.length === 0
      ? "no_evidence"
      : postSalePrintEvents.some((event) => event.event_type === "print_failed")
        ? postSalePrintEvents.some((event) =>
            event.event_type === "printed" || event.event_type === "reprinted",
          )
          ? "mixed"
          : "print_failed"
        : postSalePrintEvents.some((event) => event.event_type === "reprinted")
          ? "reprinted"
          : "printed";

  return {
    tenantId: params.tenantId,
    tenantName: tenantResult.data?.name ?? null,
    cashShiftId: shift.id,
    status: shift.status,
    deviceId: shift.device_id,
    deviceName: deviceResult.data?.name ?? null,
    deviceRole: settingsResult.data?.device_role ?? null,
    openedAt: shift.opened_at,
    closedAt: shift.closed_at,
    generatedAt: new Date().toISOString(),
    openedByPosUserId: shift.opened_by_pos_user_id,
    openedByName: userById.get(shift.opened_by_pos_user_id)?.name ?? null,
    closedByPosUserId: shift.closed_by_pos_user_id,
    closedByName: shift.closed_by_pos_user_id ? userById.get(shift.closed_by_pos_user_id)?.name ?? null : null,
    openingFloatCents: shift.opening_float_cents,
    cashSalesCents,
    cardSalesCents,
    totalSalesCents,
    expectedCashCents,
    declaredCashCents: shift.declared_cash_cents,
    differenceCents,
    paymentsCount: payments.length,
    paidOrdersCount,
    averageTicketCents,
    closingNote: shift.closing_note,
    future: {
      discountsCents: paidOrders.reduce((sum, order) => sum + order.discount_cents, 0),
      cancellationsCount: saleVoidDocuments.length,
      cancellationsAmountCents: saleVoidDocuments.reduce(
        (sum, document) => sum + document.net_amount_cents,
        0,
      ),
      fullReturnsCount: fullReturnDocuments.length,
      partialReturnsCount: partialReturnDocuments.length,
      returnedAmountCents: returnDocuments.reduce((sum, document) => sum + document.net_amount_cents, 0),
      commercialNetCents:
        paidOrders.reduce((sum, order) => sum + order.total_cents, 0) -
        saleVoidDocuments.reduce((sum, document) => sum + document.net_amount_cents, 0) -
        returnDocuments.reduce((sum, document) => sum + document.net_amount_cents, 0),
      cancellationRefundsCashCents: cashCancellationRefundsCents,
      cancellationRefundsCardCents: cardRefundsCompletedCents,
      returnRefundsCashCents: cashReturnRefundsCents,
      returnRefundsCardCompletedCents: cardRefundsCompletedCents,
      returnRefundsCardPendingCents: cardRefundsPendingCents,
      returnsCount: returnDocuments.length,
      returnsAmountCents: returnDocuments.reduce((sum, document) => sum + document.net_amount_cents, 0),
      pendingSyncPaymentsCount: null,
      pendingSyncAmountCents: null,
    },
    printEvidence: {
      status: printEvidenceStatus,
      printedCount: printAudit.postSalePrintedCount,
      reprintedCount: printAudit.postSaleReprintedCount,
      failedCount: postSalePrintEvents.filter((event) => event.event_type === "print_failed").length,
      note:
        postSalePrintEvents.length === 0
          ? "No hay evidencia registrada de impresión de comprobantes postventa para este turno."
          : "La evidencia refleja comprobantes postventa registrados en retail_pos_ticket_events.",
    },
    paymentMethods: [
      {
        method: "cash",
        paymentsCount: cashPayments.length,
        totalCents: cashSalesCents,
      },
      {
        method: "card",
        paymentsCount: cardPayments.length,
        totalCents: cardSalesCents,
      },
    ],
    orders: paidOrders
      .map((order) => {
        const firstPayment = payments.find((payment) => payment.order_id === order.id) ?? null;
        return {
          orderId: order.id,
          folio: order.folio,
          paidAt: order.paid_at,
          totalCents: order.total_cents,
          paymentMethod: firstPayment?.payment_method ?? null,
        };
      })
      .sort((left, right) => (right.paidAt ?? "").localeCompare(left.paidAt ?? "")),
    linesSummary: {
      soldLinesCount: lines.length,
      soldUnits: lines.reduce((sum, line) => sum + parseQuantity(line.quantity), 0),
    },
    warnings,
  };
}
