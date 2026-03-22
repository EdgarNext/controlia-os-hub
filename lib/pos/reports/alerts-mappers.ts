import type {
  PosAlertsReportData,
  PosCashierShiftReportData,
  PosCashiersReportData,
  PosProductsReportData,
  PosReportsFilters,
  PosSalesReportData,
} from "@/types/pos-reports";
import type { NormalizedPosReportsFilters } from "./filters";
import { buildPosAlerts, buildPosAlertsSummary } from "./alerts-rules";
import { buildPosReportsHref } from "./search-params";

export function buildPosAlertsReportData(input: {
  tenantSlug: string;
  filters: NormalizedPosReportsFilters;
  sales: PosSalesReportData;
  products: PosProductsReportData;
  cashiers: PosCashiersReportData;
  cashierShift: PosCashierShiftReportData;
}): PosAlertsReportData {
  const alerts = buildPosAlerts({
    sales: input.sales,
    products: input.products,
    cashiers: input.cashiers,
    cashierShift: input.cashierShift,
  }).map((alert) => ({
    ...alert,
    href:
      alert.source_report === "sales"
        ? buildPosReportsHref(`/${input.tenantSlug}/pos/reports/sales`, input.filters)
        : alert.source_report === "products"
          ? buildPosReportsHref(`/${input.tenantSlug}/pos/reports/products`, input.filters)
          : alert.source_report === "cashiers"
            ? buildPosReportsHref(`/${input.tenantSlug}/pos/reports/cashiers`, input.filters)
            : buildPosReportsHref(`/${input.tenantSlug}/pos/reports/cashier-shift`, input.filters),
  }));

  const limitations = [
    !input.cashiers.attribution_supported ? input.cashiers.limitation_reason : null,
    !input.cashierShift.monetary_reconciliation_supported
      ? input.cashierShift.limitation_reason
      : null,
  ].filter((value): value is string => Boolean(value));

  return {
    filters: {
      date_from: input.filters.date_from,
      date_to: input.filters.date_to,
      sale_channel: input.filters.sale_channel,
      payment_method: input.filters.payment_method,
    } satisfies PosReportsFilters,
    summary: buildPosAlertsSummary(alerts),
    alerts,
    limitations,
  };
}
