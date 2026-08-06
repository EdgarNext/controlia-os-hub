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
  type PriceTierEconomicLine,
} from "./price-tier-economics";
import {
  buildRetailPosCashFinancialSummary,
  getCanonicalCashTransactionIds,
  type CashFinancialCashMovement,
  type CashFinancialRefundComponent,
  type CashFinancialTransaction,
} from "./cash-financial-summary";
import { buildPostSaleReportSummary } from "./post-sale-report-summary";

type RetailReportsFiltersInput = {
  dateFrom?: string | null;
  dateTo?: string | null;
  deviceId?: string | null;
  orderStatus?: "all" | "pending_payment" | "paid" | "voided" | null;
  priceTier?: "all" | "public" | "wholesale" | "mixed" | "unknown" | null;
  detailPageSize?: number | null;
  detailCursor?: string | null;
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
  refundMethod?: "all" | "cash" | "card_external" | "store_credit_future" | "mixed" | null;
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
  refundMethod: "all" | RetailPosPostSaleRefundMethod | "mixed";
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
  approved_price_tier_source: string | null;
  approved_unit_price_cents: number | null;
  approved_by_pos_user_id: string | null;
  approved_at: string | null;
  direct_discount_cents: number | null;
  order_discount_allocation_cents: number | null;
  unit_cost_snapshot_cents: number | null;
};

function toPriceTierEconomicLine(line: RetailOrderLineRow): PriceTierEconomicLine {
  return {
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
  };
}

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
  payment_transaction_id: string | null;
  payment_sequence: number | null;
};

type RetailPaymentTransactionRow = CashFinancialTransaction & {
  tenant_id: string;
  expected_order_revision: number;
};

type RetailPaymentApplicationRow = {
  id: string;
  payment_transaction_id: string;
  order_id: string;
  amount_cents: number;
};

type RetailCashMovementRow = CashFinancialCashMovement & {
  tenant_id: string;
  post_sale_document_id: string | null;
  post_sale_refund_id: string | null;
  occurred_at: string;
};

type RetailRefundComponentRow = CashFinancialRefundComponent & {
  tenant_id: string;
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
  original_payment_transaction_id?: string | null;
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

export type RetailSalesLineDetail = {
  lineId: string;
  productName: string;
  sku: string | null;
  quantity: string | number;
  unitLabel: string;
  publicUnitPriceSnapshotCents: number | null;
  wholesaleUnitPriceSnapshotCents: number | null;
  appliedUnitPriceCents: number | null;
  approvedPriceTier: PriceTier | null;
  priceTierDifferenceCents: number | null;
  directDiscountCents: number;
  orderDiscountAllocationCents: number;
  totalDiscountCents: number;
  historicalCostCents: number | null;
  grossMarginCents: number | null;
  requestedByName: string | null;
  approvedByName: string | null;
  approvedPriceTierSource: string | null;
};

export type RetailReportDetailMeta = {
  totalCount: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor: string | null;
  previousCursor: string | null;
};

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
    paidOutsideShiftCount: number;
    paidOutsideShiftCents: number;
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
  financialSummary: ReturnType<typeof buildRetailPosCashFinancialSummary>;
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
    paymentMethod: "cash" | "card" | "mixed" | null;
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
    lineDetails?: RetailSalesLineDetail[];
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
  financialSummary: ReturnType<typeof buildRetailPosCashFinancialSummary>;
  closingNote: string | null;
};

export type RetailCashShiftReport = {
  filters: RetailReportsFilters;
  devices: RetailDeviceOption[];
  rows: RetailCashShiftReportRow[];
  openRows: RetailCashShiftReportRow[];
  closedRows: RetailCashShiftReportRow[];
  financialSummary: ReturnType<typeof buildRetailPosCashFinancialSummary>;
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
    cancellation_documents_count?: number;
    completed_documents_count?: number;
    pending_documents_count?: number;
    cash_only_cancellations_count?: number;
    card_only_cancellations_count?: number;
    mixed_cancellations_count?: number;
    total_cancelled_cents?: number;
    completed_cash_refunds_cents?: number;
    completed_card_refunds_cents?: number;
    pending_card_refunds_cents?: number;
    completed_refunds_cents?: number;
    pending_refunds_cents?: number;
    refund_components_count?: number;
    cash_components_count?: number;
    card_components_count?: number;
    reconciliation?: {
      component_totals_match_documents: boolean;
      completed_cash_matches_cash_movements: boolean;
      completed_documents_have_no_pending_components: boolean;
    };
    warnings?: string[];
  };
  refundBreakdown: Array<{
    key: "cash_completed" | "card_completed" | "card_pending" | "failed";
    label: string;
    refundStatus: RetailPosPostSaleRefundStatus;
    refundMethod: RetailPosPostSaleRefundMethod | "mixed" | null;
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
    originalPaymentMethod?: "cash" | "card" | "mixed" | "unknown";
    responsibleUserName: string | null;
    responsibleUserId: string | null;
    reasonCode: string;
    comment: string | null;
    commercialAmountCents: number;
    refundAmountCents: number | null;
    refundMethod: RetailPosPostSaleRefundMethod | "mixed" | null;
    refundStatus: RetailPosPostSaleRefundStatus | null;
    externalReference: string | null;
    cashShiftId: string | null;
    lineCount: number;
    quantityReturned: number;
    componentCount?: number;
    cashReturnedCents?: number;
    cardCompletedCents?: number;
    cardPendingCents?: number;
    hasModernComponents?: boolean;
    coverageLabel?: "Componentes modernos" | "Registro histórico";
  }>;
};

