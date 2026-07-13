import { StatePanel } from "@/components/ui/state-panel";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import { getRetailProductsReport } from "@/lib/retail-pos/reports";
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
        description="Concentrado de productos y variantes vendidas solo en pedidos pagados, con cantidad, total y precio promedio."
        metadata={`Tenant ${tenant.tenantName} · ${report.filters.dateFrom} a ${report.filters.dateTo}`}
      />

      <RetailReportsFiltersCard
        tenantSlug={tenantSlug}
        filters={report.filters}
        devices={report.devices}
        basePath="/retail/reports/products"
      />

      <RetailMetricGrid
        items={[
          {
            label: "Productos distintos",
            value: formatNumber(report.totals.distinctProducts),
          },
          {
            label: "Unidades vendidas",
            value: formatNumber(report.totals.quantitySold),
          },
          {
            label: "Venta total",
            value: formatCurrency(report.totals.totalSoldCents),
          },
        ]}
      />

      <RetailSectionCard
        title="Ranking de productos"
        description="Solo se consideran ordenes pagadas. Cancelados y pendientes quedan fuera del agregado."
      >
        {report.rows.length > 0 ? (
          <RetailProductsTable report={report} />
        ) : (
          <StatePanel
            kind="empty"
            title="Sin productos vendidos en el rango"
            message="No existen lineas de pedidos pagados para los filtros seleccionados."
          />
        )}
      </RetailSectionCard>
    </div>
  );
}
