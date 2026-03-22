import type { PosAlertsReportData, PosReportsFilters } from "@/types/pos-reports";
import { normalizePosReportsFilters } from "./filters";
import { getPosCashierShiftReport } from "./cashier-shift";
import { getPosCashiersReport } from "./cashiers";
import { buildPosAlertsReportData } from "./alerts-mappers";
import { getPosProductsReport } from "./products";
import { getPosSalesReport } from "./sales";

type GetPosAlertsReportInput = {
  tenantId: string;
  tenantSlug: string;
  filters: PosReportsFilters;
};

/*
Alert sources in this file are reused from existing report contracts:
- sales:
  source = getPosSalesReport()
  rule inputs = daily trend, totals, highlights
- products:
  source = getPosProductsReport()
  rule inputs = top_five_share_percent, products_sold_count
- cashiers:
  source = getPosCashiersReport()
  rule inputs = attribution coverage only
- cashier-shift:
  source = getPosCashierShiftReport()
  rule inputs = canonical cash_shift coverage only

No alert in this file reads order_events as a primary source.
*/

export async function getPosAlertsReport(
  input: GetPosAlertsReportInput,
): Promise<PosAlertsReportData> {
  const normalizedFilters = normalizePosReportsFilters(input.filters);
  const [sales, products, cashiers, cashierShift] = await Promise.all([
    getPosSalesReport({
      tenantId: input.tenantId,
      filters: normalizedFilters,
    }),
    getPosProductsReport({
      tenantId: input.tenantId,
      filters: normalizedFilters,
    }),
    getPosCashiersReport({
      tenantId: input.tenantId,
      filters: normalizedFilters,
    }),
    getPosCashierShiftReport({
      tenantId: input.tenantId,
      filters: normalizedFilters,
    }),
  ]);

  return buildPosAlertsReportData({
    tenantSlug: input.tenantSlug,
    filters: normalizedFilters,
    sales,
    products,
    cashiers,
    cashierShift,
  });
}
