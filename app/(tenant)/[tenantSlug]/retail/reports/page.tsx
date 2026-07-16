import { StatePanel } from "@/components/ui/state-panel";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import { getRetailReportsOverview } from "@/lib/retail-pos/reports";
import { RETAIL_REPORTING_PERIOD_NOTES, getRetailReportingLabel, getRetailReportingTerm } from "@/lib/retail-pos/reporting-semantics";
import { RetailAttentionBlock } from "./_components/RetailAttentionBlock";
import { RetailReportPeriodContext } from "./_components/RetailReportPeriodContext";
import { RetailCommercialWaterfallChart } from "./_components/charts/RetailCommercialWaterfallChart";
import { RetailPaymentMixChart } from "./_components/charts/RetailPaymentMixChart";
import { RetailSalesTrendChart } from "./_components/charts/RetailSalesTrendChart";
import {
  RetailAuditPanel,
  RetailMetricGrid,
  RetailOverviewRecentOrdersTable,
  RetailReportsFiltersCard,
  RetailReportsHeader,
  RetailSectionCard,
  buildRetailReportsFilters,
  buildRetailReportHref,
  formatCurrency,
  formatNumber,
  type RetailReportsSearchParams,
} from "./_components/retail-reports-ui";

type RetailReportsOverviewPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<RetailReportsSearchParams>;
};

