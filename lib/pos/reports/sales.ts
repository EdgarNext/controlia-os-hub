import { getPosReportsOverview } from "@/lib/pos/reports/overview";
import type { PosReportsFilters, PosSalesReportData } from "@/types/pos-reports";
import { buildPosSalesReportData } from "./sales-mappers";

type GetPosSalesReportInput = {
  tenantId: string;
  filters: PosReportsFilters;
};

export async function getPosSalesReport(
  input: GetPosSalesReportInput,
): Promise<PosSalesReportData> {
  const overview = await getPosReportsOverview({
    tenantId: input.tenantId,
    filters: input.filters,
  });

  return buildPosSalesReportData(overview);
}
