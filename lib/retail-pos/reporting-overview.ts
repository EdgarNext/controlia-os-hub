import { formatRetailReportingCurrency } from "./reporting-formatters";
import { RETAIL_REPORTING_TIME_ZONE, getRetailReportingLabel } from "./reporting-semantics";

export type RetailCommercialWaterfallDatum = {
  key:
    | "gross_sales"
    | "discounts"
    | "collected_sales"
    | "sale_cancellations"
    | "returns"
    | "commercial_result";
  label: string;
  amountCents: number;
  kind: "total" | "decrease" | "subtotal";
};

export type RetailPaymentMixDatum = {
  method: "cash" | "card";
  label: string;
  amountCents: number;
  share: number | null;
};

export type RetailSalesTrendGranularity = "none" | "day" | "week" | "month";

export type RetailSalesTrendPoint = {
  periodKey: string;
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  collectedSalesCents: number;
  commercialResultCents: number;
  saleCancellationsCents: number;
  returnsCents: number;
};

export type RetailSalesActivityTrendPoint = {
  periodKey: string;
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  collectedSalesCents: number;
  paidSalesCount: number;
  averageTicketCents: number | null;
};

export type RetailSalesAdjustmentsTrendPoint = {
  periodKey: string;
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  discountsCents: number;
  saleCancellationsCents: number;
  returnsCents: number;
};

export type RetailPostSaleTrendPoint = {
  periodKey: string;
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  saleCancellationsCount: number;
  fullReturnsCount: number;
  partialReturnsCount: number;
  saleCancellationsCents: number;
  fullReturnsCents: number;
  partialReturnsCents: number;
};

export type RetailOverviewAttentionSignal = {
  key:
    | "pending_reimbursements"
    | "pending_orders"
    | "open_shifts"
    | "below_cost_orders"
    | "failed_prints";
  quantity: number | null;
  amountCents: number | null;
};

type RetailOverviewWaterfallSummary = {
  grossSalesCents: number;
  discountsCents: number;
  netSalesCents: number;
  cancelledSalesCents: number;
  returnedCents: number;
  commercialNetCents: number;
};

type RetailOverviewPaymentMethodSummary = {
  method: "cash" | "card";
  totalCents: number;
};

type RetailOverviewTrendOrderEntry = {
  paidAt: string | null;
  totalCents: number;
  discountCents?: number;
};

type RetailOverviewTrendDocumentEntry = {
  createdAt: string;
  documentType: "sale_cancellation" | "return_full" | "return_partial";
  netAmountCents: number;
};

type RetailOverviewAttentionInput = {
  pendingRefundsCount: number;
  pendingRefundCents: number;
  pendingOrdersCount: number;
  openShiftsCount: number;
  belowCostOrdersCount: number;
  failedPrintCount: number;
};

const localDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: RETAIL_REPORTING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const shortDayFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
});

const monthFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: "UTC",
  month: "short",
  year: "numeric",
});

function getFormatterParts(formatter: Intl.DateTimeFormat, value: Date) {
  const parts = formatter.formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return { year, month, day };
}

function toUtcDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function addDays(dateKey: string, days: number) {
  const date = toUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return dateToKey(date);
}

function dateToKey(date: Date) {
  const { year, month, day } = getFormatterParts(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    date,
  );

  return `${year}-${month}-${day}`;
}

function getMexicoCityDateKey(timestamp: string) {
  const { year, month, day } = getFormatterParts(localDateFormatter, new Date(timestamp));
  return `${year}-${month}-${day}`;
}

function countInclusiveDays(dateFrom: string, dateTo: string) {
  const from = toUtcDate(dateFrom).getTime();
  const to = toUtcDate(dateTo).getTime();
  return Math.floor((to - from) / 86_400_000) + 1;
}

function listDateKeys(dateFrom: string, dateTo: string) {
  const keys: string[] = [];
  let current = dateFrom;

  while (current <= dateTo) {
    keys.push(current);
    current = addDays(current, 1);
  }

  return keys;
}

function getWeekStart(dateKey: string) {
  const weekday = toUtcDate(dateKey).getUTCDay();
  const diff = weekday === 0 ? 6 : weekday - 1;
  return addDays(dateKey, -diff);
}

