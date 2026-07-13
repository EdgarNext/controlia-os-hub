import { StatePanel } from "@/components/ui/state-panel";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import { getRetailCashShiftReport } from "@/lib/retail-pos/reports";
import {
  RetailCashShiftTable,
  RetailMetricGrid,
  RetailReportsFiltersCard,
  RetailReportsHeader,
  RetailSectionCard,
  buildRetailReportsFilters,
  formatCurrency,
  formatNumber,
  type RetailReportsSearchParams,
} from "../_components/retail-reports-ui";

type RetailCashPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<RetailReportsSearchParams>;
};

export default async function RetailCashPage({ params, searchParams }: RetailCashPageProps) {
  const { tenantSlug } = await params;
  const tenant = await resolveRetailPosTypePageContext(tenantSlug, "catalog", "read");
  const filters = buildRetailReportsFilters(await searchParams);
  const report = await getRetailCashShiftReport(tenant.tenantId, filters);

  return (
    <div className="space-y-4">
      <RetailReportsHeader
        title="Cierres y turnos de caja"
        description="Reporte minimo por cash shift para revisar fondo, efectivo esperado, declarado, diferencia y mix de cobro."
        metadata={`Tenant ${tenant.tenantName} · ${report.filters.dateFrom} a ${report.filters.dateTo}`}
      />

      <RetailReportsFiltersCard
        tenantSlug={tenantSlug}
        filters={report.filters}
        devices={report.devices}
        basePath="/retail/reports/cash"
        includeOrderStatus={false}
      />

      <RetailMetricGrid
        items={[
          {
            label: "Turnos",
            value: formatNumber(report.totals.shiftsCount),
            detail: `${formatNumber(report.totals.openShiftsCount)} abiertos · ${formatNumber(report.totals.closedShiftsCount)} cerrados`,
          },
          {
            label: "Ventas efectivo",
            value: formatCurrency(report.totals.totalCashSalesCents),
            detail: `Tarjeta ${formatCurrency(report.totals.totalCardSalesCents)}`,
          },
          {
            label: "Efectivo esperado",
            value: formatCurrency(report.totals.totalExpectedCashCents),
            detail: `Declarado ${formatCurrency(report.totals.totalDeclaredCashCents)}`,
          },
          {
            label: "Diferencia total",
            value: formatCurrency(report.totals.totalDifferenceCents),
            tone: report.totals.totalDifferenceCents !== 0 ? "warning" : "default",
          },
        ]}
      />

      <RetailSectionCard
        title="Detalle por turno"
        description="Incluye terminal, usuario, montos de apertura y cierre, diferencia y volumen de pagos."
      >
        {report.rows.length > 0 ? (
          <RetailCashShiftTable tenantSlug={tenantSlug} report={report} />
        ) : (
          <StatePanel
            kind="empty"
            title="Sin cash shifts en el rango"
            message="No se encontraron aperturas o cierres de caja para las fechas y terminal seleccionadas."
          />
        )}
      </RetailSectionCard>
    </div>
  );
}
