import { StatePanel } from "@/components/ui/state-panel";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import { getRetailCashShiftReport } from "@/lib/retail-pos/reports";
import type { RetailAttentionItem } from "@/lib/retail-pos/reporting-ui";
import { RetailAttentionBlock } from "../_components/RetailAttentionBlock";
import { RETAIL_REPORTING_PERIOD_NOTES, getRetailReportingLabel } from "@/lib/retail-pos/reporting-semantics";
import { RetailReportPeriodContext } from "../_components/RetailReportPeriodContext";
import { RetailCashDifferenceChart } from "../_components/charts/RetailCashDifferenceChart";
import { RetailCashExpectedDeclaredChart } from "../_components/charts/RetailCashExpectedDeclaredChart";
import { RetailCashPaymentMixChart } from "../_components/charts/RetailCashPaymentMixChart";
import {
  RetailCashRefundBreakdown,
  RetailCashShiftTable,
  RetailMetricGrid,
  RetailOpenShiftList,
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
  const expectedDeclaredPoints = report.closedRows
    .filter((row) => typeof row.expectedCashCents === "number" && typeof row.declaredCashCents === "number")
    .map((row) => ({
      shiftId: row.cashShiftId,
      shiftLabel: row.deviceName ?? "Sin terminal",
      deviceLabel: row.deviceName ?? "Sin terminal",
      openedAt: row.openedAt,
      closedAt: row.closedAt,
      expectedCashCents: row.expectedCashCents ?? 0,
      declaredCashCents: row.declaredCashCents ?? 0,
      differenceCents: row.differenceCents ?? 0,
      href: `/${tenantSlug}/retail/reports/cash/${row.cashShiftId}`,
    }));
  const differencePoints = report.closedRows
    .filter((row) => typeof row.differenceCents === "number" && typeof row.declaredCashCents === "number")
    .map((row) => ({
      shiftId: row.cashShiftId,
      shiftLabel: row.deviceName ?? "Sin terminal",
      deviceLabel: row.deviceName ?? "Sin terminal",
      differenceCents: row.differenceCents ?? 0,
      expectedCashCents: row.expectedCashCents ?? 0,
      declaredCashCents: row.declaredCashCents ?? 0,
      href: `/${tenantSlug}/retail/reports/cash/${row.cashShiftId}`,
    }));
  const paymentMixPoints = report.rows.map((row) => ({
    shiftId: row.cashShiftId,
    shiftLabel: row.deviceName ?? "Sin terminal",
    deviceLabel: row.deviceName ?? "Sin terminal",
    cashSalesCents: row.cashSalesCents,
    cardSalesCents: row.cardSalesCents,
    totalSalesCents: row.totalSalesCents,
    href: `/${tenantSlug}/retail/reports/cash/${row.cashShiftId}`,
  }));
  const attentionItems: RetailAttentionItem[] = [];

  if (report.totals.openShiftsCount > 0) {
    attentionItems.push({
      id: "open-shifts",
      title: "Turnos abiertos pendientes de cierre",
      description: "Todavía no cuentan con conciliación final ni efectivo declarado definitivo.",
      quantity: formatNumber(report.totals.openShiftsCount),
      href: "#turnos-abiertos",
      linkLabel: "Ver turnos abiertos",
      tone: "warning",
    });
  }

  if (report.totals.closedWithDifferenceCount > 0) {
    attentionItems.push({
      id: "closed-shifts-difference",
      title: "Turnos cerrados con diferencia de caja",
      description: "Revisa los cierres con sobrante o faltante para entender su conciliación.",
      quantity: formatNumber(report.totals.closedWithDifferenceCount),
      amount: formatCurrency(report.totals.closedDifferenceCents),
      href: "#turnos-cerrados",
      linkLabel: "Ver turnos cerrados",
      tone: "warning",
    });
  }

  if (report.totals.totalCardRefundsPendingCents > 0) {
    attentionItems.push({
      id: "pending-card-refunds",
      title: "Reembolsos con tarjeta pendientes",
      description: "Son reembolsos todavía no completados y no deben contarse como salidas ya realizadas.",
      quantity: formatNumber(report.totals.pendingCardRefundsCount),
      amount: formatCurrency(report.totals.totalCardRefundsPendingCents),
      tone: "warning",
    });
  }

  if (report.totals.closedMissingDeclaredCount > 0) {
    attentionItems.push({
      id: "closed-missing-declared",
      title: "Turnos cerrados sin efectivo declarado",
      description: "Existen cierres con estado cerrado pero sin dato final de efectivo declarado disponible.",
      quantity: formatNumber(report.totals.closedMissingDeclaredCount),
      href: "#turnos-cerrados",
      linkLabel: "Revisar turnos cerrados",
      tone: "warning",
    });
  }

  return (
    <div className="space-y-4">
      <RetailReportsHeader
        title="Cierres y turnos de caja"
        description="Vista operativa para cobros, reembolsos, conciliación de efectivo y seguimiento de turnos abiertos y cerrados."
        metadata={`${tenant.tenantName} · ${report.filters.dateFrom} a ${report.filters.dateTo}`}
      />

      <RetailReportsFiltersCard
        tenantSlug={tenantSlug}
        filters={report.filters}
        devices={report.devices}
        basePath="/retail/reports/cash"
        includeOrderStatus={false}
      />

      <RetailReportPeriodContext
        periodLabel={`${report.filters.dateFrom} -> ${report.filters.dateTo}`}
        primaryDateLabel={RETAIL_REPORTING_PERIOD_NOTES.cash.primaryDateLabel}
        note={RETAIL_REPORTING_PERIOD_NOTES.cash.note}
      />

      <RetailMetricGrid
        items={[
          {
            label: getRetailReportingLabel("cash_collections"),
            value: formatCurrency(report.totals.totalCashSalesCents),
            detail: `${formatNumber(report.totals.shiftsCount)} turnos incluidos`,
            explanation: "Pagos recibidos en efectivo durante los turnos incluidos.",
          },
          {
            label: getRetailReportingLabel("expected_cash_from_sales_and_reimbursements"),
            value: formatCurrency(report.totals.closedExpectedCashCents),
            detail: `${formatNumber(report.totals.closedShiftsCount)} turnos cerrados`,
            explanation:
              "Fondo inicial más cobros en efectivo menos reembolsos en efectivo completados, conforme a la fórmula operativa actual.",
          },
          {
            label: getRetailReportingLabel("declared_cash"),
            value: formatCurrency(report.totals.closedDeclaredCashCents),
            detail: `${formatNumber(report.totals.closedShiftsCount - report.totals.closedMissingDeclaredCount)} cierres con declarado`,
            explanation: "Importe contado y registrado al cerrar los turnos.",
          },
          {
            label: getRetailReportingLabel("cash_difference"),
            value: formatCurrency(report.totals.closedDifferenceCents),
            detail: `${formatNumber(report.totals.closedWithDifferenceCount)} turnos con diferencia`,
            explanation: "Efectivo declarado menos efectivo esperado por ventas y reembolsos.",
            tone: report.totals.closedWithDifferenceCount > 0 ? "warning" : "default",
          },
        ]}
      />

      <RetailAttentionBlock items={attentionItems} />

      <RetailSectionCard
        title="Desglose de reembolsos"
        description="Separa cantidad y monto entre reembolsos en efectivo completados, reembolsos con tarjeta completados y reembolsos pendientes."
      >
        <RetailCashRefundBreakdown report={report} />
      </RetailSectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <RetailCashExpectedDeclaredChart points={expectedDeclaredPoints} />
        <RetailCashDifferenceChart points={differencePoints} />
      </div>

      <RetailCashPaymentMixChart points={paymentMixPoints} />

      {report.openRows.length > 0 ? (
        <RetailSectionCard
          id="turnos-abiertos"
          title="Turnos abiertos"
          description="Se muestran separados porque todavía no cuentan con cierre definitivo ni conciliación final."
        >
          <RetailOpenShiftList rows={report.openRows} />
        </RetailSectionCard>
      ) : null}

      <RetailSectionCard
        id="turnos-cerrados"
        title="Turnos cerrados"
        description="Tabla principal con cobros, reembolsos, conciliación de efectivo y acceso al cierre operativo de cada turno."
      >
        {report.closedRows.length > 0 ? (
          <RetailCashShiftTable tenantSlug={tenantSlug} rows={report.closedRows} />
        ) : (
          <StatePanel
            kind="empty"
            title="Sin turnos cerrados para el periodo seleccionado"
            message="No existen turnos cerrados para el periodo seleccionado."
          />
        )}
      </RetailSectionCard>
    </div>
  );
}