function formatShortDate(dateKey: string) {
  return shortDayFormatter.format(toUtcDate(dateKey)).replace(".", "");
}

function formatWeekLabel(dateFrom: string, dateTo: string) {
  return `${formatShortDate(dateFrom)} - ${formatShortDate(dateTo)}`;
}

function formatMonthLabel(dateKey: string) {
  return monthFormatter.format(toUtcDate(dateKey)).replace(".", "");
}

function createRetailTrendBuckets(input: {
  dateFrom: string;
  dateTo: string;
  granularity: RetailSalesTrendGranularity;
}) {
  const buckets = new Map<
    string,
    {
      periodKey: string;
      periodLabel: string;
      dateFrom: string;
      dateTo: string;
    }
  >();

  const ensureBucket = (dateKey: string) => {
    if (input.granularity === "day") {
      if (!buckets.has(dateKey)) {
        buckets.set(dateKey, {
          periodKey: dateKey,
          periodLabel: formatShortDate(dateKey),
          dateFrom: dateKey,
          dateTo: dateKey,
        });
      }

      return buckets.get(dateKey)!;
    }

    if (input.granularity === "week") {
      const weekStart = getWeekStart(dateKey);
      const weekEnd = addDays(weekStart, 6);
      const boundedFrom = weekStart < input.dateFrom ? input.dateFrom : weekStart;
      const boundedTo = weekEnd > input.dateTo ? input.dateTo : weekEnd;

      if (!buckets.has(weekStart)) {
        buckets.set(weekStart, {
          periodKey: weekStart,
          periodLabel: formatWeekLabel(boundedFrom, boundedTo),
          dateFrom: boundedFrom,
          dateTo: boundedTo,
        });
      }

      return buckets.get(weekStart)!;
    }

    const monthKey = dateKey.slice(0, 7);
    const monthStart = `${monthKey}-01`;
    const nextMonthStart =
      monthKey.endsWith("-12")
        ? `${Number(monthKey.slice(0, 4)) + 1}-01-01`
        : `${monthKey.slice(0, 4)}-${String(Number(monthKey.slice(5, 7)) + 1).padStart(2, "0")}-01`;
    const monthEnd = addDays(nextMonthStart, -1);
    const boundedFrom = monthStart < input.dateFrom ? input.dateFrom : monthStart;
    const boundedTo = monthEnd > input.dateTo ? input.dateTo : monthEnd;

    if (!buckets.has(monthKey)) {
      buckets.set(monthKey, {
        periodKey: monthKey,
        periodLabel: formatMonthLabel(monthStart),
        dateFrom: boundedFrom,
        dateTo: boundedTo,
      });
    }

    return buckets.get(monthKey)!;
  };

  for (const dateKey of listDateKeys(input.dateFrom, input.dateTo)) {
    ensureBucket(dateKey);
  }

  return {
    buckets,
    ensureBucket,
  };
}

export function selectRetailSalesTrendGranularity(
  dateFrom: string,
  dateTo: string,
): RetailSalesTrendGranularity {
  const totalDays = countInclusiveDays(dateFrom, dateTo);

  if (totalDays <= 1) {
    return "none";
  }

  if (totalDays <= 31) {
    return "day";
  }

  if (totalDays <= 120) {
    return "week";
  }

  return "month";
}

export function buildRetailCommercialWaterfall(
  summary: RetailOverviewWaterfallSummary,
): RetailCommercialWaterfallDatum[] {
  return [
    {
      key: "gross_sales",
      label: getRetailReportingLabel("gross_sales"),
      amountCents: summary.grossSalesCents,
      kind: "total",
    },
    {
      key: "discounts",
      label: getRetailReportingLabel("granted_discount"),
      amountCents: summary.discountsCents,
      kind: "decrease",
    },
    {
      key: "collected_sales",
      label: getRetailReportingLabel("collected_sales"),
      amountCents: summary.netSalesCents,
      kind: "subtotal",
    },
    {
      key: "sale_cancellations",
      label: getRetailReportingLabel("paid_sale_cancellation"),
      amountCents: summary.cancelledSalesCents,
      kind: "decrease",
    },
    {
      key: "returns",
      label: getRetailReportingLabel("return_operation"),
      amountCents: summary.returnedCents,
      kind: "decrease",
    },
    {
      key: "commercial_result",
      label: getRetailReportingLabel("commercial_result"),
      amountCents: summary.commercialNetCents,
      kind: "total",
    },
  ];
}