export type RetailSalesReport = {
  filters: RetailReportsFilters;
  devices: RetailDeviceOption[];
  summary: RetailReportsOverview["summary"];
  discountBreakdown: RetailReportsOverview["discountBreakdown"];
  orders: RetailReportsOverview["recentOrders"];
  detailMeta: RetailReportDetailMeta;
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

function normalizeDetailPageSize(value: number | null | undefined) {
  return value === 50 || value === 100 ? value : 25;
}

type RetailDetailCursor = {
  paidAt: string | null;
  orderId: string;
  direction: "next" | "previous";
};

function encodeRetailDetailCursor(cursor: RetailDetailCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeRetailDetailCursor(value: string | null | undefined): RetailDetailCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<RetailDetailCursor>;
    if ((parsed.direction !== "next" && parsed.direction !== "previous") || typeof parsed.orderId !== "string") {
      return null;
    }
    return { paidAt: typeof parsed.paidAt === "string" ? parsed.paidAt : null, orderId: parsed.orderId, direction: parsed.direction };
  } catch {
    return null;
  }
}

function compareRetailDetailOrders(left: { paidAt: string | null; orderId: string }, right: { paidAt: string | null; orderId: string }) {
  const leftPaidAt = left.paidAt ?? "";
  const rightPaidAt = right.paidAt ?? "";
  return rightPaidAt.localeCompare(leftPaidAt) || right.orderId.localeCompare(left.orderId);
}

