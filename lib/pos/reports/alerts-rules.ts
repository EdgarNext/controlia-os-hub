import type {
  PosAlertItem,
  PosAlertsSummary,
  PosCashierShiftReportData,
  PosCashiersReportData,
  PosProductsReportData,
  PosSalesReportData,
} from "@/types/pos-reports";

type AlertsRuleContext = {
  sales: PosSalesReportData;
  products: PosProductsReportData;
  cashiers: PosCashiersReportData;
  cashierShift: PosCashierShiftReportData;
};

const MX_LABEL_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "2-digit",
  month: "short",
});

function enumerateDateRange(dateFrom: string, dateTo: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${dateFrom}T00:00:00.000Z`);
  const end = new Date(`${dateTo}T00:00:00.000Z`);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function formatShortMxDate(dateOnly: string): string {
  return MX_LABEL_FORMATTER.format(new Date(`${dateOnly}T12:00:00.000Z`));
}

function buildSalesGapAlert(context: AlertsRuleContext): PosAlertItem | null {
  if (context.sales.totals.gross_cents <= 0 || context.sales.trend.length === 0) {
    return null;
  }

  const activeDates = new Set(context.sales.trend.map((point) => point.date));
  const missingDates = enumerateDateRange(
    context.sales.filters.date_from,
    context.sales.filters.date_to,
  ).filter((date) => !activeDates.has(date));

  if (missingDates.length === 0) {
    return null;
  }

  return {
    id: `sales-gap-day:${context.sales.filters.date_from}:${context.sales.filters.date_to}`,
    severity: "medium",
    type: "sales-gap-day",
    title: "Hay dias sin venta dentro del rango consultado",
    description: `Se detectaron ${missingDates.length} dias sin ventas mientras otros dias del mismo periodo si tuvieron operacion.`,
    source_report: "sales",
    context_value: `Primer hueco: ${formatShortMxDate(missingDates[0])}`,
    recommended_action:
      "Revisa el reporte de ventas para validar si fue un dia sin operacion o un problema de registro/sincronizacion.",
    href: null,
  };
}

function buildTopProductConcentrationAlert(context: AlertsRuleContext): PosAlertItem | null {
  if (context.products.totals.gross_cents <= 0) {
    return null;
  }

  // Operational threshold: alert only when five products explain at least 90% of sales.
  // The threshold is explicit in code so the rule remains reviewable, not opaque.
  if (context.products.totals.top_five_share_percent < 90) {
    return null;
  }

  return {
    id: `sales-concentration-top-products:${context.products.filters.date_from}:${context.products.filters.date_to}`,
    severity: "info",
    type: "sales-concentration-top-products",
    title: "La venta esta muy concentrada en pocos productos",
    description: `Los 5 productos principales concentran ${Math.round(context.products.totals.top_five_share_percent)}% de la venta del periodo.`,
    source_report: "products",
    context_value: `${context.products.totals.products_sold_count} productos con venta`,
    recommended_action:
      "Valida si esta concentracion es esperada o si conviene revisar surtido, visibilidad y rotacion del resto del catalogo.",
    href: null,
  };
}

function buildCashierCoverageAlert(context: AlertsRuleContext): PosAlertItem | null {
  if (context.cashiers.totals.orders_count <= 0 || context.cashiers.attribution_supported) {
    return null;
  }

  return {
    id: `cashier-attribution-unavailable:${context.cashiers.filters.date_from}:${context.cashiers.filters.date_to}`,
    severity: "medium",
    type: "cashier-attribution-unavailable",
    title: "La atribucion por cajero sigue incompleta",
    description: context.cashiers.limitation_reason,
    source_report: "cashiers",
    context_value: `${context.cashiers.totals.unattributed_orders_count} tickets sin atribucion canonica`,
    recommended_action:
      "No uses esta ventana para evaluar desempeno individual hasta que orders persista una relacion canonica con pos_users.",
    href: null,
  };
}

function buildCashShiftCoverageAlerts(context: AlertsRuleContext): PosAlertItem[] {
  const alerts: PosAlertItem[] = [];

  if (context.sales.totals.gross_cents > 0 && context.cashierShift.shifts.length === 0) {
    alerts.push({
      id: `sales-without-cash-shifts:${context.cashierShift.filters.date_from}:${context.cashierShift.filters.date_to}`,
      severity: "critical",
      type: "sales-without-cash-shifts",
      title: "Hubo ventas pero no hay cash shifts registrados",
      description:
        "El periodo muestra operacion de ventas, pero no existen aperturas o cierres de caja canonicos para esa misma ventana.",
      source_report: "cashier-shift",
      context_value: `${context.sales.trend.length} dias con actividad`,
      recommended_action:
        "Confirma si el proceso operativo de apertura/cierre se ejecuto fuera del rango o si falta sincronizar el kiosk.",
      href: null,
    });
  }

  if (
    context.cashierShift.shifts.length > 0 &&
    !context.cashierShift.monetary_reconciliation_supported
  ) {
    alerts.push({
      id: `cash-shifts-without-reconciliation:${context.cashierShift.filters.date_from}:${context.cashierShift.filters.date_to}`,
      severity: "info",
      type: "cash-shifts-without-reconciliation",
      title: "Los cash shifts registrados no permiten conciliacion monetaria completa",
      description: context.cashierShift.limitation_reason,
      source_report: "cashier-shift",
      context_value: `${context.cashierShift.totals.cash_shifts_count} cash shifts`,
      recommended_action:
        "Usa esta vista para monitorear apertura y cierre de caja, pero no para validar expected o difference hasta tener ventas atribuidas por shift.",
      href: null,
    });
  }

  return alerts;
}

export function buildPosAlertsSummary(alerts: PosAlertItem[]): PosAlertsSummary {
  return {
    total_count: alerts.length,
    critical_count: alerts.filter((alert) => alert.severity === "critical").length,
    medium_count: alerts.filter((alert) => alert.severity === "medium").length,
    info_count: alerts.filter((alert) => alert.severity === "info").length,
  };
}

export function buildPosAlerts(context: AlertsRuleContext): PosAlertItem[] {
  return [
    buildSalesGapAlert(context),
    buildTopProductConcentrationAlert(context),
    buildCashierCoverageAlert(context),
    ...buildCashShiftCoverageAlerts(context),
  ]
    .filter((alert): alert is PosAlertItem => Boolean(alert))
    .sort((left, right) => {
      const severityRank = { critical: 0, medium: 1, info: 2 } as const;
      const severityDelta = severityRank[left.severity] - severityRank[right.severity];

      if (severityDelta !== 0) {
        return severityDelta;
      }

      return left.title.localeCompare(right.title);
    });
}
