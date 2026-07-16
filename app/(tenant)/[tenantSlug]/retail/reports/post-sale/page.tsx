import { StatePanel } from "@/components/ui/state-panel";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import { getRetailPostSaleReport } from "@/lib/retail-pos/reports";
import { RETAIL_REPORTING_PERIOD_NOTES, getRetailReportingLabel } from "@/lib/retail-pos/reporting-semantics";
import { RetailReportPeriodContext } from "../_components/RetailReportPeriodContext";
import { RetailPostSaleReasonsChart } from "../_components/charts/RetailPostSaleReasonsChart";
import { RetailPostSaleTrendChart } from "../_components/charts/RetailPostSaleTrendChart";
import { RetailRefundStatusChart } from "../_components/charts/RetailRefundStatusChart";
import {
  buildRetailPostSaleReportHref,
  RetailMetricGrid,
  RetailPostSaleRefundBreakdown,
  RetailPostSaleSummaryTables,
  RetailPostSaleTable,
  RetailReportsHeader,
  RetailSectionCard,
  formatCurrency,
  formatNumber,
  formatPostSaleReason,
  getSingleSearchParam,
  type RetailReportsSearchParams,
} from "../_components/retail-reports-ui";

type RetailPostSalePageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<RetailReportsSearchParams>;
};