export function buildRetailPaymentMix(
  paymentMethods: RetailOverviewPaymentMethodSummary[],
): RetailPaymentMixDatum[] {
  const totals = new Map(paymentMethods.map((row) => [row.method, row.totalCents]));
  const totalCents = (totals.get("cash") ?? 0) + (totals.get("card") ?? 0);

  return [
    {
      method: "cash",
      label: getRetailReportingLabel("cash_collections"),
      amountCents: totals.get("cash") ?? 0,
      share: totalCents > 0 ? (totals.get("cash") ?? 0) / totalCents : null,
    },
    {
      method: "card",
      label: getRetailReportingLabel("card_collections"),
      amountCents: totals.get("card") ?? 0,
      share: totalCents > 0 ? (totals.get("card") ?? 0) / totalCents : null,
    },
  ];
}

export function buildRetailSalesTrend(input: {
  dateFrom: string;
  dateTo: string;
  paidOrders: RetailOverviewTrendOrderEntry[];
  completedPostSaleDocuments: RetailOverviewTrendDocumentEntry[];
}): {
  granularity: RetailSalesTrendGranularity;
  points: RetailSalesTrendPoint[];
} {
  const granularity = selectRetailSalesTrendGranularity(input.dateFrom, input.dateTo);

  if (granularity === "none") {
    return { granularity, points: [] };
  }

  const { buckets, ensureBucket } = createRetailTrendBuckets({
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    granularity,
  });
  const metricsByPeriodKey = new Map<
    string,
    {
      collectedSalesCents: number;
      saleCancellationsCents: number;
      returnsCents: number;
    }
  >();
  const ensureMetrics = (periodKey: string) => {
    let metrics = metricsByPeriodKey.get(periodKey);
    if (!metrics) {
      metrics = {
        collectedSalesCents: 0,
        saleCancellationsCents: 0,
        returnsCents: 0,
      };
      metricsByPeriodKey.set(periodKey, metrics);
    }

    return metrics;
  };

  for (const bucket of buckets.values()) {
    ensureMetrics(bucket.periodKey);
  }

  for (const order of input.paidOrders) {
    if (!order.paidAt) {
      continue;
    }

    const dateKey = getMexicoCityDateKey(order.paidAt);
    const bucket = ensureBucket(dateKey);
    const metrics = ensureMetrics(bucket.periodKey);
    metrics.collectedSalesCents += order.totalCents;
  }

  for (const document of input.completedPostSaleDocuments) {
    const dateKey = getMexicoCityDateKey(document.createdAt);
    const bucket = ensureBucket(dateKey);
    const metrics = ensureMetrics(bucket.periodKey);

    if (document.documentType === "sale_cancellation") {
      metrics.saleCancellationsCents += document.netAmountCents;
    } else {
      metrics.returnsCents += document.netAmountCents;
    }
  }

  return {
    granularity,
    points: [...buckets.values()].map((bucket) => {
      const metrics = ensureMetrics(bucket.periodKey);

      return {
        periodKey: bucket.periodKey,
        periodLabel: bucket.periodLabel,
        dateFrom: bucket.dateFrom,
        dateTo: bucket.dateTo,
        collectedSalesCents: metrics.collectedSalesCents,
        commercialResultCents:
          metrics.collectedSalesCents - metrics.saleCancellationsCents - metrics.returnsCents,
        saleCancellationsCents: metrics.saleCancellationsCents,
        returnsCents: metrics.returnsCents,
      };
    }),
  };
}

