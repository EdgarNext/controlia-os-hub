import { StatePanel } from "@/components/ui/state-panel";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import { getRetailPostSaleReport } from "@/lib/retail-pos/reports";
import { RETAIL_REPORTING_PERIOD_NOTES } from "@/lib/retail-pos/reporting-semantics";
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
      | "mixed"
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
        description="Reporte específico para ventas canceladas, devoluciones y reembolsos registrados dentro del rango seleccionado."
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
              <option value="sale_cancellation">Cancelación de venta pagada</option>
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
              <option value="mixed">Mixto</option>
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
          title="Sin cancelaciones en el periodo"
          message="No hay cancelaciones en el periodo o con los filtros seleccionados."
        />
      ) : (
        <>
          <RetailMetricGrid
            items={[
              {
                label: "Documentos de cancelación",
                value: formatNumber(report.summary.cancellation_documents_count ?? report.summary.cancelledSalesCount),
                detail: `${formatNumber(report.summary.completed_documents_count ?? 0)} completados · ${formatNumber(report.summary.pending_documents_count ?? 0)} pendientes`,
                explanation: "Una fila y un conteo por documento de postventa; los componentes no se cuentan como documentos.",
              },
              {
                label: "Monto de cancelaciones",
                value: formatCurrency(report.summary.total_cancelled_cents ?? report.summary.revertedAmountCents),
                detail: `${formatNumber(report.summary.cash_only_cancellations_count ?? 0)} efectivo · ${formatNumber(report.summary.card_only_cancellations_count ?? 0)} tarjeta · ${formatNumber(report.summary.mixed_cancellations_count ?? 0)} mixtos`,
                explanation: "Importe comercial de los documentos en el periodo, independiente del método de devolución.",
              },
              {
                label: "Efectivo devuelto",
                value: formatCurrency(report.summary.completed_cash_refunds_cents ?? report.summary.cashRefundsCompletedCents),
                detail: `Tarjeta confirmada ${formatCurrency(report.summary.completed_card_refunds_cents ?? report.summary.cardRefundsCompletedCents)}`,
                explanation: "Solo efectivo completado afecta la conciliación física de caja.",
              },
              {
                label: "Tarjeta pendiente",
                value: formatCurrency(report.summary.pending_card_refunds_cents ?? report.summary.pendingRefundCents),
                detail: hasPendingRefunds
                  ? `${formatNumber(report.summary.pending_documents_count ?? report.summary.pendingRefundsCount)} documentos pendientes`
                  : "No hay reembolsos de tarjeta pendientes.",
                explanation: "La tarjeta pendiente no se presenta como reembolso completado ni reduce el efectivo esperado.",
                tone: hasPendingRefunds ? "warning" : "default",
              },
            ]}
          />

          <RetailSectionCard
            title="Conciliación de postventa"
            description="La conciliación usa componentes modernos; el movimiento físico de caja se compara solo contra efectivo completado."
          >
            <div className="grid gap-3 md:grid-cols-3">
              {(report.summary.warnings ?? []).map((warning) => (
                <div key={warning} className="rounded-[var(--radius-base)] border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">{warning}</div>
              ))}
              {(report.summary.warnings ?? []).length === 0 ? (
                <div className="rounded-[var(--radius-base)] border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100 md:col-span-3">Conciliación correcta.</div>
              ) : null}
            </div>
            <div className="mt-3 text-xs text-muted">
              {formatNumber(report.summary.refund_components_count ?? 0)} componentes · {formatNumber(report.summary.cash_components_count ?? 0)} efectivo · {formatNumber(report.summary.card_components_count ?? 0)} tarjeta
            </div>
          </RetailSectionCard>

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