export default async function RetailPostSalePage({ params, searchParams }: RetailPostSalePageProps) {
  const { tenantSlug } = await params;
  const tenant = await resolveRetailPosTypePageContext(tenantSlug, "catalog", "read");
  const resolvedSearchParams = await searchParams;
  const report = await getRetailPostSaleReport(tenant.tenantId, {
    dateFrom: getSingleSearchParam(resolvedSearchParams.dateFrom) ?? undefined,
    dateTo: getSingleSearchParam(resolvedSearchParams.dateTo) ?? undefined,
    operationType: (getSingleSearchParam(resolvedSearchParams.operationType) as
      | "all"
      | "sale_cancellation"
      | "return_full"
      | "return_partial"
      | undefined) ?? undefined,
    refundStatus: (getSingleSearchParam(resolvedSearchParams.refundStatus) as
      | "all"
      | "not_required"
      | "pending"
      | "completed"
      | "failed"
      | "cancelled"
      | undefined) ?? undefined,
    refundMethod: (getSingleSearchParam(resolvedSearchParams.refundMethod) as
      | "all"
      | "cash"
      | "card_external"
      | "store_credit_future"
      | undefined) ?? undefined,
    reasonCode: getSingleSearchParam(resolvedSearchParams.reasonCode) ?? undefined,
    responsibleUserId: getSingleSearchParam(resolvedSearchParams.responsibleUserId) ?? undefined,
  });
  const hasPendingRefunds = report.summary.pendingRefundCents > 0 || report.summary.pendingRefundsCount > 0;
  const postSaleTrendPoints = report.trend.points.map((point) => ({
    ...point,
    saleCancellationHref: buildRetailPostSaleReportHref({
      tenantSlug,
      filters: report.filters,
      overrides: {
        dateFrom: point.dateFrom,
        dateTo: point.dateTo,
        operationType: "sale_cancellation",
      },
    }),
    fullReturnHref: buildRetailPostSaleReportHref({
      tenantSlug,
      filters: report.filters,
      overrides: {
        dateFrom: point.dateFrom,
        dateTo: point.dateTo,
        operationType: "return_full",
      },
    }),
    partialReturnHref: buildRetailPostSaleReportHref({
      tenantSlug,
      filters: report.filters,
      overrides: {
        dateFrom: point.dateFrom,
        dateTo: point.dateTo,
        operationType: "return_partial",
      },
    }),
  }));
  const reasonsChartRows = report.byReason.map((row) => ({
    ...row,
    label: formatPostSaleReason(row.reasonCode),
    href: buildRetailPostSaleReportHref({
      tenantSlug,
      filters: report.filters,
      overrides: {
        reasonCode: row.reasonCode,
      },
    }),
  }));
  const refundStatusChartRows = report.refundStatusBreakdown.map((row) => ({
    ...row,
    href: buildRetailPostSaleReportHref({
      tenantSlug,
      filters: report.filters,
      overrides: {
        refundStatus: row.refundStatus,
      },
    }),
  }));

  return (
    <div className="space-y-4">
      <RetailReportsHeader
        title="Postventa"
        description="Reporte específico para anulaciones de venta pagada, devoluciones y reembolsos registrados dentro del rango seleccionado."
        metadata={`${tenant.tenantName} · ${report.filters.dateFrom} a ${report.filters.dateTo}`}
      />

      <RetailSectionCard
        title="Filtros de postventa"
        description="Usa fecha registrada, tipo de operación, estado del reembolso, motivo y usuario responsable para revisar el impacto comercial y financiero."
      >
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-6" action={`/${tenantSlug}/retail/reports/post-sale`}>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted">Desde</span>
            <input
              type="date"
              name="dateFrom"
              defaultValue={report.filters.dateFrom}
              className="w-full rounded-[var(--radius-base)] border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted">Hasta</span>
            <input
              type="date"
              name="dateTo"
              defaultValue={report.filters.dateTo}
              className="w-full rounded-[var(--radius-base)] border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted">Operación</span>
            <select
              name="operationType"
              defaultValue={report.filters.operationType}
              className="w-full rounded-[var(--radius-base)] border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">Todas</option>
              <option value="sale_cancellation">Anulación de venta pagada</option>
              <option value="return_full">Devolución total</option>
              <option value="return_partial">Devolución parcial</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted">Estado del reembolso</span>
            <select
              name="refundStatus"
              defaultValue={report.filters.refundStatus}
              className="w-full rounded-[var(--radius-base)] border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">Todos</option>
              <option value="not_required">No requerido</option>
              <option value="pending">Pendiente</option>
              <option value="completed">Completado</option>
              <option value="failed">Fallido</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted">Tipo de reembolso</span>
            <select
              name="refundMethod"
              defaultValue={report.filters.refundMethod}
              className="w-full rounded-[var(--radius-base)] border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">Todos</option>
              <option value="cash">Efectivo</option>
              <option value="card_external">Tarjeta</option>
              <option value="store_credit_future">Crédito futuro</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted">Motivo</span>
            <select
              name="reasonCode"
              defaultValue={report.filters.reasonCode ?? "all"}
              className="w-full rounded-[var(--radius-base)] border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">Todos</option>
              {report.reasonOptions.map((row) => (
                <option key={row.reasonCode} value={row.reasonCode}>
                  {formatPostSaleReason(row.reasonCode)}
                </option>
              ))}
            </select>
          </label>
          {report.responsibleUsers.length > 0 ? (
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted">Usuario responsable</span>
              <select
                name="responsibleUserId"
                defaultValue={report.filters.responsibleUserId ?? "all"}
                className="w-full rounded-[var(--radius-base)] border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="all">Todos</option>
                {report.responsibleUsers.map((row) => (
                  <option key={row.posUserId} value={row.posUserId}>
                    {row.posUserName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Aplicar
            </button>
          </div>
        </form>
      </RetailSectionCard>

      <RetailReportPeriodContext
        periodLabel={`${report.filters.dateFrom} -> ${report.filters.dateTo}`}
        primaryDateLabel={RETAIL_REPORTING_PERIOD_NOTES.post_sale.primaryDateLabel}
        note={RETAIL_REPORTING_PERIOD_NOTES.post_sale.note}
      />

      {report.rows.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Sin operaciones de postventa"
          message="No se registraron operaciones de postventa en este periodo."
        />
      ) : (
        <>
          <RetailMetricGrid
            items={[
              {
                label: "Anulaciones de venta pagada",
                value: formatNumber(report.summary.cancelledSalesCount),
                detail: `Monto anulado ${formatCurrency(report.summary.cancelledSalesCents)}`,
                explanation: getRetailReportingLabel("paid_sale_cancellation"),
              },
              {
                label: "Devoluciones",
                value: formatNumber(report.summary.returnsCount),
                detail: `${formatNumber(report.summary.fullReturnsCount)} totales · ${formatNumber(report.summary.partialReturnsCount)} parciales · ${formatCurrency(report.summary.returnedCents)}`,
                explanation: "Incluye devoluciones totales y parciales registradas durante el periodo.",
              },
              {
                label: "Monto comercial revertido",
                value: formatCurrency(report.summary.revertedAmountCents),
                detail: `${formatCurrency(report.summary.cancelledSalesCents)} anulaciones · ${formatCurrency(report.summary.returnedCents)} devoluciones`,
                explanation:
                  "Monto de ventas cobradas que fue revertido mediante anulaciones o devoluciones registradas durante el periodo.",
              },
              {
                label: "Reembolsos pendientes",
                value: formatCurrency(report.summary.pendingRefundCents),
                detail: hasPendingRefunds
                  ? `${formatNumber(report.summary.pendingRefundsCount)} reembolsos pendientes`
                  : "No hay reembolsos pendientes.",
                explanation: "Los reembolsos pendientes requieren atención, pero no representan una salida ya completada.",
                tone: hasPendingRefunds ? "warning" : "default",
              },
            ]}
          />

          <RetailSectionCard
            title="Desglose de reembolsos"
            description="Separa reembolsos completados y pendientes por método sin mezclarlos con el monto comercial revertido."
          >
            <RetailPostSaleRefundBreakdown report={report} />
          </RetailSectionCard>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <RetailPostSaleTrendChart granularity={report.trend.granularity} points={postSaleTrendPoints} />
            <div className="grid gap-4">
              <RetailPostSaleReasonsChart rows={reasonsChartRows} />
              <RetailRefundStatusChart data={refundStatusChartRows} />
            </div>
          </div>

          <RetailSectionCard
            title="Análisis por usuario y motivos"
            description="Este desglose muestra quién registró las operaciones y qué motivos concentran la actividad. No representa una evaluación de desempeño."
          >
            <RetailPostSaleSummaryTables report={report} />
          </RetailSectionCard>

          <RetailSectionCard
            title="Operaciones de postventa"
            description="Cada operación conserva fecha registrada, tipo, venta original, monto comercial, reembolso asociado, motivo y usuario responsable."
          >
            <RetailPostSaleTable tenantSlug={tenantSlug} report={report} />
          </RetailSectionCard>
        </>
      )}
    </div>
  );
}
