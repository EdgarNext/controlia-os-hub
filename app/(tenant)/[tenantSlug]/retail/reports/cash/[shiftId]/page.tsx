import Link from "next/link";
import { notFound } from "next/navigation";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import { getRetailPosZReportByCashShift } from "@/lib/retail-pos/reports";
import { RETAIL_REPORTING_PERIOD_NOTES, getRetailReportingLabel } from "@/lib/retail-pos/reporting-semantics";
import { formatRetailReportAuditNote } from "@/lib/retail-pos/reporting-ui";
import { formatReportOperatorName, formatReportRoleLabel, formatReportStationName } from "@/lib/retail-pos/report-presentation";
import { RetailReportPeriodContext } from "../../_components/RetailReportPeriodContext";
import {
  RetailMetricGrid,
  RetailFinancialSummaryPanel,
  RetailPaymentMethodsTable,
  RetailReportsHeader,
  RetailSectionCard,
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatPaymentMethodLabel,
  formatPrintEvidenceStatus,
} from "../../_components/retail-reports-ui";

type RetailZReportPageProps = {
  params: Promise<{ tenantSlug: string; shiftId: string }>;
};

function getStatusTone(status: "open" | "closed" | "canceled") {
  if (status === "closed") {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "canceled") {
    return "bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }

  return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function getStatusLabel(status: "open" | "closed" | "canceled") {
  if (status === "closed") {
    return "Cerrado";
  }

  if (status === "canceled") {
    return "Cancelado";
  }

  return "Abierto";
}

function formatPendingCurrency(value: number | null) {
  return value === null ? "Pendiente" : formatCurrency(value);
}

export default async function RetailZReportPage({ params }: RetailZReportPageProps) {
  const { tenantSlug, shiftId } = await params;
  const tenant = await resolveRetailPosTypePageContext(tenantSlug, "catalog", "read");

  let report;
  try {
    report = await getRetailPosZReportByCashShift({
      tenantId: tenant.tenantId,
      shiftId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RETAIL_POS_Z_REPORT_NOT_FOUND") {
      notFound();
    }

    throw error;
  }

  const statusDescription =
    report.status === "closed"
      ? "Cierre operativo del turno calculado desde un turno cerrado."
      : report.status === "open"
        ? "El turno sigue abierto. Esta vista muestra un corte operativo y no un cierre definitivo."
        : "El turno fue cancelado. La lectura se conserva como referencia administrativa.";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <RetailReportsHeader
            title={getRetailReportingLabel("shift_operational_close")}
            description="Vista de solo lectura por turno de caja, también conocida como Reporte Z."
            metadata={`${tenant.tenantName} · ${formatReportStationName({ deviceName: report.deviceName, role: report.deviceRole })}`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusTone(report.status)}`}>
              {getStatusLabel(report.status)}
            </span>
            <span className="text-xs text-muted">{statusDescription}</span>
          </div>
        </div>

        <Link
          href={`/${tenantSlug}/retail/reports/cash`}
          className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-base)] border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
        >
          Volver a Caja
        </Link>
      </div>

      <RetailReportPeriodContext
        periodLabel={`${formatReportStationName({ deviceName: report.deviceName, role: report.deviceRole })} · ${formatDateTime(report.openedAt)}`}
        primaryDateLabel={RETAIL_REPORTING_PERIOD_NOTES.z_report.primaryDateLabel}
        note={RETAIL_REPORTING_PERIOD_NOTES.z_report.note}
      />

      <RetailFinancialSummaryPanel summary={report.financialSummary} title="Resumen financiero del turno" compact />

      <RetailMetricGrid
        items={[
          {
            label: "Ventas brutas",
            value: formatCurrency(report.financialSummary.gross_sales_cents),
            detail: `${formatNumber(report.financialSummary.sales_count)} ventas · ${formatNumber(report.financialSummary.payment_transactions_count)} transacciones`,
          },
          {
            label: "Cobro por componentes",
            value: formatCurrency(report.financialSummary.cash_sales_cents),
            detail: `Efectivo · Tarjeta ${formatCurrency(report.financialSummary.card_sales_cents)} · Mixtas ${formatNumber(report.financialSummary.mixed_sales_count)}`,
          },
          {
            label: "Resultado comercial del periodo",
            value: formatCurrency(report.financialSummary.settled_net_sales_cents),
            detail: `${formatCurrency(report.financialSummary.completed_refunds_cents)} reembolsos completados`,
          },
          {
            label: "Reembolsos de tarjeta pendientes",
            value: formatCurrency(report.financialSummary.pending_card_refunds_cents),
            detail: "No disminuyen el efectivo esperado hasta completarse",
            tone: report.financialSummary.pending_card_refunds_cents > 0 ? "warning" : "default",
          },
          {
            label: getRetailReportingLabel("cash_difference"),
            value: formatPendingCurrency(report.differenceCents),
            tone: report.differenceCents !== null && report.differenceCents !== 0 ? "warning" : "default",
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <RetailSectionCard title="Identificación del turno" description="Contexto operativo y administrativo del turno.">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted">Turno</dt>
              <dd className="text-sm text-foreground">{formatReportStationName({ deviceName: report.deviceName, role: report.deviceRole })} · {formatDateTime(report.openedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Terminal</dt>
              <dd className="text-sm text-foreground">{formatReportStationName({ deviceName: report.deviceName, role: report.deviceRole })}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Rol</dt>
              <dd className="text-sm text-foreground">{formatReportRoleLabel(report.deviceRole)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Generado</dt>
              <dd className="text-sm text-foreground">{formatDateTime(report.generatedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Apertura</dt>
              <dd className="text-sm text-foreground">
                {formatDateTime(report.openedAt)} · {formatReportOperatorName(report.openedByName)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Cierre</dt>
              <dd className="text-sm text-foreground">
                {formatDateTime(report.closedAt)} · {formatReportOperatorName(report.closedByName)}
              </dd>
            </div>
          </dl>
        </RetailSectionCard>

        <RetailSectionCard title="Resumen de caja" description="Montos base del cierre y lectura de diferencia de caja.">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted">Fondo inicial</dt>
              <dd className="text-sm text-foreground">{formatCurrency(report.openingFloatCents)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Efectivo recibido</dt>
              <dd className="text-sm text-foreground">{formatCurrency(report.financialSummary.cash_received_cents)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Cambio entregado</dt>
              <dd className="text-sm text-foreground">{formatCurrency(report.financialSummary.cash_change_cents)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">{getRetailReportingLabel("expected_cash_from_sales_and_reimbursements")}</dt>
              <dd className="text-sm text-foreground">{formatPendingCurrency(report.expectedCashCents)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">{getRetailReportingLabel("declared_cash")}</dt>
              <dd className="text-sm text-foreground">{formatPendingCurrency(report.declaredCashCents)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">{getRetailReportingLabel("cash_difference")}</dt>
              <dd className="text-sm font-medium text-foreground">{formatPendingCurrency(report.differenceCents)}</dd>
            </div>
          </dl>
        </RetailSectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <RetailSectionCard title="Cobros por método" description="Totales del turno por tipo de cobro.">
          <RetailPaymentMethodsTable paymentMethods={report.paymentMethods} />
        </RetailSectionCard>

        <RetailSectionCard title="Operaciones" description="Volumen operativo consolidado del turno.">
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-xs font-medium text-muted">{getRetailReportingLabel("gross_sales")}</dt>
              <dd className="text-lg font-semibold text-foreground">
                {formatCurrency(report.totalSalesCents + (report.future.discountsCents ?? 0))}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">{getRetailReportingLabel("granted_discount")}</dt>
              <dd className="text-lg font-semibold text-foreground">
                {formatCurrency(report.future.discountsCents ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">{getRetailReportingLabel("paid_sale_cancellation")}</dt>
              <dd className="text-lg font-semibold text-foreground">
                {formatCurrency(report.future.cancellationsAmountCents ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">{getRetailReportingLabel("return_operation")}</dt>
              <dd className="text-lg font-semibold text-foreground">
                {formatCurrency(report.future.returnedAmountCents ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">{getRetailReportingLabel("commercial_result")}</dt>
              <dd className="text-lg font-semibold text-foreground">
                {formatCurrency(report.future.commercialNetCents ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Componentes de cobro</dt>
              <dd className="text-lg font-semibold text-foreground">{formatNumber(report.financialSummary.tenders_count)}</dd>
              <p className="text-xs text-muted">{formatNumber(report.financialSummary.payment_transactions_count)} transacciones</p>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Ordenes pagadas</dt>
              <dd className="text-lg font-semibold text-foreground">{formatNumber(report.paidOrdersCount)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Ticket promedio</dt>
              <dd className="text-lg font-semibold text-foreground">{formatCurrency(report.averageTicketCents)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">{getRetailReportingLabel("collected_lines")}</dt>
              <dd className="text-lg font-semibold text-foreground">{formatNumber(report.linesSummary.soldLinesCount)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">{getRetailReportingLabel("collected_units")}</dt>
              <dd className="text-lg font-semibold text-foreground">{formatNumber(report.linesSummary.soldUnits)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Devoluciones de efectivo por venta cancelada</dt>
              <dd className="text-lg font-semibold text-foreground">
                {formatCurrency(report.future.cancellationRefundsCashCents ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Reembolsos en efectivo por devolución</dt>
              <dd className="text-lg font-semibold text-foreground">
                {formatCurrency(report.future.returnRefundsCashCents ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">{getRetailReportingLabel("card_reimbursements")}</dt>
              <dd className="text-lg font-semibold text-foreground">
                {formatCurrency(report.future.returnRefundsCardCompletedCents ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">{getRetailReportingLabel("pending_reimbursements")}</dt>
              <dd className="text-lg font-semibold text-foreground">
                {formatCurrency(report.future.returnRefundsCardPendingCents ?? 0)}
              </dd>
            </div>
          </dl>
        </RetailSectionCard>
      </div>

      <RetailSectionCard title="Órdenes incluidas" description="Solo se consideran órdenes asociadas a cobros del turno.">
        {report.orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-2 py-2">Folio</th>
                  <th className="px-2 py-2">Pagado en</th>
                  <th className="px-2 py-2">Tipo de cobro</th>
                  <th className="px-2 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.orders.map((order) => (
                  <tr key={order.orderId} className="border-b border-border/60 align-top text-foreground">
                    <td className="px-2 py-2 font-medium">{order.folio}</td>
                    <td className="px-2 py-2">{formatDateTime(order.paidAt)}</td>
                    <td className="px-2 py-2">
                      {formatPaymentMethodLabel(order.paymentMethod)}
                    </td>
                    <td className="px-2 py-2">{formatCurrency(order.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <StatePanel
            kind="empty"
            title="Sin operaciones asociadas a este turno"
            message="No se encontraron operaciones asociadas a este turno."
          />
        )}
      </RetailSectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <RetailSectionCard title="Observaciones" description="Notas operativas y asuntos detectados en este cierre.">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted">Nota de cierre</p>
              <p className="text-sm text-foreground">{report.closingNote?.trim() || "Sin nota de cierre."}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted">Asuntos a revisar</p>
              {report.warnings.length > 0 ? (
                <ul className="space-y-2">
                  {report.warnings.map((warning) => (
                    <li key={warning.code} className="rounded-[var(--radius-base)] border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
                      <span className="font-medium">{warning.code}</span>: {warning.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Sin warnings para este turno.</p>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-muted">Observación de alcance</p>
              <p className="text-sm text-muted">
                Devoluciones parciales y sincronizaciones pendientes siguen fuera de alcance en v1.
              </p>
            </div>
          </div>
        </RetailSectionCard>

        <RetailSectionCard title="Evidencia de impresión" description="El comprobante térmico no es la fuente oficial del cierre operativo del turno.">
          <div className="space-y-2">
            <p className="text-sm text-foreground">Estado: {formatPrintEvidenceStatus(report.printEvidence.status)}</p>
            <p className="text-sm text-muted">{formatRetailReportAuditNote(report.printEvidence.note)}</p>
          </div>
        </RetailSectionCard>
      </div>
    </div>
  );
}
