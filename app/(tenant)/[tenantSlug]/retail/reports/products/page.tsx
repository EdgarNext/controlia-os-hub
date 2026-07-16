import { StatePanel } from "@/components/ui/state-panel";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import { getRetailProductsReport } from "@/lib/retail-pos/reports";
import { RETAIL_REPORTING_PERIOD_NOTES, getRetailReportingLabel } from "@/lib/retail-pos/reporting-semantics";
import { RetailReportPeriodContext } from "../_components/RetailReportPeriodContext";
import {
  RetailMetricGrid,
  RetailProductsTable,
  RetailReportsFiltersCard,
  RetailReportsHeader,
  RetailSectionCard,
  buildRetailReportsFilters,
  formatCurrency,
  formatNumber,
  type RetailReportsSearchParams,
} from "../_components/retail-reports-ui";

type RetailProductsPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<RetailReportsSearchParams>;
};

export default async function RetailProductsPage({ params, searchParams }: RetailProductsPageProps) {
  const { tenantSlug } = await params;
  const tenant = await resolveRetailPosTypePageContext(tenantSlug, "catalog", "read");
  const filters = buildRetailReportsFilters(await searchParams);
  const report = await getRetailProductsReport(tenant.tenantId, filters);

  return (
    <div className="space-y-4">
      <RetailReportsHeader
        title="Productos vendidos"
        description="Concentrado de productos y variantes cobradas, con cantidad, venta cobrada y precio promedio."
        metadata={`${tenant.tenantName} · ${report.filters.dateFrom} a ${report.filters.dateTo}`}
      />

      <RetailReportsFiltersCard
        tenantSlug={tenantSlug}
        filters={report.filters}
        devices={report.devices}
        basePath="/retail/reports/products"
      />

      <RetailReportPeriodContext
        periodLabel={`${report.filters.dateFrom} -> ${report.filters.dateTo}`}
        primaryDateLabel={RETAIL_REPORTING_PERIOD_NOTES.products.primaryDateLabel}
        note={RETAIL_REPORTING_PERIOD_NOTES.products.note}
      />

      <RetailMetricGrid
        items={[
          {
            label: getRetailReportingLabel("distinct_collected_products"),
            value: formatNumber(report.totals.distinctProducts),
          },
          {
            label: getRetailReportingLabel("collected_units"),
            value: formatNumber(report.totals.quantitySold),
          },
          {
            label: getRetailReportingLabel("collected_sales"),
            value: formatCurrency(report.totals.totalSoldCents),
          },
        ]}
      />

      <RetailSectionCard
        title="Ranking de productos"
        description="Solo se consideran ventas cobradas. Los pedidos pendientes o anulados antes del pago quedan fuera del agregado."
      >
        {report.rows.length > 0 ? (
          <RetailProductsTable report={report} />
        ) : (
          <StatePanel
            kind="empty"
            title="Sin productos cobrados en el periodo"
            message="No hay productos cobrados para los filtros seleccionados."
          />
        )}
      </RetailSectionCard>
    </div>
  );
}
