import { StatePanel } from "@/components/ui/state-panel";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import { getRetailSalesReport } from "@/lib/retail-pos/reports";
import {
  RETAIL_REPORTING_PERIOD_NOTES,
  getRetailReportingLabel,
  getRetailReportingTerm,
} from "@/lib/retail-pos/reporting-semantics";
import { RetailReportPeriodContext } from "../_components/RetailReportPeriodContext";
import { RetailSalesActivityChart } from "../_components/charts/RetailSalesActivityChart";
import { RetailSalesAdjustmentsChart } from "../_components/charts/RetailSalesAdjustmentsChart";
import {
  RetailMetricGrid,
  RetailSalesDiscountBreakdown,
  RetailSalesOrdersTable,
  RetailReportsFiltersCard,
  RetailReportsHeader,
  RetailSectionCard,
  buildRetailReportsFilters,
  buildRetailReportHref,
  formatCurrency,
  formatNumber,
  type RetailReportsSearchParams,
} from "../_components/retail-reports-ui";

type RetailSalesPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<RetailReportsSearchParams>;
};

export default async function RetailSalesPage({ params, searchParams }: RetailSalesPageProps) {
  const { tenantSlug } = await params;
  const tenant = await resolveRetailPosTypePageContext(tenantSlug, "catalog", "read");
  const filters = buildRetailReportsFilters(await searchParams);
  const report = await getRetailSalesReport(tenant.tenantId, filters);
  const salesBaseHref = buildRetailReportHref({
    tenantSlug,
    basePath: "/retail/reports/sales",
    filters: report.filters,
  });
  const postSaleBaseHref = buildRetailReportHref({
    tenantSlug,
    basePath: "/retail/reports/post-sale",
    filters: report.filters,
  });
  const hasSales = report.summary.paidOrders > 0;
  const hasPostSale = report.summary.cancelledSalesCount > 0 || report.summary.returnedCents > 0;
  const hasActivity = hasSales || hasPostSale;
  const revertedAmountCents = report.summary.cancelledSalesCents + report.summary.returnedCents;
  const activityTrendPoints = report.activityTrend.points.map((point) => ({
    ...point,
    href: buildRetailReportHref({
      tenantSlug,
      basePath: "/retail/reports/sales",
      filters: report.filters,
      overrides: {
        dateFrom: point.dateFrom,
        dateTo: point.dateTo,
      },
    }),
  }));
  const adjustmentsTrendPoints = report.adjustmentsTrend.points.map((point) => {
    const bucketSalesHref = buildRetailReportHref({
      tenantSlug,
      basePath: "/retail/reports/sales",
      filters: report.filters,
      overrides: {
        dateFrom: point.dateFrom,
        dateTo: point.dateTo,
      },
    });
    const bucketPostSaleHref = buildRetailReportHref({
      tenantSlug,
      basePath: "/retail/reports/post-sale",
      filters: report.filters,
      overrides: {
        dateFrom: point.dateFrom,
        dateTo: point.dateTo,
      },
    });

    return {
      ...point,
      discountHref: `${bucketSalesHref}#sales-discount-breakdown`,
      postSaleHref: bucketPostSaleHref,
    };
  });

  return (
    <div className="space-y-4">
      <RetailReportsHeader
        title="Ventas"
        description="Lectura comercial para venta bruta, descuento concedido, venta cobrada, ticket promedio, postventa registrada y resultado comercial del periodo."
        metadata={`${tenant.tenantName} · ${report.filters.dateFrom} a ${report.filters.dateTo}`}
      />

      <RetailReportsFiltersCard
        tenantSlug={tenantSlug}
        filters={report.filters}
        devices={report.devices}
        basePath="/retail/reports/sales"
      />

      <RetailReportPeriodContext
        periodLabel={`${report.filters.dateFrom} -> ${report.filters.dateTo}`}
        primaryDateLabel={RETAIL_REPORTING_PERIOD_NOTES.sales.primaryDateLabel}
        note={RETAIL_REPORTING_PERIOD_NOTES.sales.note}
      />

      {!hasActivity ? (
        <StatePanel
          kind="empty"
          title="Sin ventas cobradas para este filtro"
          message="No existen ventas cobradas para los filtros seleccionados."
        />
      ) : (
        <>
          <RetailMetricGrid
            items={[
              {
                label: getRetailReportingLabel("collected_sales"),
                value: formatCurrency(report.summary.netSalesCents),
                detail: `${formatNumber(report.summary.paidOrders)} ventas pagadas`,
                explanation: getRetailReportingTerm("collected_sales").description,
                href: salesBaseHref,
                linkLabel: "Ver periodo",
              },
              {
                label: getRetailReportingLabel("commercial_result"),
                value: formatCurrency(report.summary.commercialNetCents),
                detail: `${getRetailReportingLabel("collected_sales")} ${formatCurrency(report.summary.netSalesCents)}`,
                explanation: getRetailReportingTerm("commercial_result").description,
                href: salesBaseHref,
                linkLabel: "Ver resultado",
                tone: hasPostSale ? "warning" : "default",
              },
              {
                label: "Anulaciones y devoluciones",
                value: formatCurrency(revertedAmountCents),
                detail: `${formatNumber(report.summary.cancelledSalesCount)} anulaciones · ${formatNumber(report.summary.fullReturnsCount)} devoluciones totales · ${formatNumber(report.summary.partialReturnsCount)} devoluciones parciales`,
                explanation:
                  "Monto comercial revertido mediante anulaciones de venta pagada y devoluciones registradas durante el periodo.",
                href: postSaleBaseHref,
                linkLabel: "Ir a postventa",
                tone: revertedAmountCents > 0 ? "warning" : "default",
              },
              {
                label: "Ticket promedio",
                value: formatCurrency(report.summary.averageTicketCents),
                detail: `${formatNumber(report.summary.paidOrders)} ventas pagadas consideradas`,
                explanation:
                  "Venta cobrada dividida entre el número de ventas pagadas incluidas en el periodo.",
                href: salesBaseHref,
                linkLabel: "Ver tendencia",
              },
            ]}
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <RetailSectionCard
              title="Actividad de ventas"
              description="Desglose compacto de la actividad efectivamente cobrada durante el periodo."
            >
              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted">{getRetailReportingLabel("gross_sales")}</span>
                  <span className="font-medium text-foreground">{formatCurrency(report.summary.grossSalesCents)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted">Menos: {getRetailReportingLabel("granted_discount")}</span>
                  <span className="font-medium text-foreground">{formatCurrency(report.summary.discountsCents)}</span>
                </div>
                <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
                  <span className="text-muted">{getRetailReportingLabel("collected_sales")}</span>
                  <span className="font-medium text-foreground">{formatCurrency(report.summary.netSalesCents)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted">Número de ventas cobradas</span>
                  <span className="font-medium text-foreground">{formatNumber(report.summary.paidOrders)}</span>
                </div>
              </div>
            </RetailSectionCard>

            <RetailSectionCard
              title="Postventa registrada"
              description="Operaciones registradas durante el periodo que pueden corresponder a ventas cobradas anteriormente."
            >
              {hasPostSale ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted">{getRetailReportingLabel("paid_sale_cancellation")}</span>
                    <span className="font-medium text-foreground">
                      {formatNumber(report.summary.cancelledSalesCount)} · {formatCurrency(report.summary.cancelledSalesCents)}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted">Devoluciones totales</span>
                    <span className="font-medium text-foreground">{formatNumber(report.summary.fullReturnsCount)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted">Devoluciones parciales</span>
                    <span className="font-medium text-foreground">{formatNumber(report.summary.partialReturnsCount)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted">{getRetailReportingLabel("returned_amount")}</span>
                    <span className="font-medium text-foreground">{formatCurrency(report.summary.returnedCents)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
                    <span className="text-muted">Monto comercial revertido total</span>
                    <span className="font-medium text-foreground">{formatCurrency(revertedAmountCents)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">No se registraron anulaciones o devoluciones en este periodo.</p>
              )}
            </RetailSectionCard>
          </div>

          <RetailSectionCard
            title="Resultado"
            description="Relación compacta entre la venta cobrada, la postventa registrada y el resultado comercial del periodo."
          >
            <p className="text-sm text-foreground">
              {getRetailReportingLabel("collected_sales")} - anulaciones - devoluciones ={" "}
              {getRetailReportingLabel("commercial_result")}
            </p>
          </RetailSectionCard>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <RetailSalesActivityChart
              granularity={report.activityTrend.granularity}
              points={activityTrendPoints}
            />
            <RetailSalesAdjustmentsChart
              granularity={report.adjustmentsTrend.granularity}
              points={adjustmentsTrendPoints}
            />
          </div>

          <RetailSectionCard
            id="sales-discount-breakdown"
            title="Descuentos y operaciones debajo del costo"
            description="Descuento total concedido, desglose por motivo y usuario, y número de operaciones con al menos una línea debajo del costo."
          >
            <RetailSalesDiscountBreakdown report={report} />
          </RetailSectionCard>

          <RetailSectionCard
            title="Ventas del rango"
            description="Folio, fecha de cobro, total antes de descuento, descuento concedido, venta cobrada, método de cobro y estado de postventa."
          >
            {report.orders.length > 0 ? (
              <RetailSalesOrdersTable tenantSlug={tenantSlug} filters={report.filters} orders={report.orders} />
            ) : (
              <StatePanel
                kind="empty"
                title="Sin ventas cobradas para este filtro"
                message="No existen ventas cobradas para los filtros seleccionados."
              />
            )}
          </RetailSectionCard>
        </>
      )}
    </div>
  );
}