function paginateRetailDetailOrders<T extends { paidAt: string | null; orderId: string }>(orders: T[], pageSize: number, cursorValue: string | null | undefined) {
  const sorted = [...orders].sort(compareRetailDetailOrders);
  const cursor = decodeRetailDetailCursor(cursorValue);
  let start = 0;
  if (cursor) {
    const anchor = sorted.findIndex((order) => order.orderId === cursor.orderId && order.paidAt === cursor.paidAt);
    if (anchor >= 0) {
      start = cursor.direction === "previous" ? Math.max(0, anchor - pageSize) : anchor + 1;
    }
  }
  const page = sorted.slice(start, start + pageSize);
  const first = page[0];
  const last = page[page.length - 1];
  return {
    page,
    meta: {
      totalCount: sorted.length,
      pageSize,
      hasNextPage: start + page.length < sorted.length,
      hasPreviousPage: start > 0,
      nextCursor: last && start + page.length < sorted.length ? encodeRetailDetailCursor({ paidAt: last.paidAt, orderId: last.orderId, direction: "next" }) : null,
      previousCursor: first && start > 0 ? encodeRetailDetailCursor({ paidAt: first.paidAt, orderId: first.orderId, direction: "previous" }) : null,
    },
  };
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
): "all" | RetailPosPostSaleRefundMethod | "mixed" {
  if (value === "cash" || value === "card_external" || value === "store_credit_future" || value === "mixed") {
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
    paymentTransactionsResult,
    paymentApplicationsResult,
    refundComponentsResult,
    cashMovementsResult,
    postSaleLinesResult,
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
        .or(`and(voided_at.gte.${startIso},voided_at.lt.${endIso}),and(cancelled_at.gte.${startIso},cancelled_at.lt.${endIso})`)
        .order("created_at", { ascending: false })
        .returns<RetailOrderRow[]>(),
      supabase
        .from("retail_pos_payments")
        .select(
          "id, order_id, cash_shift_id, device_id, pos_user_id, payment_method, amount_cents, received_amount_cents, change_cents, paid_at, payment_transaction_id, payment_sequence",
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
        .lte("opened_at", endIso)
        .or(`closed_at.is.null,closed_at.gte.${startIso}`)
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
      supabase
        .from("retail_pos_payment_transactions")
        .select("id, tenant_id, total_applied_cents, cash_shift_id, expected_order_revision")
        .eq("tenant_id", tenantId)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .returns<RetailPaymentTransactionRow[]>(),
      supabase
        .from("retail_pos_order_payment_applications")
        .select("id, payment_transaction_id, order_id, amount_cents")
        .eq("tenant_id", tenantId)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .returns<RetailPaymentApplicationRow[]>(),
      supabase
        .from("retail_pos_post_sale_refund_components")
        .select("id, tenant_id, post_sale_document_id, refund_method, amount_cents, status")
        .eq("tenant_id", tenantId)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .returns<RetailRefundComponentRow[]>(),
      supabase
        .from("retail_pos_cash_movements")
        .select("id, tenant_id, cash_shift_id, post_sale_document_id, post_sale_refund_id, movement_type, amount_cents, occurred_at")
        .eq("tenant_id", tenantId)
        .gte("occurred_at", startIso)
        .lt("occurred_at", endIso)
        .returns<RetailCashMovementRow[]>(),
      supabase
        .from("retail_pos_post_sale_lines")
        .select("id, post_sale_document_id, original_order_line_id, line_number, quantity_returned_now, returned_gross_amount_cents, returned_total_discount_cents, returned_net_amount_cents")
        .eq("tenant_id", tenantId)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .returns<RetailPostSaleLineRow[]>(),
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
  if (paymentTransactionsResult.error) {
    throw new Error(`Unable to load retail payment transactions report: ${paymentTransactionsResult.error.message}`);
  }
  if (paymentApplicationsResult.error) {
    throw new Error(`Unable to load retail payment applications report: ${paymentApplicationsResult.error.message}`);
  }
  if (refundComponentsResult.error) {
    throw new Error(`Unable to load retail refund components report: ${refundComponentsResult.error.message}`);
  }
  if (cashMovementsResult.error) {
    throw new Error(`Unable to load retail cash movements report: ${cashMovementsResult.error.message}`);
  }
  if (postSaleLinesResult.error) {
    throw new Error(`Unable to load retail post sale lines report: ${postSaleLinesResult.error.message}`);
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
          "id, order_id, line_number, product_id, product_variant_id, product_name, variant_name, sku, sales_unit_label, quantity, unit_price_cents, public_unit_price_snapshot_cents, wholesale_unit_price_snapshot_cents, requested_price_tier, price_tier_request_status, requested_by_pos_user_id, requested_at, approved_price_tier, approved_price_tier_source, approved_unit_price_cents, approved_by_pos_user_id, approved_at, line_subtotal_cents, direct_discount_cents, order_discount_allocation_cents, total_discount_cents, unit_cost_snapshot_cents, line_total_cents, below_cost_after_discount",
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
      return classifyPriceTier((linesByOrderId.get(order.id) ?? []).map(toPriceTierEconomicLine)) === filters.priceTier;
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
    paymentTransactions: paymentTransactionsResult.data ?? [],
    paymentApplications: paymentApplicationsResult.data ?? [],
    refundComponents: refundComponentsResult.data ?? [],
    cashMovements: cashMovementsResult.data ?? [],
    postSaleLines: postSaleLinesResult.data ?? [],
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
  const canonicalTransactionIds = getCanonicalCashTransactionIds(data.paymentTransactions, data.paymentApplications);
  const canonicalPayments = data.payments.filter(
    (payment) => !payment.payment_transaction_id || canonicalTransactionIds.has(payment.payment_transaction_id),
  );
  const canonicalPaidOrderIds = new Set(canonicalPayments.map((payment) => payment.order_id));
  const paidOrders = data.orders.filter((order) => order.status === "paid" && canonicalPaidOrderIds.has(order.id));
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
  const paymentMethods = buildPaymentMethodSummary(canonicalPayments);
  const overviewTransactionIds = new Set(
    canonicalPayments.map((payment) => payment.payment_transaction_id).filter((id): id is string => Boolean(id)),
  );
  const overviewShiftIds = new Set(canonicalPayments.map((payment) => payment.cash_shift_id));
  const knownShiftIds = new Set(data.shifts.map((shift) => shift.id));
  const paidOutsideShiftOrderIds = new Set(
    canonicalPayments
      .filter((payment) => !knownShiftIds.has(payment.cash_shift_id))
      .map((payment) => payment.order_id),
  );
  const overviewLegacyTransactions: CashFinancialTransaction[] = canonicalPayments
    .filter((payment) => !payment.payment_transaction_id)
    .map((payment) => ({
      id: `legacy:${payment.id}`,
      total_applied_cents: payment.amount_cents,
      cash_shift_id: payment.cash_shift_id,
    }));
  const overviewRefundComponents: CashFinancialRefundComponent[] = data.postSaleDocuments.flatMap((document) => {
    const components = data.refundComponents.filter((component) => component.post_sale_document_id === document.id);
    if (components.length > 0) {
      return components as CashFinancialRefundComponent[];
    }

    return data.postSaleRefunds
      .filter((refund) => refund.post_sale_document_id === document.id)
      .flatMap((refund) => {
        const status = refund.status === "pending" ? "pending_external_confirmation" : refund.status;
        if (status !== "completed" && status !== "pending_external_confirmation" && status !== "failed" && status !== "cancelled") {
          return [];
        }

        return [{
          id: `legacy:${refund.id}`,
          post_sale_document_id: document.id,
          cash_shift_id: refund.cash_shift_id,
          refund_method: (refund.refund_method === "card_external" ? "card" : "cash") as "cash" | "card",
          amount_cents: refund.amount_cents,
          status,
        }];
      });
  });
  const overviewFinancialSummary = buildRetailPosCashFinancialSummary({
    opening_float_cents: data.shifts
      .filter((shift) => overviewShiftIds.has(shift.id))
      .reduce((sum, shift) => sum + shift.opening_float_cents, 0),
    transactions: [
      ...data.paymentTransactions.filter((transaction) => overviewTransactionIds.has(transaction.id)),
      ...overviewLegacyTransactions,
    ],
    applications: data.paymentApplications.filter((application) => overviewTransactionIds.has(application.payment_transaction_id)),
    tenders: canonicalPayments.map((payment) => ({
      ...payment,
      payment_transaction_id: payment.payment_transaction_id ?? `legacy:${payment.id}`,
    })),
    refund_components: overviewRefundComponents,
    cash_movements: data.cashMovements.filter((movement) => overviewShiftIds.has(movement.cash_shift_id)),
  });
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
    });

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
      paidOutsideShiftCount: paidOutsideShiftOrderIds.size,
      paidOutsideShiftCents: paidOrders
        .filter((order) => paidOutsideShiftOrderIds.has(order.id))
        .reduce((sum, order) => sum + order.total_cents, 0),
      wholesaleSalesCount: paidOrders.filter((order) => {
        const tier = classifyPriceTier(linesByOrderIdForBuild(data.lines, order.id).map(toPriceTierEconomicLine));
        return tier === "wholesale" || tier === "mixed";
      }).length,
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
    financialSummary: overviewFinancialSummary,
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
      const orderPayments = data.paymentsByOrderId.get(order.id) ?? [];
      const paymentMethod: "cash" | "card" | "mixed" | null = orderPayments.some((payment) => payment.payment_method === "card")
        ? orderPayments.some((payment) => payment.payment_method === "cash") ? "mixed" : "card"
        : orderPayments.some((payment) => payment.payment_method === "cash") ? "cash" : null;
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
        paymentMethod,
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
        priceTier: classifyPriceTier(soldLines.filter((line) => line.order_id === order.id).map(toPriceTierEconomicLine)),
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
  const canonicalTransactionIds = getCanonicalCashTransactionIds(data.paymentTransactions, data.paymentApplications);
  const rows = data.shifts.map((shift) => {
    const payments = (data.paymentsByShiftId.get(shift.id) ?? []).filter(
      (payment) => !payment.payment_transaction_id || canonicalTransactionIds.has(payment.payment_transaction_id),
    );
    const shiftTransactions = data.paymentTransactions.filter(
      (transaction) => transaction.cash_shift_id === shift.id && canonicalTransactionIds.has(transaction.id),
    );
    const shiftOrderIds = [...new Set(payments.map((payment) => payment.order_id))];
    const shiftOrders = shiftOrderIds
      .map((orderId) => data.orders.find((order) => order.id === orderId))
      .filter((order): order is RetailOrderRow => Boolean(order));
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
    const shiftDocumentIds = new Set(shiftPostSaleDocuments.map((document) => document.id));
    const componentDocumentIds = new Set(
      data.refundComponents
        .filter((component) => shiftDocumentIds.has(component.post_sale_document_id))
        .map((component) => component.post_sale_document_id),
    );
    const legacyRefundComponents: CashFinancialRefundComponent[] = shiftPostSaleRefunds.flatMap((refund) => {
      if (componentDocumentIds.has(refund.post_sale_document_id)) return [];
      const status = refund.status === "pending" ? "pending_external_confirmation" : refund.status;
      if (status !== "completed" && status !== "pending_external_confirmation" && status !== "failed" && status !== "cancelled") return [];
      return [{
        id: `legacy:${refund.id}`,
        post_sale_document_id: refund.post_sale_document_id,
        cash_shift_id: shift.id,
        refund_method: (refund.refund_method === "card_external" ? "card" : "cash") as "cash" | "card",
        amount_cents: refund.amount_cents,
        status,
      }];
    });
    const shiftRefundComponents: CashFinancialRefundComponent[] = [
      ...data.refundComponents.filter((component) => shiftDocumentIds.has(component.post_sale_document_id)),
      ...legacyRefundComponents,
    ];
    const financialSummary = buildRetailPosCashFinancialSummary({
      opening_float_cents: shift.opening_float_cents,
      transactions: [
        ...shiftTransactions,
        ...payments
          .filter((payment) => !payment.payment_transaction_id)
          .map((payment) => ({ id: `legacy:${payment.id}`, total_applied_cents: payment.amount_cents, cash_shift_id: shift.id })),
      ],
      applications: data.paymentApplications.filter((application) => canonicalTransactionIds.has(application.payment_transaction_id)),
      tenders: payments.map((payment) => ({
        ...payment,
        payment_transaction_id: payment.payment_transaction_id ?? `legacy:${payment.id}`,
      })),
      refund_components: [
        ...shiftRefundComponents,
      ],
      cash_movements: data.cashMovements.filter((movement) => movement.cash_shift_id === shift.id),
    });
    const canonicalOrdersCount = financialSummary.sales_count;
    const canonicalGrossSalesCents = financialSummary.gross_sales_cents;
    const cashSalesCents = financialSummary.cash_sales_cents;
    const cardSalesCents = financialSummary.card_sales_cents;
    const completedCashComponents = shiftRefundComponents.filter(
      (component) => component.refund_method === "cash" && component.status === "completed",
    );
    const completedCardComponents = shiftRefundComponents.filter(
      (component) => component.refund_method === "card" && component.status === "completed",
    );
    const pendingCardComponents = shiftRefundComponents.filter(
      (component) => component.refund_method === "card" && component.status === "pending_external_confirmation",
    );
    const cashCancellationRefundsCents = completedCashComponents
      .filter((component) => isSaleCancellationDocument(shiftDocumentById.get(component.post_sale_document_id)!))
      .reduce((sum, component) => sum + component.amount_cents, 0);
    const cashReturnRefundsCents = completedCashComponents
      .filter((component) => {
        const document = shiftDocumentById.get(component.post_sale_document_id);
        return document?.document_type === "return_full" || document?.document_type === "return_partial";
      })
      .reduce((sum, component) => sum + component.amount_cents, 0);
    const cashRefundsCents = financialSummary.completed_cash_refunds_cents;
    const cashRefundsCount = completedCashComponents.length;
    const cardRefundsCompletedCount = completedCardComponents.length;
    const cardRefundsCompletedCents = financialSummary.completed_card_refunds_cents;
    const cardRefundsPendingCount = pendingCardComponents.length;
    const cardRefundsPendingCents = financialSummary.pending_card_refunds_cents;
    const cardRefundsCents = cardRefundsCompletedCents;
    const expectedCashCents = financialSummary.expected_cash_cents;
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
      grossSalesCents: canonicalGrossSalesCents,
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
      totalSalesCents: financialSummary.gross_sales_cents,
      paymentsCount: payments.length,
      ordersCount: canonicalOrdersCount,
      financialSummary,
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
  const financialSummary = rows.reduce<ReturnType<typeof buildRetailPosCashFinancialSummary>>(
    (total, row) => ({
      sales_count: total.sales_count + row.financialSummary.sales_count,
      payment_transactions_count: total.payment_transactions_count + row.financialSummary.payment_transactions_count,
      tenders_count: total.tenders_count + row.financialSummary.tenders_count,
      cash_only_sales_count: total.cash_only_sales_count + row.financialSummary.cash_only_sales_count,
      card_only_sales_count: total.card_only_sales_count + row.financialSummary.card_only_sales_count,
      mixed_sales_count: total.mixed_sales_count + row.financialSummary.mixed_sales_count,
      cash_tenders_count: total.cash_tenders_count + row.financialSummary.cash_tenders_count,
      card_tenders_count: total.card_tenders_count + row.financialSummary.card_tenders_count,
      gross_sales_cents: total.gross_sales_cents + row.financialSummary.gross_sales_cents,
      cash_sales_cents: total.cash_sales_cents + row.financialSummary.cash_sales_cents,
      card_sales_cents: total.card_sales_cents + row.financialSummary.card_sales_cents,
      cash_received_cents: total.cash_received_cents + row.financialSummary.cash_received_cents,
      cash_change_cents: total.cash_change_cents + row.financialSummary.cash_change_cents,
      completed_cash_refunds_cents: total.completed_cash_refunds_cents + row.financialSummary.completed_cash_refunds_cents,
      completed_card_refunds_cents: total.completed_card_refunds_cents + row.financialSummary.completed_card_refunds_cents,
      pending_card_refunds_cents: total.pending_card_refunds_cents + row.financialSummary.pending_card_refunds_cents,
      completed_refunds_cents: total.completed_refunds_cents + row.financialSummary.completed_refunds_cents,
      pending_refunds_cents: total.pending_refunds_cents + row.financialSummary.pending_refunds_cents,
      settled_net_sales_cents: total.settled_net_sales_cents + row.financialSummary.settled_net_sales_cents,
      opening_float_cents: total.opening_float_cents + row.financialSummary.opening_float_cents,
      other_cash_in_cents: total.other_cash_in_cents + row.financialSummary.other_cash_in_cents,
      other_cash_out_cents: total.other_cash_out_cents + row.financialSummary.other_cash_out_cents,
      expected_cash_cents: total.expected_cash_cents + row.financialSummary.expected_cash_cents,
      expected_cash_variation_cents: (total.expected_cash_variation_cents ?? 0) + (row.financialSummary.expected_cash_variation_cents ?? 0),
      reconciliation: {
        tender_total_matches_sales: total.reconciliation.tender_total_matches_sales && row.financialSummary.reconciliation.tender_total_matches_sales,
        application_total_matches_sales: (total.reconciliation.application_total_matches_sales ?? true) && (row.financialSummary.reconciliation.application_total_matches_sales ?? true),
        received_less_change_matches_cash_sales: total.reconciliation.received_less_change_matches_cash_sales && row.financialSummary.reconciliation.received_less_change_matches_cash_sales,
        cash_components_match_cash_movements: total.reconciliation.cash_components_match_cash_movements && row.financialSummary.reconciliation.cash_components_match_cash_movements,
      },
      warnings: [...total.warnings, ...row.financialSummary.warnings],
    }),
    {
      sales_count: 0,
      payment_transactions_count: 0,
      tenders_count: 0,
      cash_only_sales_count: 0,
      card_only_sales_count: 0,
      mixed_sales_count: 0,
      cash_tenders_count: 0,
      card_tenders_count: 0,
      gross_sales_cents: 0,
      cash_sales_cents: 0,
      card_sales_cents: 0,
      cash_received_cents: 0,
      cash_change_cents: 0,
      completed_cash_refunds_cents: 0,
      completed_card_refunds_cents: 0,
      pending_card_refunds_cents: 0,
      completed_refunds_cents: 0,
      pending_refunds_cents: 0,
      settled_net_sales_cents: 0,
      opening_float_cents: 0,
      other_cash_in_cents: 0,
      other_cash_out_cents: 0,
      expected_cash_cents: 0,
      expected_cash_variation_cents: 0,
      reconciliation: {
        tender_total_matches_sales: true,
        application_total_matches_sales: true,
        received_less_change_matches_cash_sales: true,
        cash_components_match_cash_movements: true,
      },
      warnings: [],
    },
  );

  return {
    filters: data.filters,
    devices: data.devices,
    rows,
    openRows,
    closedRows,
    financialSummary,
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

export async function getLegacyRetailPostSaleReport(
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

export async function getRetailPostSaleReport(
  tenantId: string,
  filtersInput?: RetailPostSaleReportFiltersInput,
): Promise<RetailPostSaleReport> {
  const filters = buildPostSaleFilters(filtersInput);
  const data = await loadBaseRetailReportData(tenantId, {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });
  const originalOrderById = new Map(data.orders.map((order) => [order.id, order]));
  const summary = buildPostSaleReportSummary({
    documents: data.postSaleDocuments.map((document) => ({
      ...document,
      original_folio: originalOrderById.get(document.original_order_id)?.folio ?? "Sin folio",
      cash_shift_id: document.cash_shift_id,
      responsible_user_name: document.created_by_pos_user_id
        ? data.userById.get(document.created_by_pos_user_id)?.name ?? null
        : null,
    })),
    legacyRefunds: data.postSaleRefunds,
    components: data.refundComponents,
    payments: data.payments.map((payment) => ({ order_id: payment.order_id, payment_method: payment.payment_method })),
    cashMovements: data.cashMovements.filter((movement) => isWithinRange(movement.occurred_at, data.startIso, data.endIso)).map((movement) => ({
      post_sale_document_id: movement.post_sale_document_id,
      amount_cents: movement.amount_cents,
    })),
    lines: data.postSaleLines,
    filters: {
      operationType: filters.operationType,
      refundStatus: filters.refundStatus,
      refundMethod: filters.refundMethod,
      reasonCode: filters.reasonCode,
      responsibleUserId: filters.responsibleUserId,
    },
  });
  const byReason = [...new Map(summary.rows.map((row) => [row.reasonCode, row])).values()].map((row) => ({
    reasonCode: row.reasonCode,
    operationsCount: summary.rows.filter((candidate) => candidate.reasonCode === row.reasonCode).length,
    totalAmountCents: summary.rows.filter((candidate) => candidate.reasonCode === row.reasonCode)
      .reduce((total, candidate) => total + candidate.commercialAmountCents, 0),
  })).sort((left, right) => right.totalAmountCents - left.totalAmountCents);
  const byResponsibleUser = [...new Map(summary.rows.map((row) => [row.responsibleUserId ?? "unknown", row])).values()].map((row) => ({
    posUserId: row.responsibleUserId,
    posUserName: row.responsibleUserName,
    cancelledSalesCount: summary.rows.filter((candidate) => candidate.responsibleUserId === row.responsibleUserId && candidate.operationType === "sale_cancellation").length,
    returnsCount: summary.rows.filter((candidate) => candidate.responsibleUserId === row.responsibleUserId && candidate.operationType !== "sale_cancellation").length,
    operationsCount: summary.rows.filter((candidate) => candidate.responsibleUserId === row.responsibleUserId).length,
    totalAmountCents: summary.rows.filter((candidate) => candidate.responsibleUserId === row.responsibleUserId).reduce((total, candidate) => total + candidate.commercialAmountCents, 0),
  })).sort((left, right) => right.totalAmountCents - left.totalAmountCents);
  const trend = buildRetailPostSaleTrend({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    completedPostSaleDocuments: summary.rows.map((row) => ({
      createdAt: row.registeredAt,
      documentType: row.operationType,
      netAmountCents: row.commercialAmountCents,
    })),
  });
  return {
    filters,
    reasonOptions: byReason,
    responsibleUsers: byResponsibleUser.filter((row) => Boolean(row.posUserId && row.posUserName)).map((row) => ({ posUserId: row.posUserId!, posUserName: row.posUserName! })),
    summary: {
      cancelledSalesCount: summary.rows.filter((row) => row.operationType === "sale_cancellation").length,
      cancelledSalesCents: summary.rows.filter((row) => row.operationType === "sale_cancellation").reduce((total, row) => total + row.commercialAmountCents, 0),
      fullReturnsCount: summary.rows.filter((row) => row.operationType === "return_full").length,
      fullReturnsCents: summary.rows.filter((row) => row.operationType === "return_full").reduce((total, row) => total + row.commercialAmountCents, 0),
      partialReturnsCount: summary.rows.filter((row) => row.operationType === "return_partial").length,
      partialReturnsCents: summary.rows.filter((row) => row.operationType === "return_partial").reduce((total, row) => total + row.commercialAmountCents, 0),
      returnsCount: summary.rows.filter((row) => row.operationType !== "sale_cancellation").length,
      returnedCents: summary.rows.filter((row) => row.operationType !== "sale_cancellation").reduce((total, row) => total + row.commercialAmountCents, 0),
      revertedAmountCents: summary.rows.reduce((total, row) => total + row.commercialAmountCents, 0),
      completedCashRefundsCount: summary.rows.filter((row) => row.cashReturnedCents > 0).length,
      cashRefundsCompletedCents: summary.summary.completed_cash_refunds_cents,
      completedCardRefundsCount: summary.rows.filter((row) => row.cardCompletedCents > 0).length,
      cardRefundsCompletedCents: summary.summary.completed_card_refunds_cents,
      completedRefundsCount: summary.summary.completed_documents_count,
      completedRefundsCents: summary.summary.completed_refunds_cents,
      pendingRefundsCount: summary.summary.pending_documents_count,
      cardRefundsPendingCents: summary.summary.pending_card_refunds_cents,
      pendingRefundCents: summary.summary.pending_refunds_cents,
      failedRefundsCount: summary.rows.filter((row) => row.refundStatus === "failed").length,
      failedRefundCents: 0,
      cancellation_documents_count: summary.summary.cancellation_documents_count,
      completed_documents_count: summary.summary.completed_documents_count,
      pending_documents_count: summary.summary.pending_documents_count,
      cash_only_cancellations_count: summary.summary.cash_only_cancellations_count,
      card_only_cancellations_count: summary.summary.card_only_cancellations_count,
      mixed_cancellations_count: summary.summary.mixed_cancellations_count,
      total_cancelled_cents: summary.summary.total_cancelled_cents,
      completed_cash_refunds_cents: summary.summary.completed_cash_refunds_cents,
      completed_card_refunds_cents: summary.summary.completed_card_refunds_cents,
      pending_card_refunds_cents: summary.summary.pending_card_refunds_cents,
      completed_refunds_cents: summary.summary.completed_refunds_cents,
      pending_refunds_cents: summary.summary.pending_refunds_cents,
      refund_components_count: summary.summary.refund_components_count,
      cash_components_count: summary.summary.cash_components_count,
      card_components_count: summary.summary.card_components_count,
      reconciliation: summary.summary.reconciliation,
      warnings: summary.summary.warnings,
    },
    refundBreakdown: [
      { key: "cash_completed" as const, label: "Devoluciones de efectivo completadas", refundStatus: "completed" as const, refundMethod: "cash" as const, refundsCount: summary.rows.filter((row) => row.cashReturnedCents > 0).length, amountCents: summary.summary.completed_cash_refunds_cents },
      { key: "card_completed" as const, label: "Reembolsos de tarjeta confirmados", refundStatus: "completed" as const, refundMethod: "card_external" as const, refundsCount: summary.rows.filter((row) => row.cardCompletedCents > 0).length, amountCents: summary.summary.completed_card_refunds_cents },
      { key: "card_pending" as const, label: "Reembolsos de tarjeta pendientes", refundStatus: "pending" as const, refundMethod: "card_external" as const, refundsCount: summary.rows.filter((row) => row.cardPendingCents > 0).length, amountCents: summary.summary.pending_card_refunds_cents },
    ].filter((row) => row.refundsCount > 0 || row.amountCents > 0),
    refundStatusBreakdown: ["completed", "pending", "failed"].map((status) => {
      const matching = summary.rows.filter((row) => row.refundStatus === status);
      return { key: status as "completed" | "pending" | "failed", label: status === "completed" ? "Completados" : status === "pending" ? "Pendientes" : "Fallidos", refundStatus: status as "completed" | "pending" | "failed", refundsCount: matching.length, amountCents: matching.reduce((total, row) => total + row.refundAmountCents, 0), share: summary.rows.length > 0 ? matching.length / summary.rows.length : null };
    }).filter((row) => row.refundsCount > 0 || row.amountCents > 0),
    trend: { granularity: trend.granularity, points: trend.points },
    byReason,
    byResponsibleUser,
    rows: summary.rows,
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
  const detailPage = paginateRetailDetailOrders(
    overview.recentOrders,
    normalizeDetailPageSize(filtersInput?.detailPageSize),
    filtersInput?.detailCursor,
  );
  const detailOrders = detailPage.page.map((order) => ({
    ...order,
    lineDetails: data.lines
      .filter((line) => line.order_id === order.orderId)
      .sort((left, right) => left.line_number - right.line_number)
      .map((line) => {
        const economics = calculatePriceTierEconomics(toPriceTierEconomicLine(line));
        return {
          lineId: line.id,
          productName: line.product_name,
          sku: line.sku,
          quantity: line.quantity,
          unitLabel: line.sales_unit_label,
          publicUnitPriceSnapshotCents: line.public_unit_price_snapshot_cents,
          wholesaleUnitPriceSnapshotCents: line.wholesale_unit_price_snapshot_cents,
          appliedUnitPriceCents: line.approved_unit_price_cents ?? line.unit_price_cents,
          approvedPriceTier: line.approved_price_tier,
          priceTierDifferenceCents: economics.priceTierDifferenceCents,
          directDiscountCents: economics.manualLineDiscountCents,
          orderDiscountAllocationCents: economics.allocatedOrderDiscountCents,
          totalDiscountCents: line.total_discount_cents ?? 0,
          historicalCostCents: economics.costCents,
          grossMarginCents: economics.finalMarginCents,
          requestedByName: line.requested_by_pos_user_id ? data.userById.get(line.requested_by_pos_user_id)?.name ?? null : null,
          approvedByName: line.approved_by_pos_user_id ? data.userById.get(line.approved_by_pos_user_id)?.name ?? null : null,
          approvedPriceTierSource: line.approved_price_tier_source,
        };
      }),
  }));

  return {
    filters: overview.filters,
    devices: overview.devices,
    summary: overview.summary,
    discountBreakdown: overview.discountBreakdown,
    orders: detailOrders,
    detailMeta: detailPage.meta,
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
  const includedPaidOrderIds = new Set(data.orders.filter((order) => order.status === "paid").map((order) => order.id));
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
    if (!includedPaidOrderIds.has(line.order_id)) continue;
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

  const [deviceResult, settingsResult, usersResult, paymentsResult, postSaleDocumentsResult, postSaleRefundsResult, ticketEventsResult, paymentTransactionsResult, paymentApplicationsResult, refundComponentsResult, cashMovementsResult] = await Promise.all([
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
        .select("id, order_id, cash_shift_id, device_id, pos_user_id, payment_method, amount_cents, received_amount_cents, change_cents, paid_at, payment_transaction_id, payment_sequence")
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
      supabase
        .from("retail_pos_payment_transactions")
        .select("id, tenant_id, total_applied_cents, cash_shift_id, expected_order_revision")
        .eq("tenant_id", params.tenantId)
        .eq("cash_shift_id", shift.id)
        .returns<RetailPaymentTransactionRow[]>(),
      supabase
        .from("retail_pos_order_payment_applications")
        .select("id, payment_transaction_id, order_id, amount_cents")
        .eq("tenant_id", params.tenantId)
        .returns<RetailPaymentApplicationRow[]>(),
      supabase
        .from("retail_pos_post_sale_refund_components")
        .select("id, tenant_id, post_sale_document_id, refund_method, amount_cents, status")
        .eq("tenant_id", params.tenantId)
        .returns<RetailRefundComponentRow[]>(),
      supabase
        .from("retail_pos_cash_movements")
        .select("id, tenant_id, cash_shift_id, post_sale_document_id, post_sale_refund_id, movement_type, amount_cents, occurred_at")
        .eq("tenant_id", params.tenantId)
        .eq("cash_shift_id", shift.id)
        .returns<RetailCashMovementRow[]>(),
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
  if (paymentTransactionsResult.error || paymentApplicationsResult.error || refundComponentsResult.error || cashMovementsResult.error) {
    throw new Error("Unable to load retail financial evidence for Z report.");
  }

  const userById = new Map((usersResult.data ?? []).map((row) => [row.id, row]));
  const canonicalTransactionIds = getCanonicalCashTransactionIds(
    paymentTransactionsResult.data ?? [],
    paymentApplicationsResult.data ?? [],
  );
  const payments = (paymentsResult.data ?? []).filter(
    (payment) => !payment.payment_transaction_id || canonicalTransactionIds.has(payment.payment_transaction_id),
  );
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
  const zDocumentIds = new Set(postSaleDocuments.map((document) => document.id));
  const zComponentDocumentIds = new Set(
    (refundComponentsResult.data ?? [])
      .filter((component) => zDocumentIds.has(component.post_sale_document_id))
      .map((component) => component.post_sale_document_id),
  );
  const zLegacyRefundComponents: CashFinancialRefundComponent[] = postSaleRefunds.flatMap((refund) => {
    if (zComponentDocumentIds.has(refund.post_sale_document_id)) return [];
    const status = refund.status === "pending" ? "pending_external_confirmation" : refund.status;
    if (status !== "completed" && status !== "pending_external_confirmation" && status !== "failed" && status !== "cancelled") return [];
    return [{
      id: `legacy:${refund.id}`,
      post_sale_document_id: refund.post_sale_document_id,
      cash_shift_id: shift.id,
      refund_method: (refund.refund_method === "card_external" ? "card" : "cash") as "cash" | "card",
      amount_cents: refund.amount_cents,
      status,
    }];
  });
  const zFinancialSummary = buildRetailPosCashFinancialSummary({
    opening_float_cents: shift.opening_float_cents,
    transactions: [
      ...(paymentTransactionsResult.data ?? []).filter((transaction) => canonicalTransactionIds.has(transaction.id)),
      ...payments
        .filter((payment) => !payment.payment_transaction_id)
        .map((payment) => ({ id: `legacy:${payment.id}`, total_applied_cents: payment.amount_cents, cash_shift_id: shift.id })),
    ],
    applications: (paymentApplicationsResult.data ?? []).filter((application) => canonicalTransactionIds.has(application.payment_transaction_id)),
    tenders: payments.map((payment) => ({
      ...payment,
      payment_transaction_id: payment.payment_transaction_id ?? `legacy:${payment.id}`,
    })),
    refund_components: [
      ...(refundComponentsResult.data ?? []).filter((component) => zDocumentIds.has(component.post_sale_document_id)),
      ...zLegacyRefundComponents,
    ],
    cash_movements: cashMovementsResult.data ?? [],
  });
  const zRefundComponents: CashFinancialRefundComponent[] = [
    ...(refundComponentsResult.data ?? []).filter((component) => zDocumentIds.has(component.post_sale_document_id)),
    ...zLegacyRefundComponents,
  ];
  const cashPayments = payments.filter((payment) => payment.payment_method === "cash");
  const cardPayments = payments.filter((payment) => payment.payment_method === "card");
  const cashSalesCents = zFinancialSummary.cash_sales_cents;
  const cardSalesCents = zFinancialSummary.card_sales_cents;
  const documentById = new Map(postSaleDocuments.map((document) => [document.id, document]));
  const cashCancellationRefundsCents = zRefundComponents
    .filter((component) => component.refund_method === "cash" && component.status === "completed")
    .filter((component) => isSaleCancellationDocument(documentById.get(component.post_sale_document_id)!))
    .reduce((sum, component) => sum + component.amount_cents, 0);
  const cashReturnRefundsCents = zRefundComponents
    .filter((component) => component.refund_method === "cash" && component.status === "completed")
    .filter((component) => {
      const document = documentById.get(component.post_sale_document_id);
      return document?.document_type === "return_full" || document?.document_type === "return_partial";
    })
    .reduce((sum, component) => sum + component.amount_cents, 0);
  const cardRefundsCompletedCents = zFinancialSummary.completed_card_refunds_cents;
  const cardRefundsPendingCents = zFinancialSummary.pending_card_refunds_cents;
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
  const expectedCashCents = zFinancialSummary.expected_cash_cents;
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
        const orderPayments = payments.filter((payment) => payment.order_id === order.id);
        const paymentMethod: "cash" | "card" | "mixed" | null = orderPayments.some((payment) => payment.payment_method === "card")
          ? orderPayments.some((payment) => payment.payment_method === "cash") ? "mixed" : "card"
          : orderPayments.some((payment) => payment.payment_method === "cash") ? "cash" : null;
        return {
          orderId: order.id,
          folio: order.folio,
          paidAt: order.paid_at,
          totalCents: order.total_cents,
          paymentMethod,
        };
      })
      .sort((left, right) => (right.paidAt ?? "").localeCompare(left.paidAt ?? "")),
    linesSummary: {
      soldLinesCount: lines.length,
      soldUnits: lines.reduce((sum, line) => sum + parseQuantity(line.quantity), 0),
    },
    financialSummary: zFinancialSummary,
    warnings,
  };
}