export function buildRetailSalesActivityTrend(input: {
  dateFrom: string;
  dateTo: string;
  paidOrders: RetailOverviewTrendOrderEntry[];
}): {
  granularity: RetailSalesTrendGranularity;
  points: RetailSalesActivityTrendPoint[];
} {
  const granularity = selectRetailSalesTrendGranularity(input.dateFrom, input.dateTo);

  if (granularity === "none") {
    return { granularity, points: [] };
  }

  const { buckets, ensureBucket } = createRetailTrendBuckets({
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    granularity,
  });
  const metricsByPeriodKey = new Map<
    string,
    {
      collectedSalesCents: number;
      paidSalesCount: number;
    }
  >();
  const ensureMetrics = (periodKey: string) => {
    let metrics = metricsByPeriodKey.get(periodKey);
    if (!metrics) {
      metrics = {
        collectedSalesCents: 0,
        paidSalesCount: 0,
      };
      metricsByPeriodKey.set(periodKey, metrics);
    }

    return metrics;
  };

  for (const bucket of buckets.values()) {
    ensureMetrics(bucket.periodKey);
  }

  for (const order of input.paidOrders) {
    if (!order.paidAt) {
      continue;
    }

    const bucket = ensureBucket(getMexicoCityDateKey(order.paidAt));
    const metrics = ensureMetrics(bucket.periodKey);
    metrics.collectedSalesCents += order.totalCents;
    metrics.paidSalesCount += 1;
  }

  return {
    granularity,
    points: [...buckets.values()].map((bucket) => {
      const metrics = ensureMetrics(bucket.periodKey);
      return {
        periodKey: bucket.periodKey,
        periodLabel: bucket.periodLabel,
        dateFrom: bucket.dateFrom,
        dateTo: bucket.dateTo,
        collectedSalesCents: metrics.collectedSalesCents,
        paidSalesCount: metrics.paidSalesCount,
        averageTicketCents:
          metrics.paidSalesCount > 0
            ? Math.round(metrics.collectedSalesCents / metrics.paidSalesCount)
            : null,
      };
    }),
  };
}

export function buildRetailSalesAdjustmentsTrend(input: {
  dateFrom: string;
  dateTo: string;
  paidOrders: RetailOverviewTrendOrderEntry[];
  completedPostSaleDocuments: RetailOverviewTrendDocumentEntry[];
}): {
  granularity: RetailSalesTrendGranularity;
  points: RetailSalesAdjustmentsTrendPoint[];
} {
  const granularity = selectRetailSalesTrendGranularity(input.dateFrom, input.dateTo);

  if (granularity === "none") {
    return { granularity, points: [] };
  }

  const { buckets, ensureBucket } = createRetailTrendBuckets({
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    granularity,
  });
  const metricsByPeriodKey = new Map<
    string,
    {
      discountsCents: number;
      saleCancellationsCents: number;
      returnsCents: number;
    }
  >();
  const ensureMetrics = (periodKey: string) => {
    let metrics = metricsByPeriodKey.get(periodKey);
    if (!metrics) {
      metrics = {
        discountsCents: 0,
        saleCancellationsCents: 0,
        returnsCents: 0,
      };
      metricsByPeriodKey.set(periodKey, metrics);
    }

    return metrics;
  };

  for (const bucket of buckets.values()) {
    ensureMetrics(bucket.periodKey);
  }

  for (const order of input.paidOrders) {
    if (!order.paidAt) {
      continue;
    }

    const bucket = ensureBucket(getMexicoCityDateKey(order.paidAt));
    const metrics = ensureMetrics(bucket.periodKey);
    metrics.discountsCents += order.discountCents ?? 0;
  }

  for (const document of input.completedPostSaleDocuments) {
    const bucket = ensureBucket(getMexicoCityDateKey(document.createdAt));
    const metrics = ensureMetrics(bucket.periodKey);

    if (document.documentType === "sale_cancellation") {
      metrics.saleCancellationsCents += document.netAmountCents;
    } else {
      metrics.returnsCents += document.netAmountCents;
    }
  }

  return {
    granularity,
    points: [...buckets.values()].map((bucket) => {
      const metrics = ensureMetrics(bucket.periodKey);
      return {
        periodKey: bucket.periodKey,
        periodLabel: bucket.periodLabel,
        dateFrom: bucket.dateFrom,
        dateTo: bucket.dateTo,
        discountsCents: metrics.discountsCents,
        saleCancellationsCents: metrics.saleCancellationsCents,
        returnsCents: metrics.returnsCents,
      };
    }),
  };
}