export default async function RetailReportsOverviewPage({
  params,
  searchParams,
}: RetailReportsOverviewPageProps) {
  const { tenantSlug } = await params;
  const tenant = await resolveRetailPosTypePageContext(tenantSlug, "catalog", "read");
  const filters = buildRetailReportsFilters(await searchParams);
  const overview = await getRetailReportsOverview(tenant.tenantId, filters);
  const paidSalesHref = buildRetailReportHref({
    tenantSlug,
    basePath: "/retail/reports/sales",
    filters: overview.filters,
  });
  const pendingOrdersHref = buildRetailReportHref({
    tenantSlug,
    basePath: "/retail/reports/sales",
    filters: overview.filters,
    overrides: {
      orderStatus: "pending_payment",
    },
  });
  const postSaleHref = buildRetailReportHref({
    tenantSlug,
    basePath: "/retail/reports/post-sale",
    filters: overview.filters,
  });
  const cashHref = buildRetailReportHref({
    tenantSlug,
    basePath: "/retail/reports/cash",
    filters: overview.filters,
  });
  const discountHref = `${paidSalesHref}#sales-discount-breakdown`;
  const hasPrintEvents =
    overview.audit.printedCount > 0 || overview.audit.reprintedCount > 0 || overview.audit.failedPrintCount > 0;
  const hasActivity =
    overview.summary.paidOrders > 0 ||
    overview.summary.pendingOrders > 0 ||
    overview.summary.cancelledSalesCount > 0 ||
    overview.summary.totalReturnDocumentsCount > 0 ||
    overview.summary.openShiftsCount > 0 ||
    hasPrintEvents;
  const attentionItems = overview.attention.map((signal) => {
    switch (signal.key) {
      case "pending_reimbursements":
        return {
          id: signal.key,
          title: getRetailReportingLabel("pending_reimbursements"),
          description:
            "Existen reembolsos todavía no completados. Se muestran como movimiento financiero pendiente y no como una reducción adicional del resultado comercial.",
          quantity: signal.quantity ? formatNumber(signal.quantity) : null,
          amount: signal.amountCents !== null ? formatCurrency(signal.amountCents) : null,
          href: postSaleHref,
          linkLabel: "Revisar postventa",
          tone: "warning" as const,
        };
      case "pending_orders":
        return {
          id: signal.key,
          title: "Pedidos pendientes de cobro",
          description:
            "Hay pedidos en estado pendiente de cobro dentro del rango actual. Conviene revisar si siguen abiertos o si requieren seguimiento operativo.",
          quantity: signal.quantity ? formatNumber(signal.quantity) : null,
          amount: null,
          href: pendingOrdersHref,
          linkLabel: "Ver pendientes",
          tone: "warning" as const,
        };
      case "open_shifts":
        return {
          id: signal.key,
          title: "Turnos abiertos",
          description: "Se detectaron turnos todavía abiertos dentro del rango consultado.",
          quantity: signal.quantity ? formatNumber(signal.quantity) : null,
          amount: null,
          href: cashHref,
          linkLabel: "Ir a Caja",
          tone: "warning" as const,
        };
      case "below_cost_orders":
        return {
          id: signal.key,
          title: "Operaciones con líneas debajo del costo",
          description:
            "El indicador refleja órdenes cobradas que contienen al menos una línea marcada debajo del costo. No implica cálculo de pérdida o margen.",
          quantity: signal.quantity ? formatNumber(signal.quantity) : null,
          amount: null,
          href: discountHref,
          linkLabel: "Revisar descuentos",
          tone: "warning" as const,
        };
      case "failed_prints":
        return {
          id: signal.key,
          title: "Incidencias de impresión",
          description: "Se registraron fallos reales de impresión durante el periodo seleccionado.",
          quantity: signal.quantity ? formatNumber(signal.quantity) : null,
          amount: null,
          href: "#resumen-auditoria-impresion",
          linkLabel: "Ver auditoría",
          tone: "warning" as const,
        };
      default:
        return {
          id: signal.key,
          title: signal.key,
          description: "",
          quantity: null,
          amount: null,
        };
    }
  });
  const waterfallData = overview.commercialWaterfall.map((item) => ({
    ...item,
    href:
      item.key === "discounts"
        ? discountHref
        : item.key === "sale_cancellations" || item.key === "returns"
          ? postSaleHref
          : paidSalesHref,
  }));
  const trendPoints = overview.salesTrend.points.map((point) => ({
    ...point,
    href: buildRetailReportHref({
      tenantSlug,
      basePath: "/retail/reports/sales",
      filters: overview.filters,
      overrides: {
        dateFrom: point.dateFrom,
        dateTo: point.dateTo,
      },
    }),
  }));
  const paymentMixData = overview.paymentMix.map((item) => ({
    ...item,
    href: paidSalesHref,
  }));

  return (
    <div className="space-y-4">
      <RetailReportsHeader
        title="Resumen retail"
        description="Vista ejecutiva y operativa para venta cobrada, resultado comercial, descuentos concedidos, asuntos de atención y evolución del periodo seleccionado."
        metadata={`${tenant.tenantName} · ${overview.dateRangeLabel}`}
      />

      <RetailReportsFiltersCard
        tenantSlug={tenantSlug}
        filters={overview.filters}
        devices={overview.devices}
        basePath="/retail/reports"
      />

      <RetailReportPeriodContext
        periodLabel={overview.dateRangeLabel}
        primaryDateLabel={RETAIL_REPORTING_PERIOD_NOTES.overview.primaryDateLabel}
        note={RETAIL_REPORTING_PERIOD_NOTES.overview.note}
      />

      {!hasActivity ? (
        <StatePanel
          kind="empty"
          title="Sin actividad en el periodo seleccionado"
          message="No existen ventas cobradas para los filtros seleccionados."
        />
      ) : (
        <>
          <RetailMetricGrid
            items={[
              {
                label: getRetailReportingLabel("collected_sales"),
                value: formatCurrency(overview.summary.netSalesCents),
                detail: `${formatNumber(overview.summary.paidOrders)} pedidos pagados`,
                explanation: getRetailReportingTerm("collected_sales").description,
                href: paidSalesHref,
                linkLabel: "Ver ventas",
              },
              {
                label: getRetailReportingLabel("commercial_result"),
                value: formatCurrency(overview.summary.commercialNetCents),
                detail: `${getRetailReportingLabel("paid_sale_cancellation")} ${formatCurrency(overview.summary.cancelledSalesCents)} · ${getRetailReportingLabel("returned_amount")} ${formatCurrency(overview.summary.returnedCents)}`,
                explanation: getRetailReportingTerm("commercial_result").description,
                href: paidSalesHref,
                linkLabel: "Ver detalle",
                tone:
                  overview.summary.cancelledSalesCents > 0 || overview.summary.returnedCents > 0
                    ? "warning"
                    : "default",
              },
              {
                label: getRetailReportingLabel("granted_discount"),
                value: formatCurrency(overview.summary.discountsCents),
                detail: `${formatNumber(overview.discountBreakdown.byReason.length)} motivos registrados`,
                explanation: getRetailReportingTerm("granted_discount").description,
                href: discountHref,
                linkLabel: "Revisar descuentos",
              },
              {
                label: "Pendientes de cobro",
                value: formatNumber(overview.summary.pendingOrders),
                detail: `${formatNumber(overview.summary.totalOrders)} pedidos visibles en el rango`,
                href: pendingOrdersHref,
                linkLabel: "Ver pendientes",
                tone: overview.summary.pendingOrders > 0 ? "warning" : "default",
              },
            ]}
          />

          <RetailSectionCard
            title="Desglose del resultado comercial"
            description="Separa los ajustes ya incluidos en el resultado comercial de los movimientos financieros que todavía están pendientes."
          >
            {overview.summary.cancelledSalesCents > 0 ||
            overview.summary.returnedCents > 0 ||
            overview.summary.pendingRefundCents > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Ajustes incluidos en el resultado</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted">{getRetailReportingLabel("paid_sale_cancellation")}</span>
                      <span className="font-medium text-foreground">{formatCurrency(overview.summary.cancelledSalesCents)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted">{getRetailReportingLabel("returned_amount")}</span>
                      <span className="font-medium text-foreground">{formatCurrency(overview.summary.returnedCents)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[var(--radius-base)] border border-warning/40 bg-warning/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Movimiento financiero pendiente</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted">{getRetailReportingLabel("pending_reimbursements")}</span>
                      <span className="font-medium text-foreground">{formatCurrency(overview.summary.pendingRefundCents)}</span>
                    </div>
                    <p className="text-xs text-muted">
                      Este importe no vuelve a descontarse del resultado comercial del periodo.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">No se registraron anulaciones o devoluciones en este periodo.</p>
            )}
          </RetailSectionCard>

          <RetailAttentionBlock items={attentionItems} />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
            <RetailCommercialWaterfallChart data={waterfallData} />
            <RetailPaymentMixChart data={paymentMixData} />
          </div>

          <RetailSalesTrendChart granularity={overview.salesTrend.granularity} points={trendPoints} />

          <RetailSectionCard
            title="Pedidos recientes"
            description="Folio, estado, fecha relevante, total, método de cobro y señales rápidas de descuento o postventa."
          >
            {overview.recentOrders.length > 0 ? (
              <RetailOverviewRecentOrdersTable
                tenantSlug={tenantSlug}
                filters={overview.filters}
                orders={overview.recentOrders}
              />
            ) : (
              <StatePanel
                kind="empty"
                title="Sin pedidos recientes para este rango"
                message="No hay pedidos visibles para resumir en la tabla del periodo seleccionado."
              />
            )}
          </RetailSectionCard>

          {hasPrintEvents ? (
            <RetailSectionCard
              id="resumen-auditoria-impresion"
              title="Auditoría de impresión"
              description="Sección secundaria para evidencia real de impresiones, reimpresiones y fallos registrados."
            >
              <RetailAuditPanel audit={overview.audit} />
            </RetailSectionCard>
          ) : null}
        </>
      )}
    </div>
  );
}
