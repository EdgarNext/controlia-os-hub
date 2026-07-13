import Link from "next/link";
import { notFound } from "next/navigation";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import { getRetailPosZReportByCashShift } from "@/lib/retail-pos/reports";
import {
  RetailMetricGrid,
  RetailPaymentMethodsTable,
  RetailReportsHeader,
  RetailSectionCard,
  formatCurrency,
  formatDateTime,
  formatNumber,
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
      ? "Reporte Z final v1 calculado desde cash shift cerrado."
      : report.status === "open"
        ? "El turno sigue abierto. Esta vista muestra un corte operativo, no un Z final."
        : "El turno fue cancelado. La lectura se conserva como referencia administrativa.";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <RetailReportsHeader
            title="Reporte Z"
            description="Vista solo lectura por turno de caja calculada directamente desde pagos, órdenes y líneas asociadas al cash shift."
            metadata={`Tenant ${tenant.tenantName} · Turno ${report.cashShiftId}`}
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

      <RetailMetricGrid
        items={[
          {
            label: "Total vendido",
            value: formatCurrency(report.totalSalesCents),
            detail: `${formatNumber(report.paidOrdersCount)} ordenes pagadas`,
          },
          {
            label: "Efectivo",
            value: formatCurrency(report.cashSalesCents),
            detail: `Tarjeta ${formatCurrency(report.cardSalesCents)}`,
          },
          {
            label: "Tarjeta",
            value: formatCurrency(report.cardSalesCents),
            detail: `${formatNumber(report.paymentsCount)} pagos`,
          },
          {
            label: "Diferencia",
            value: formatPendingCurrency(report.differenceCents),
            tone: report.differenceCents !== null && report.differenceCents !== 0 ? "warning" : "default",
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <RetailSectionCard title="Identificacion del turno" description="Contexto operativo y administrativo del cash shift.">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted">cashShiftId</dt>
              <dd className="text-sm text-foreground">{report.cashShiftId}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Terminal</dt>
              <dd className="text-sm text-foreground">{report.deviceName ?? "Sin terminal"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Rol</dt>
              <dd className="text-sm text-foreground">{report.deviceRole ?? "No configurado"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Generado</dt>
              <dd className="text-sm text-foreground">{formatDateTime(report.generatedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Apertura</dt>
              <dd className="text-sm text-foreground">
                {formatDateTime(report.openedAt)} · {report.openedByName ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Cierre</dt>
              <dd className="text-sm text-foreground">
                {formatDateTime(report.closedAt)} · {report.closedByName ?? "—"}
              </dd>
            </div>
          </dl>
        </RetailSectionCard>

        <RetailSectionCard title="Resumen de caja" description="Montos base del cierre y lectura de diferencia.">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted">Fondo inicial</dt>
              <dd className="text-sm text-foreground">{formatCurrency(report.openingFloatCents)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Efectivo esperado</dt>
              <dd className="text-sm text-foreground">{formatPendingCurrency(report.expectedCashCents)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Efectivo declarado</dt>
              <dd className="text-sm text-foreground">{formatPendingCurrency(report.declaredCashCents)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Diferencia</dt>
              <dd className="text-sm font-medium text-foreground">{formatPendingCurrency(report.differenceCents)}</dd>
            </div>
          </dl>
        </RetailSectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <RetailSectionCard title="Metodos de pago" description="Totales del shift por metodo.">
          <RetailPaymentMethodsTable paymentMethods={report.paymentMethods} />
        </RetailSectionCard>

        <RetailSectionCard title="Operaciones" description="Volumen operativo consolidado del turno.">
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-xs font-medium text-muted">Pagos</dt>
              <dd className="text-lg font-semibold text-foreground">{formatNumber(report.paymentsCount)}</dd>
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
              <dt className="text-xs font-medium text-muted">Lineas vendidas</dt>
              <dd className="text-lg font-semibold text-foreground">{formatNumber(report.linesSummary.soldLinesCount)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Unidades vendidas</dt>
              <dd className="text-lg font-semibold text-foreground">{formatNumber(report.linesSummary.soldUnits)}</dd>
            </div>
          </dl>
        </RetailSectionCard>
      </div>

      <RetailSectionCard title="Ordenes incluidas" description="Solo se consideran ordenes asociadas a pagos del cash shift.">
        {report.orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-2 py-2">Folio</th>
                  <th className="px-2 py-2">Pagado en</th>
                  <th className="px-2 py-2">Metodo</th>
                  <th className="px-2 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.orders.map((order) => (
                  <tr key={order.orderId} className="border-b border-border/60 align-top text-foreground">
                    <td className="px-2 py-2 font-medium">{order.folio}</td>
                    <td className="px-2 py-2">{formatDateTime(order.paidAt)}</td>
                    <td className="px-2 py-2">
                      {order.paymentMethod === "cash"
                        ? "Efectivo"
                        : order.paymentMethod === "card"
                          ? "Tarjeta"
                          : "—"}
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
            title="Sin ordenes asociadas"
            message="Este turno no tiene ordenes pagadas asociadas o no fue posible cargarlas."
          />
        )}
      </RetailSectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <RetailSectionCard title="Observaciones" description="Notas operativas, warnings y campos futuros.">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted">Nota de cierre</p>
              <p className="text-sm text-foreground">{report.closingNote?.trim() || "Sin nota de cierre."}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted">Warnings</p>
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
              <p className="text-xs font-medium text-muted">Campos futuros</p>
              <p className="text-sm text-muted">
                Cancelaciones, devoluciones, pending sync y descuentos operativos siguen fuera de alcance en v1.
              </p>
            </div>
          </div>
        </RetailSectionCard>

        <RetailSectionCard title="Evidencia de impresion" description="El ticket termico de corte no es la fuente oficial del Reporte Z.">
          <div className="space-y-2">
            <p className="text-sm text-foreground">Estado: {report.printEvidence.status}</p>
            <p className="text-sm text-muted">{report.printEvidence.note}</p>
          </div>
        </RetailSectionCard>
      </div>
    </div>
  );
}
