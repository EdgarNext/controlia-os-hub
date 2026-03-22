import type {
  PosReportsDailyAggregateRow,
  PosReportsOverviewViewModel,
  PosSalesDistributionRow,
  PosSalesHighlights,
  PosSalesReportData,
  PosSalesTrendPoint,
  PosSalesVariationPoint,
} from "@/types/pos-reports";

const MX_LABEL_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "2-digit",
  month: "short",
});

function formatShortMxDate(dateOnly: string): string {
  const date = new Date(`${dateOnly}T12:00:00.000Z`);
  return MX_LABEL_FORMATTER.format(date);
}

function buildTrend(daily: PosReportsDailyAggregateRow[]): PosSalesTrendPoint[] {
  const grouped = new Map<
    string,
    { date: string; label: string; gross_cents: number; orders_count: number }
  >();

  for (const row of daily) {
    const current = grouped.get(row.business_date_mx) ?? {
      date: row.business_date_mx,
      label: formatShortMxDate(row.business_date_mx),
      gross_cents: 0,
      orders_count: 0,
    };

    current.gross_cents += row.gross_cents;
    current.orders_count += row.orders_count;
    grouped.set(row.business_date_mx, current);
  }

  return [...grouped.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((row) => ({
      ...row,
      average_ticket_cents:
        row.orders_count > 0 ? Math.round(row.gross_cents / row.orders_count) : 0,
    }));
}

function buildDistributionRows(
  source: Array<{ key: string; label: string; gross_cents: number; orders_count: number }>,
): PosSalesDistributionRow[] {
  const totalGross = source.reduce((accumulator, row) => accumulator + row.gross_cents, 0);

  return source
    .map((row) => ({
      ...row,
      share_percent: totalGross > 0 ? (row.gross_cents / totalGross) * 100 : 0,
    }))
    .sort((left, right) => right.gross_cents - left.gross_cents);
}

function buildChannelDistribution(daily: PosReportsDailyAggregateRow[]): PosSalesDistributionRow[] {
  const grouped = new Map<
    string,
    { key: string; label: string; gross_cents: number; orders_count: number }
  >();

  for (const row of daily) {
    const key = row.is_tab ? "tabs" : "quick-sale";
    const label = row.is_tab ? "Mesas" : "Venta rapida";
    const current = grouped.get(key) ?? { key, label, gross_cents: 0, orders_count: 0 };
    current.gross_cents += row.gross_cents;
    current.orders_count += row.orders_count;
    grouped.set(key, current);
  }

  return buildDistributionRows([...grouped.values()]);
}

function buildPaymentDistribution(
  overview: PosReportsOverviewViewModel,
  trend: PosSalesTrendPoint[],
): PosSalesDistributionRow[] {
  const ordersCount = overview.totals.orders_count;
  const totalGross = overview.totals.gross_cents;

  if (totalGross <= 0) {
    return [];
  }

  const source = [
    {
      key: "cash",
      label: "Efectivo",
      gross_cents: overview.totals.cash_cents,
      orders_count:
        totalGross > 0 ? Math.round((overview.totals.cash_cents / totalGross) * ordersCount) : 0,
    },
    {
      key: "card",
      label: "Tarjeta",
      gross_cents: overview.totals.card_cents,
      orders_count:
        totalGross > 0 ? Math.round((overview.totals.card_cents / totalGross) * ordersCount) : 0,
    },
    {
      key: "employee",
      label: "Empleado",
      gross_cents: overview.totals.employee_cents,
      orders_count:
        totalGross > 0
          ? Math.max(
              ordersCount -
                Math.round((overview.totals.cash_cents / totalGross) * ordersCount) -
                Math.round((overview.totals.card_cents / totalGross) * ordersCount),
              0,
            )
          : 0,
    },
  ].filter((row) => row.gross_cents > 0);

  // TODO: mismatch with specs
  // `report_sales_daily` confirms gross by payment method, but not order counts per payment method.
  // The UI labels these counts as estimated participation derived from revenue share until a source with
  // canonical order_count by payment method exists.
  if (trend.length === 0) {
    return [];
  }

  return buildDistributionRows(source);
}

function buildVariationHighlights(trend: PosSalesTrendPoint[]): {
  strongest_growth: PosSalesVariationPoint | null;
  sharpest_drop: PosSalesVariationPoint | null;
} {
  if (trend.length < 2) {
    return {
      strongest_growth: null,
      sharpest_drop: null,
    };
  }

  let strongestGrowth: PosSalesVariationPoint | null = null;
  let sharpestDrop: PosSalesVariationPoint | null = null;

  for (let index = 1; index < trend.length; index += 1) {
    const current = trend[index];
    const previous = trend[index - 1];
    const changeCents = current.gross_cents - previous.gross_cents;
    const point = {
      label: current.label,
      gross_cents: current.gross_cents,
      change_cents: changeCents,
    };

    if (changeCents > 0 && (!strongestGrowth || changeCents > strongestGrowth.change_cents)) {
      strongestGrowth = point;
    }

    if (changeCents < 0 && (!sharpestDrop || changeCents < sharpestDrop.change_cents)) {
      sharpestDrop = point;
    }
  }

  return {
    strongest_growth: strongestGrowth,
    sharpest_drop: sharpestDrop,
  };
}

function buildHighlights(trend: PosSalesTrendPoint[]): PosSalesHighlights {
  if (trend.length === 0) {
    return {
      average_daily_sales_cents: 0,
      active_days_count: 0,
      best_day: {
        label: "Sin datos",
        gross_cents: 0,
      },
      quietest_day: {
        label: "Sin datos",
        gross_cents: 0,
      },
      strongest_growth: null,
      sharpest_drop: null,
    };
  }

  const bestDay = [...trend].sort((left, right) => right.gross_cents - left.gross_cents)[0];
  const quietestDay = [...trend].sort((left, right) => left.gross_cents - right.gross_cents)[0];
  const variation = buildVariationHighlights(trend);
  const grossTotal = trend.reduce((accumulator, point) => accumulator + point.gross_cents, 0);

  return {
    average_daily_sales_cents: Math.round(grossTotal / trend.length),
    active_days_count: trend.length,
    best_day: {
      label: bestDay.label,
      gross_cents: bestDay.gross_cents,
    },
    quietest_day: {
      label: quietestDay.label,
      gross_cents: quietestDay.gross_cents,
    },
    strongest_growth: variation.strongest_growth,
    sharpest_drop: variation.sharpest_drop,
  };
}

export function buildPosSalesReportData(
  overview: PosReportsOverviewViewModel,
): PosSalesReportData {
  const trend = buildTrend(overview.daily);

  return {
    filters: overview.filters,
    totals: overview.totals,
    trend,
    payment_distribution:
      overview.filters.payment_method === "all" ? buildPaymentDistribution(overview, trend) : [],
    channel_distribution: buildChannelDistribution(overview.daily),
    highlights: buildHighlights(trend),
    supports_payment_distribution: overview.filters.payment_method === "all",
  };
}