export function buildRetailPostSaleTrend(input: {
  dateFrom: string;
  dateTo: string;
  completedPostSaleDocuments: RetailOverviewTrendDocumentEntry[];
}): {
  granularity: RetailSalesTrendGranularity;
  points: RetailPostSaleTrendPoint[];
} {
  const granularity = selectRetailSalesTrendGranularity(input.dateFrom, input.dateTo);

  if (granularity === "none") {
    return { granularity, points: [] };
  }

  const { buckets, ensureBucket } = createRetailTrendBuckets({
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    granularity,
  });
  const metricsByPeriodKey = new Map<
    string,
    {
      saleCancellationsCount: number;
      fullReturnsCount: number;
      partialReturnsCount: number;
      saleCancellationsCents: number;
      fullReturnsCents: number;
      partialReturnsCents: number;
    }
  >();
  const ensureMetrics = (periodKey: string) => {
    let metrics = metricsByPeriodKey.get(periodKey);
    if (!metrics) {
      metrics = {
        saleCancellationsCount: 0,
        fullReturnsCount: 0,
        partialReturnsCount: 0,
        saleCancellationsCents: 0,
        fullReturnsCents: 0,
        partialReturnsCents: 0,
      };
      metricsByPeriodKey.set(periodKey, metrics);
    }

    return metrics;
  };

  for (const bucket of buckets.values()) {
    ensureMetrics(bucket.periodKey);
  }

  for (const document of input.completedPostSaleDocuments) {
    const bucket = ensureBucket(getMexicoCityDateKey(document.createdAt));
    const metrics = ensureMetrics(bucket.periodKey);

    if (document.documentType === "sale_cancellation") {
      metrics.saleCancellationsCount += 1;
      metrics.saleCancellationsCents += document.netAmountCents;
      continue;
    }

    if (document.documentType === "return_full") {
      metrics.fullReturnsCount += 1;
      metrics.fullReturnsCents += document.netAmountCents;
      continue;
    }

    metrics.partialReturnsCount += 1;
    metrics.partialReturnsCents += document.netAmountCents;
  }

  return {
    granularity,
    points: [...buckets.values()].map((bucket) => {
      const metrics = ensureMetrics(bucket.periodKey);
      return {
        periodKey: bucket.periodKey,
        periodLabel: bucket.periodLabel,
        dateFrom: bucket.dateFrom,
        dateTo: bucket.dateTo,
        saleCancellationsCount: metrics.saleCancellationsCount,
        fullReturnsCount: metrics.fullReturnsCount,
        partialReturnsCount: metrics.partialReturnsCount,
        saleCancellationsCents: metrics.saleCancellationsCents,
        fullReturnsCents: metrics.fullReturnsCents,
        partialReturnsCents: metrics.partialReturnsCents,
      };
    }),
  };
}

export function buildRetailOverviewAttentionSignals(
  input: RetailOverviewAttentionInput,
): RetailOverviewAttentionSignal[] {
  const signals: RetailOverviewAttentionSignal[] = [];

  if (input.pendingRefundsCount > 0 || input.pendingRefundCents > 0) {
    signals.push({
      key: "pending_reimbursements",
      quantity: input.pendingRefundsCount > 0 ? input.pendingRefundsCount : null,
      amountCents: input.pendingRefundCents > 0 ? input.pendingRefundCents : null,
    });
  }

  if (input.pendingOrdersCount > 0) {
    signals.push({
      key: "pending_orders",
      quantity: input.pendingOrdersCount,
      amountCents: null,
    });
  }

  if (input.openShiftsCount > 0) {
    signals.push({
      key: "open_shifts",
      quantity: input.openShiftsCount,
      amountCents: null,
    });
  }

  if (input.belowCostOrdersCount > 0) {
    signals.push({
      key: "below_cost_orders",
      quantity: input.belowCostOrdersCount,
      amountCents: null,
    });
  }

  if (input.failedPrintCount > 0) {
    signals.push({
      key: "failed_prints",
      quantity: input.failedPrintCount,
      amountCents: null,
    });
  }

  return signals;
}

export function formatRetailPaymentMixShare(share: number | null) {
  if (share === null) {
    return "Sin porcentaje";
  }

  return `${Math.round(share * 1000) / 10}%`;
}

export function formatRetailOverviewAttentionAmount(amountCents: number | null) {
  return amountCents === null ? null : formatRetailReportingCurrency(amountCents);
}
