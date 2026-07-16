import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatRetailReportingCount,
  formatRetailReportingCurrency,
  formatRetailReportingDateTime,
  formatRetailReportingPeriodLabel,
  formatRetailReportingPercent,
  formatRetailReportingQuantity,
} from "@/lib/retail-pos/reporting-formatters";
import { getRetailReportingLabel } from "@/lib/retail-pos/reporting-semantics";
import { formatRetailReportAuditNote } from "@/lib/retail-pos/reporting-ui";
import { cn } from "@/lib/utils";
import styles from "./retail-report-skeleton.module.css";
import type {
  RetailCashShiftReportRow,
  RetailCashShiftReport,
  RetailPostSaleReport,
  RetailProductsReport,
  RetailReportsOverview,
  RetailReportsPageFilters,
  RetailSalesReport,
} from "@/lib/retail-pos/reports";

type QueryValue = string | string[] | undefined;

function RetailReportSkeletonBlock({ className }: { className?: string }) {
  return <Skeleton className={cn(styles.skeletonBlock, "bg-surface-2/90", className)} aria-hidden="true" />;
}

export type RetailReportsSearchParams = Record<string, QueryValue>;

export function getSingleSearchParam(value: QueryValue) {
  if (Array.isArray(value)) {
    return value[0] ?? undefined;
  }

  return value;
}

export function buildRetailReportsFilters(searchParams: RetailReportsSearchParams) {
  return {
    dateFrom: getSingleSearchParam(searchParams.dateFrom) ?? undefined,
    dateTo: getSingleSearchParam(searchParams.dateTo) ?? undefined,
    deviceId: getSingleSearchParam(searchParams.deviceId) ?? undefined,
    orderStatus: getSingleSearchParam(searchParams.orderStatus) as
      | "all"
      | "pending_payment"
      | "paid"
      | "voided"
      | undefined,
  };
}

export function buildRetailReportHref(input: {
  tenantSlug: string;
  basePath: string;
  filters?: Partial<RetailReportsPageFilters>;
  overrides?: Record<string, string | null | undefined>;
}) {
  const searchParams = new URLSearchParams();

  if (input.filters?.dateFrom) {
    searchParams.set("dateFrom", input.filters.dateFrom);
  }

  if (input.filters?.dateTo) {
    searchParams.set("dateTo", input.filters.dateTo);
  }

  if (input.filters?.deviceId) {
    searchParams.set("deviceId", input.filters.deviceId);
  }

  if (input.filters?.orderStatus && input.filters.orderStatus !== "all") {
    searchParams.set("orderStatus", input.filters.orderStatus);
  }

  for (const [key, value] of Object.entries(input.overrides ?? {})) {
    if (!value) {
      searchParams.delete(key);
      continue;
    }

    searchParams.set(key, value);
  }

  const query = searchParams.toString();
  return `/${input.tenantSlug}${input.basePath}${query ? `?${query}` : ""}`;
}

export function buildRetailPostSaleReportHref(input: {
  tenantSlug: string;
  filters?: Partial<RetailPostSaleReport["filters"]>;
  overrides?: Record<string, string | null | undefined>;
}) {
  const searchParams = new URLSearchParams();

  if (input.filters?.dateFrom) {
    searchParams.set("dateFrom", input.filters.dateFrom);
  }

  if (input.filters?.dateTo) {
    searchParams.set("dateTo", input.filters.dateTo);
  }

  if (input.filters?.operationType && input.filters.operationType !== "all") {
    searchParams.set("operationType", input.filters.operationType);
  }

  if (input.filters?.refundStatus && input.filters.refundStatus !== "all") {
    searchParams.set("refundStatus", input.filters.refundStatus);
  }

  if (input.filters?.refundMethod && input.filters.refundMethod !== "all") {
    searchParams.set("refundMethod", input.filters.refundMethod);
  }

  if (input.filters?.reasonCode) {
    searchParams.set("reasonCode", input.filters.reasonCode);
  }

  if (input.filters?.responsibleUserId) {
    searchParams.set("responsibleUserId", input.filters.responsibleUserId);
  }

  for (const [key, value] of Object.entries(input.overrides ?? {})) {
    if (!value) {
      searchParams.delete(key);
      continue;
    }

    searchParams.set(key, value);
  }

  const query = searchParams.toString();
  return `/${input.tenantSlug}/retail/reports/post-sale${query ? `?${query}` : ""}`;
}

export function formatCurrency(cents: number) {
  return formatRetailReportingCurrency(cents);
}

export function formatNumber(value: number) {
  return formatRetailReportingCount(value);
}

export function formatDateTime(value: string | null) {
  return formatRetailReportingDateTime(value);
}

export function formatQuantity(value: number) {
  return formatRetailReportingQuantity(value);
}

export function formatPeriodLabel(dateFrom: string, dateTo: string) {
  return formatRetailReportingPeriodLabel(dateFrom, dateTo);
}

export function formatDiscountReason(reasonCode: string) {
  switch (reasonCode) {
    case "volume":
      return "Volumen";
    case "frequent_customer":
      return "Cliente frecuente";
    case "authorized_wholesale":
      return "Mayoreo autorizado";
    case "price_adjustment":
      return "Ajuste de precio";
    case "damaged_product":
      return "Producto dañado";
    case "manual_promotion":
      return "Promoción manual";
    case "rounding":
      return "Redondeo";
    case "capture_error":
      return "Error de captura";
    case "cashier_authorization":
      return "Autorización de caja";
    default:
      return "Otro";
  }
}

export function formatOrderStatus(status: "pending_payment" | "paid" | "voided") {
  switch (status) {
    case "paid":
      return "Pagado";
    case "voided":
      return "Pedido anulado";
    case "pending_payment":
    default:
      return "Pendiente";
  }
}

export function formatPostSaleReason(reasonCode: string | null | undefined) {
  if (!reasonCode) {
    return "Sin motivo registrado";
  }

  switch (reasonCode) {
    case "duplicate_charge":
      return "Cobro duplicado";
    case "wrong_order":
      return "Pedido incorrecto";
    case "wrong_payment_method":
      return "Método de pago incorrecto";
    case "customer_cancelled_immediately":
      return "Cliente canceló al momento";
    case "operator_error":
      return "Error de operación";
    case "system_error":
      return "Error de sistema";
    default:
      return "Otro";
  }
}

export function formatPostSaleRefundMethod(
  method: "cash" | "card_external" | "store_credit_future" | null,
) {
  if (!method) {
    return "No aplica";
  }

  switch (method) {
    case "cash":
      return getRetailReportingLabel("cash_reimbursements");
    case "card_external":
      return getRetailReportingLabel("card_reimbursements");
    case "store_credit_future":
      return "Crédito futuro";
    default:
      return method;
  }
}

export function formatPostSaleRefundStatus(
  status: "not_required" | "pending" | "completed" | "failed" | "cancelled" | null,
) {
  if (!status) {
    return "No aplica";
  }

  switch (status) {
    case "not_required":
      return "No requerido";
    case "pending":
      return "Pendiente";
    case "completed":
      return "Completado";
    case "failed":
      return "Fallido";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
}

export function formatShiftStatus(status: "open" | "closed" | "canceled") {
  switch (status) {
    case "closed":
      return "Cerrado";
    case "canceled":
      return "Cancelado";
    case "open":
    default:
      return "Abierto";
  }
}

export function formatPaymentMethodLabel(method: "cash" | "card" | null) {
  if (method === "cash") {
    return getRetailReportingLabel("cash_collections");
  }

  if (method === "card") {
    return getRetailReportingLabel("card_collections");
  }

  return "—";
}

export function formatCompactPaymentMethodLabel(method: "cash" | "card" | null) {
  if (method === "cash") {
    return "Efectivo";
  }

  if (method === "card") {
    return "Tarjeta";
  }

  return "—";
}

export function formatPrintEvidenceStatus(status: string) {
  switch (status) {
    case "no_evidence":
      return "Sin evidencia";
    case "print_failed":
      return "Con fallas";
    case "mixed":
      return "Mixto";
    case "reprinted":
      return "Con reimpresiones";
    case "printed":
      return "Impreso";
    default:
      return "Sin dato";
  }
}

function getStatusTone(status: "pending_payment" | "paid" | "voided" | "open" | "closed" | "canceled") {
  if (status === "paid" || status === "closed") {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "voided" || status === "canceled") {
    return "bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }

  return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

export function RetailReportsHeader({
  title,
  description,
  metadata,
}: {
  title: string;
  description: string;
  metadata?: string;
}) {
  return (
    <header className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Reportes retail</p>
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <p className="max-w-3xl text-sm text-muted">{description}</p>
      {metadata ? <p className="text-xs text-muted">{metadata}</p> : null}
    </header>
  );
}

export function RetailReportHeaderSkeleton({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Reportes retail</p>
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <p className="max-w-3xl text-sm text-muted">{description}</p>
      <RetailReportSkeletonBlock className="mt-2 h-3 w-56" />
    </header>
  );
}

export function RetailReportsFiltersCard({
  tenantSlug,
  filters,
  devices,
  basePath,
  includeOrderStatus = true,
}: {
  tenantSlug: string;
  filters: RetailReportsPageFilters;
  devices: Array<{ id: string; name: string; role: string }>;
  basePath: string;
  includeOrderStatus?: boolean;
}) {
  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Filtros operativos</h2>
        <p className="text-xs text-muted">
          El reporte se resuelve server-side con filtros por fecha, terminal y estado.
        </p>
      </div>

      <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" action={`/${tenantSlug}${basePath}`}>
        <label className="space-y-1 text-sm">
          <span className="text-xs font-medium text-muted">Desde</span>
          <input
            type="date"
            name="dateFrom"
            defaultValue={filters.dateFrom}
            className="w-full rounded-[var(--radius-base)] border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-xs font-medium text-muted">Hasta</span>
          <input
            type="date"
            name="dateTo"
            defaultValue={filters.dateTo}
            className="w-full rounded-[var(--radius-base)] border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-xs font-medium text-muted">Terminal</span>
          <select
            name="deviceId"
            defaultValue={filters.deviceId ?? ""}
            className="w-full rounded-[var(--radius-base)] border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">Todas</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        </label>

        {includeOrderStatus ? (
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted">Estado</span>
            <select
              name="orderStatus"
              defaultValue={filters.orderStatus}
              className="w-full rounded-[var(--radius-base)] border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">Todos</option>
              <option value="paid">Pagados</option>
              <option value="pending_payment">Pendientes</option>
              <option value="voided">Anulados</option>
            </select>
          </label>
        ) : (
          <input type="hidden" name="orderStatus" value={filters.orderStatus} />
        )}

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Aplicar
          </button>
          <Link
            href={`/${tenantSlug}${basePath}`}
            className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-base)] border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
          >
            Limpiar
          </Link>
        </div>
      </form>
    </Card>
  );
}

export function RetailReportsFiltersSkeleton({ includeOrderStatus = true }: { includeOrderStatus?: boolean }) {
  const columns = includeOrderStatus ? 5 : 4;

  return (
    <Card className="space-y-4 p-4" aria-hidden="true">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Filtros operativos</h2>
        <p className="text-xs text-muted">Preparando filtros del reporte...</p>
      </div>

      <div
        className={cn(
          "grid gap-3 md:grid-cols-2",
          columns === 5 ? "xl:grid-cols-5" : "xl:grid-cols-4",
        )}
      >
        <RetailReportSkeletonBlock className="h-16 w-full" />
        <RetailReportSkeletonBlock className="h-16 w-full" />
        <RetailReportSkeletonBlock className="h-16 w-full" />
        {includeOrderStatus ? <RetailReportSkeletonBlock className="h-16 w-full" /> : null}
        <div className="flex items-end gap-2">
          <RetailReportSkeletonBlock className="h-10 w-24" />
          <RetailReportSkeletonBlock className="h-10 w-24" />
        </div>
      </div>
    </Card>
  );
}

export function RetailMetricGrid({
  items,
}: {
  items: Array<{
    label: string;
    value: string;
    detail?: string;
    explanation?: string;
    comparison?: string;
    breakdown?: string;
    href?: string;
    linkLabel?: string;
    attentionLabel?: string;
    tone?: "default" | "warning";
  }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card
          key={item.label}
          className={cn(
            "space-y-1 p-4",
            item.tone === "warning" ? "border-warning/50 bg-warning/10" : "border-border/80",
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{item.label}</p>
          <p className="text-2xl font-semibold text-foreground">{item.value}</p>
          {item.detail ? <p className="text-xs text-muted">{item.detail}</p> : null}
          {item.explanation ? <p className="text-xs text-muted">{item.explanation}</p> : null}
          {item.comparison ? <p className="text-xs text-muted">{item.comparison}</p> : null}
          {item.breakdown ? <p className="text-xs text-muted">{item.breakdown}</p> : null}
          {item.attentionLabel ? <p className="text-xs font-medium text-foreground">{item.attentionLabel}</p> : null}
          {item.href && item.linkLabel ? (
            <Link href={item.href} className="inline-flex text-xs font-medium text-primary hover:opacity-90">
              {item.linkLabel}
            </Link>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

export function RetailMetricGridSkeleton({
  count = 4,
  columnsClassName = "xl:grid-cols-4",
}: {
  count?: number;
  columnsClassName?: string;
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", columnsClassName)} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={`metric-skeleton-${index}`} className="space-y-2 p-4">
          <RetailReportSkeletonBlock className="h-3 w-28" />
          <RetailReportSkeletonBlock className="h-8 w-32" />
          <RetailReportSkeletonBlock className="h-3 w-40" />
        </Card>
      ))}
    </div>
  );
}

export function RetailSectionCard({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="space-y-3 p-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? <p className="text-xs text-muted">{description}</p> : null}
      </div>
      {children}
    </Card>
  );
}

export function RetailSectionCardSkeleton({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="space-y-3 p-4" aria-hidden="true">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? <p className="text-xs text-muted">{description}</p> : null}
      </div>
      {children}
    </Card>
  );
}

export function RetailInlineStatsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className={cn("grid gap-3", count === 3 ? "md:grid-cols-3" : "md:grid-cols-2")} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`inline-stat-skeleton-${index}`}
          className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3"
        >
          <RetailReportSkeletonBlock className="h-3 w-24" />
          <RetailReportSkeletonBlock className="mt-3 h-7 w-20" />
        </div>
      ))}
    </div>
  );
}

export function RetailTableSkeleton({
  columns,
  rows = 6,
  titleLines = 1,
}: {
  columns: number;
  rows?: number;
  titleLines?: number;
}) {
  return (
    <div className="overflow-x-auto" aria-hidden="true">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <th key={`skeleton-head-${columnIndex}`} className="px-2 py-2">
                <RetailReportSkeletonBlock className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={`skeleton-row-${rowIndex}`} className="border-b border-border/60 align-top">
              {Array.from({ length: columns }).map((_, columnIndex) => (
                <td key={`skeleton-cell-${rowIndex}-${columnIndex}`} className="px-2 py-3">
                  <div className="space-y-2">
                    <RetailReportSkeletonBlock className={cn("h-3", columnIndex === 0 ? "w-28" : "w-20")} />
                    {columnIndex === 0 && titleLines > 1 ? (
                      <RetailReportSkeletonBlock className="h-3 w-20" />
                    ) : null}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RetailAuditSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2" aria-hidden="true">
      {Array.from({ length: 2 }).map((_, index) => (
        <Card key={`audit-skeleton-${index}`} className="space-y-3 p-4">
          <RetailReportSkeletonBlock className="h-3 w-28" />
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((__, statIndex) => (
              <div key={`audit-stat-skeleton-${index}-${statIndex}`} className="space-y-2">
                <RetailReportSkeletonBlock className="h-3 w-20" />
                <RetailReportSkeletonBlock className="h-6 w-14" />
              </div>
            ))}
          </div>
          <RetailReportSkeletonBlock className="h-3 w-full" />
          <RetailReportSkeletonBlock className="h-3 w-4/5" />
        </Card>
      ))}
    </div>
  );
}

export function RetailReportLoadingState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <span className="sr-only">Cargando reporte...</span>
      <RetailReportHeaderSkeleton title={title} description={description} />
      {children}
    </div>
  );
}

export function RetailOverviewMetrics({ overview }: { overview: RetailReportsOverview }) {
  return (
    <RetailMetricGrid
      items={[
        {
          label: getRetailReportingLabel("collected_sales"),
          value: formatCurrency(overview.summary.netSalesCents),
          detail: `${formatNumber(overview.summary.paidOrders)} pedidos pagados`,
        },
        {
          label: getRetailReportingLabel("paid_sale_cancellation"),
          value: formatNumber(overview.summary.cancelledSalesCount),
          detail: `${formatNumber(overview.summary.fullReturnsCount)} devoluciones totales · ${formatNumber(overview.summary.partialReturnsCount)} parciales`,
        },
        {
          label: "Monto anulado",
          value: formatCurrency(overview.summary.cancelledSalesCents),
          detail: `${getRetailReportingLabel("returned_amount")} ${formatCurrency(overview.summary.returnedCents)}`,
        },
        {
          label: getRetailReportingLabel("commercial_result"),
          value: formatCurrency(overview.summary.commercialNetCents),
          detail: `${getRetailReportingLabel("pending_reimbursements")} ${formatCurrency(overview.summary.pendingRefundCents)}`,
          tone: overview.summary.pendingRefundCents > 0 ? "warning" : "default",
        },
      ]}
    />
  );
}

export function RetailDiscountBreakdownTables({
  overview,
}: {
  overview: Pick<RetailReportsOverview, "discountBreakdown">;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Descuentos por motivo</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-2 py-2">Motivo</th>
                <th className="px-2 py-2">Eventos</th>
                <th className="px-2 py-2">{getRetailReportingLabel("granted_discount")}</th>
              </tr>
            </thead>
            <tbody>
              {overview.discountBreakdown.byReason.map((row) => (
                <tr key={row.reasonCode} className="border-b border-border/60 text-foreground">
                  <td className="px-2 py-2">{formatDiscountReason(row.reasonCode)}</td>
                  <td className="px-2 py-2">{formatNumber(row.discountsCount)}</td>
                  <td className="px-2 py-2">{formatCurrency(row.totalDiscountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Descuentos por cajero</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-2 py-2">Cajero</th>
                <th className="px-2 py-2">Eventos</th>
                <th className="px-2 py-2">{getRetailReportingLabel("granted_discount")}</th>
              </tr>
            </thead>
            <tbody>
              {overview.discountBreakdown.byCashier.map((row) => (
                <tr key={row.posUserId ?? "unknown"} className="border-b border-border/60 text-foreground">
                  <td className="px-2 py-2">{row.posUserName ?? row.posUserId ?? "Sin dato"}</td>
                  <td className="px-2 py-2">{formatNumber(row.discountsCount)}</td>
                  <td className="px-2 py-2">{formatCurrency(row.totalDiscountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Operaciones con líneas debajo del costo</p>
        <div>
          <p className="text-xs text-muted">Órdenes afectadas</p>
          <p className="text-lg font-semibold text-foreground">
            {formatNumber(overview.discountBreakdown.belowCostOrdersCount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Líneas afectadas</p>
          <p className="text-lg font-semibold text-foreground">
            {formatNumber(overview.discountBreakdown.belowCostLinesCount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Venta cobrada afectada</p>
          <p className="text-lg font-semibold text-foreground">
            {formatCurrency(overview.discountBreakdown.belowCostNetSalesCents)}
          </p>
        </div>
      </Card>
    </div>
  );
}

export function RetailPaymentMethodsTable({
  paymentMethods,
}: {
  paymentMethods: RetailReportsOverview["paymentMethods"];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-2 py-2">Tipo de cobro</th>
            <th className="px-2 py-2">Pagos</th>
            <th className="px-2 py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {paymentMethods.map((row) => (
            <tr key={row.method} className="border-b border-border/60 text-foreground">
              <td className="px-2 py-2">{formatPaymentMethodLabel(row.method)}</td>
              <td className="px-2 py-2">{formatNumber(row.paymentsCount)}</td>
              <td className="px-2 py-2">{formatCurrency(row.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RetailAuditPanel({ audit }: { audit: RetailReportsOverview["audit"] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="space-y-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Evidencia de impresión</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted">Impresiones</p>
            <p className="text-lg font-semibold text-foreground">{formatNumber(audit.printedCount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Reimpresiones</p>
            <p className="text-lg font-semibold text-foreground">{formatNumber(audit.reprintedCount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Tickets de pago</p>
            <p className="text-lg font-semibold text-foreground">
              {formatNumber(audit.paymentPrintedCount + audit.paymentReprintedCount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Fallos registrados</p>
            <p className="text-lg font-semibold text-foreground">{formatNumber(audit.failedPrintCount)}</p>
          </div>
        </div>
      </Card>

      <Card className="space-y-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Lectura operativa</p>
        <p className="text-sm text-muted">{formatRetailReportAuditNote(audit.note)}</p>
        <p className="text-xs text-muted">
          Comprobantes de pedido: {formatNumber(audit.orderPrintedCount)} impresiones y{" "}
          {formatNumber(audit.orderReprintedCount)} reimpresiones.
        </p>
        <p className="text-xs text-muted">
          Comprobantes de pago: {formatNumber(audit.paymentPrintedCount)} impresiones y{" "}
          {formatNumber(audit.paymentReprintedCount)} reimpresiones.
        </p>
        <p className="text-xs text-muted">
          Postventa: {formatNumber(audit.postSalePrintedCount)} impresiones y{" "}
          {formatNumber(audit.postSaleReprintedCount)} reimpresiones.
        </p>
      </Card>
    </div>
  );
}

export function RetailOrdersTable({
  orders,
}: {
  orders: RetailReportsOverview["recentOrders"] | RetailSalesReport["orders"];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-2 py-2">Folio</th>
            <th className="px-2 py-2">Estado</th>
            <th className="px-2 py-2">Postventa</th>
            <th className="px-2 py-2">Total</th>
            <th className="px-2 py-2">Monto anulado</th>
            <th className="px-2 py-2">{getRetailReportingLabel("returned_amount")}</th>
            <th className="px-2 py-2">Tipo de cobro</th>
            <th className="px-2 py-2">Origen</th>
            <th className="px-2 py-2">Terminal de cobro</th>
            <th className="px-2 py-2">Creado</th>
            <th className="px-2 py-2">Fecha de cobro</th>
            <th className="px-2 py-2">Última postventa registrada</th>
            <th className="px-2 py-2">Fecha de anulación del pedido</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.orderId} className="border-b border-border/60 align-top text-foreground">
              <td className="px-2 py-2">
                <div className="font-medium">{order.folio}</div>
                {order.localFolio ? <div className="text-xs text-muted">Local {order.localFolio}</div> : null}
              </td>
              <td className="px-2 py-2">
                <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-medium", getStatusTone(order.status))}>
                  {formatOrderStatus(order.status)}
                </span>
                {order.cancelReason ? <div className="mt-1 max-w-44 text-xs text-muted">{order.cancelReason}</div> : null}
              </td>
              <td className="px-2 py-2">
                {order.postSaleStatus !== "none" && order.postSaleLabel ? (
                  <span className="inline-flex rounded-full bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-700 dark:text-rose-300">
                    {order.postSaleLabel}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="px-2 py-2">{formatCurrency(order.totalCents)}</td>
              <td className="px-2 py-2">{formatCurrency(order.cancelledSalesCents)}</td>
              <td className="px-2 py-2">{formatCurrency(order.returnedCents)}</td>
              <td className="px-2 py-2">{formatPaymentMethodLabel(order.paymentMethod)}</td>
              <td className="px-2 py-2">{order.originDeviceName ?? "—"}</td>
              <td className="px-2 py-2">{order.paidDeviceName ?? "—"}</td>
              <td className="px-2 py-2">{formatDateTime(order.createdAt)}</td>
              <td className="px-2 py-2">{formatDateTime(order.paidAt)}</td>
              <td className="px-2 py-2">{formatDateTime(order.lastPostSaleAt)}</td>
              <td className="px-2 py-2">{formatDateTime(order.voidedAtOrder)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RetailSalesDiscountBreakdown({
  report,
}: {
  report: RetailSalesReport;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
      <Card className="space-y-3 p-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Indicadores de descuento</p>
          <p className="text-xs text-muted">Resumen de operaciones con descuento y operaciones con líneas debajo del costo.</p>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted">{getRetailReportingLabel("granted_discount")}</span>
            <span className="font-medium text-foreground">{formatCurrency(report.summary.discountsCents)}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted">Operaciones con descuento</span>
            <span className="font-medium text-foreground">{formatNumber(report.discountInsights.discountedOrdersCount)}</span>
          </div>
          {report.discountInsights.discountedOrdersShare !== null ? (
            <div className="flex items-start justify-between gap-3">
              <span className="text-muted">Participación sobre ventas cobradas</span>
              <span className="font-medium text-foreground">{formatRetailReportingPercent(report.discountInsights.discountedOrdersShare)}</span>
            </div>
          ) : null}
          {report.discountInsights.belowCostOrdersCount > 0 ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted">Operaciones con al menos una línea debajo del costo</span>
                <span className="font-medium text-foreground">{formatNumber(report.discountInsights.belowCostOrdersCount)}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted">Líneas afectadas</span>
                <span className="font-medium text-foreground">{formatNumber(report.discountInsights.belowCostLinesCount)}</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted">No se detectaron operaciones con líneas debajo del costo en este periodo.</p>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Descuentos por motivo</p>
        {report.discountBreakdown.byReason.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-2 py-2">Motivo</th>
                  <th className="px-2 py-2">Operaciones</th>
                  <th className="px-2 py-2">{getRetailReportingLabel("granted_discount")}</th>
                </tr>
              </thead>
              <tbody>
                {report.discountBreakdown.byReason.map((row) => (
                  <tr key={row.reasonCode} className="border-b border-border/60 text-foreground">
                    <td className="px-2 py-2">{formatDiscountReason(row.reasonCode)}</td>
                    <td className="px-2 py-2">{formatNumber(row.discountsCount)}</td>
                    <td className="px-2 py-2">{formatCurrency(row.totalDiscountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No se concedieron descuentos en este periodo.</p>
        )}
      </Card>

      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Descuentos por usuario</p>
        {report.discountBreakdown.byCashier.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-2 py-2">Usuario</th>
                  <th className="px-2 py-2">Operaciones</th>
                  <th className="px-2 py-2">{getRetailReportingLabel("granted_discount")}</th>
                </tr>
              </thead>
              <tbody>
                {report.discountBreakdown.byCashier.map((row) => (
                  <tr key={row.posUserId ?? "unknown"} className="border-b border-border/60 text-foreground">
                    <td className="px-2 py-2">{row.posUserName ?? row.posUserId ?? "Sin dato"}</td>
                    <td className="px-2 py-2">{formatNumber(row.discountsCount)}</td>
                    <td className="px-2 py-2">{formatCurrency(row.totalDiscountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No hay usuarios con descuentos registrados en este periodo.</p>
        )}
      </Card>
    </div>
  );
}

export function RetailSalesOrdersTable({
  tenantSlug,
  filters,
  orders,
}: {
  tenantSlug: string;
  filters: RetailReportsPageFilters;
  orders: RetailSalesReport["orders"];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-2 py-2">Folio</th>
            <th className="px-2 py-2">Fecha y hora de cobro</th>
            <th className="px-2 py-2">Total antes de descuento</th>
            <th className="px-2 py-2">Descuento</th>
            <th className="px-2 py-2">Venta cobrada</th>
            <th className="px-2 py-2">Método de cobro</th>
            <th className="px-2 py-2">Estado de postventa</th>
            <th className="px-2 py-2">Acceso útil</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const accessHref =
              order.postSaleStatus !== "none"
                ? buildRetailReportHref({
                    tenantSlug,
                    basePath: "/retail/reports/post-sale",
                    filters,
                  })
                : order.discountCents > 0 || order.hasBelowCostLine
                  ? buildRetailReportHref({
                      tenantSlug,
                      basePath: "/retail/reports/sales",
                      filters,
                    }) + "#sales-discount-breakdown"
                  : buildRetailReportHref({
                      tenantSlug,
                      basePath: "/retail/reports/sales",
                      filters,
                    });
            const accessLabel =
              order.postSaleStatus !== "none"
                ? "Ver postventa"
                : order.discountCents > 0 || order.hasBelowCostLine
                  ? "Ir a descuentos"
                  : "Ver ventas";

            return (
              <tr key={order.orderId} className="border-b border-border/60 align-top text-foreground">
                <td className="px-2 py-2">
                  <div className="font-medium">{order.folio}</div>
                  {order.localFolio ? <div className="text-xs text-muted">Local {order.localFolio}</div> : null}
                  {order.hasBelowCostLine ? (
                    <div className="mt-1">
                      <span className="inline-flex rounded-full bg-warning/10 px-2 py-1 text-[11px] font-medium text-foreground">
                        Debajo del costo
                      </span>
                    </div>
                  ) : null}
                </td>
                <td className="px-2 py-2">{formatDateTime(order.paidAt)}</td>
                <td className="px-2 py-2">{formatCurrency(order.grossSalesCents)}</td>
                <td className="px-2 py-2">
                  {order.discountCents > 0 ? (
                    <div className="space-y-1">
                      <div>{formatCurrency(order.discountCents)}</div>
                      <span className="inline-flex rounded-full bg-warning/10 px-2 py-1 text-[11px] font-medium text-foreground">
                        Con descuento
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-2 py-2">{formatCurrency(order.totalCents)}</td>
                <td className="px-2 py-2">{formatCompactPaymentMethodLabel(order.paymentMethod)}</td>
                <td className="px-2 py-2">{order.postSaleLabel ?? "Sin postventa"}</td>
                <td className="px-2 py-2">
                  <Link
                    href={accessHref}
                    className="inline-flex min-h-9 items-center rounded-[var(--radius-base)] border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface-2"
                  >
                    {accessLabel}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RetailOverviewRecentOrdersTable({
  tenantSlug,
  filters,
  orders,
}: {
  tenantSlug: string;
  filters: RetailReportsPageFilters;
  orders: RetailReportsOverview["recentOrders"];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-2 py-2">Folio</th>
            <th className="px-2 py-2">Estado</th>
            <th className="px-2 py-2">Fecha relevante</th>
            <th className="px-2 py-2">Total</th>
            <th className="px-2 py-2">Cobro</th>
            <th className="px-2 py-2">Descuento</th>
            <th className="px-2 py-2">Postventa</th>
            <th className="px-2 py-2">Acción</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.orderId} className="border-b border-border/60 align-top text-foreground">
              <td className="px-2 py-2">
                <div className="font-medium">{order.folio}</div>
                {order.localFolio ? <div className="text-xs text-muted">Local {order.localFolio}</div> : null}
              </td>
              <td className="px-2 py-2">
                <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-medium", getStatusTone(order.status))}>
                  {formatOrderStatus(order.status)}
                </span>
              </td>
              <td className="px-2 py-2">{formatDateTime(order.relevantAt)}</td>
              <td className="px-2 py-2">{formatCurrency(order.totalCents)}</td>
              <td className="px-2 py-2">{formatPaymentMethodLabel(order.paymentMethod)}</td>
              <td className="px-2 py-2">
                {order.discountCents > 0 ? (
                  <span className="inline-flex rounded-full bg-warning/10 px-2 py-1 text-xs font-medium text-foreground">
                    Sí
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="px-2 py-2">
                {order.postSaleLabel ? (
                  <span className="inline-flex rounded-full bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-700 dark:text-rose-300">
                    {order.postSaleLabel}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="px-2 py-2">
                <Link
                  href={buildRetailReportHref({
                    tenantSlug,
                    basePath: "/retail/reports/sales",
                    filters,
                  })}
                  className="inline-flex min-h-9 items-center rounded-[var(--radius-base)] border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface-2"
                >
                  Ver ventas
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RetailCashShiftTable({
  tenantSlug,
  rows,
}: {
  tenantSlug: string;
  rows: RetailCashShiftReportRow[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-2 py-2">Turno</th>
            <th className="px-2 py-2">Estado</th>
            <th className="px-2 py-2">Cobros</th>
            <th className="px-2 py-2">Reembolsos</th>
            <th className="px-2 py-2">{getRetailReportingLabel("expected_cash_from_sales_and_reimbursements")}</th>
            <th className="px-2 py-2">{getRetailReportingLabel("declared_cash")}</th>
            <th className="px-2 py-2">{getRetailReportingLabel("cash_difference")}</th>
            <th className="px-2 py-2">Actividad</th>
            <th className="px-2 py-2">Acción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.cashShiftId} className="border-b border-border/60 align-top text-foreground">
              <td className="px-2 py-2">
                <div className="font-medium">{row.deviceName ?? "Sin terminal"}</div>
                <div className="text-xs text-muted">Abre {formatDateTime(row.openedAt)}</div>
                <div className="text-xs text-muted">Cierra {formatDateTime(row.closedAt)}</div>
                <div className="mt-1 text-xs text-muted">
                  {row.openedByName ?? "Sin responsable de apertura"} · {row.closedByName ?? "Sin responsable de cierre"}
                </div>
              </td>
              <td className="px-2 py-2">
                <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-medium", getStatusTone(row.status))}>
                  {formatShiftStatus(row.status)}
                </span>
                {row.closingNote ? <div className="mt-1 max-w-44 text-xs text-muted">{row.closingNote}</div> : null}
              </td>
              <td className="px-2 py-2">
                <div className="font-medium">{formatCurrency(row.cashSalesCents)}</div>
                <div className="text-xs text-muted">Tarjeta {formatCurrency(row.cardSalesCents)}</div>
                <div className="text-xs text-muted">Total {formatCurrency(row.totalSalesCents)}</div>
              </td>
              <td className="px-2 py-2">
                <div className="font-medium">Efectivo {formatCurrency(row.cashRefundsCents)}</div>
                <div className="text-xs text-muted">Tarjeta comp. {formatCurrency(row.cardRefundsCompletedCents)}</div>
                <div className="text-xs text-muted">Tarjeta pend. {formatCurrency(row.cardRefundsPendingCents)}</div>
              </td>
              <td className="px-2 py-2">{formatCurrency(row.expectedCashCents ?? 0)}</td>
              <td className="px-2 py-2">
                {typeof row.declaredCashCents === "number" ? formatCurrency(row.declaredCashCents) : "Sin declarar"}
              </td>
              <td className="px-2 py-2">
                <div className="font-medium">{formatCurrency(row.differenceCents ?? 0)}</div>
                <div className="text-xs text-muted">
                  {row.differenceCents === null
                    ? "Sin conciliación final"
                    : row.differenceCents > 0
                      ? "Sobrante"
                      : row.differenceCents < 0
                        ? "Faltante"
                        : "Sin diferencia"}
                </div>
              </td>
              <td className="px-2 py-2">
                <div>{formatNumber(row.ordersCount)} ordenes</div>
                <div className="text-xs text-muted">{formatNumber(row.paymentsCount)} pagos</div>
                <div className="text-xs text-muted">
                  {formatNumber(row.cancellationsCount)} ventas canceladas · {formatNumber(row.returnsCount)} devoluciones
                </div>
              </td>
              <td className="px-2 py-2">
                <Link
                  href={`/${tenantSlug}/retail/reports/cash/${row.cashShiftId}`}
                  className="inline-flex min-h-9 items-center rounded-[var(--radius-base)] border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface-2"
                >
                  Ver cierre operativo
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RetailCashRefundBreakdown({ report }: { report: RetailCashShiftReport }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {report.refundBreakdown.map((row) => (
        <Card
          key={row.key}
          className={cn("space-y-3 p-4", row.tone === "warning" ? "border-warning/50 bg-warning/10" : "border-border/80")}
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{row.label}</p>
            <p className="text-2xl font-semibold text-foreground">{formatCurrency(row.amountCents)}</p>
          </div>
          <p className="text-xs text-muted">Cantidad: {formatNumber(row.refundsCount)}</p>
        </Card>
      ))}
    </div>
  );
}

export function RetailOpenShiftList({ rows }: { rows: RetailCashShiftReportRow[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {rows.map((row) => (
        <Card key={row.cashShiftId} className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{row.deviceName ?? "Sin terminal"}</p>
              <p className="text-xs text-muted">Abierto {formatDateTime(row.openedAt)}</p>
              <p className="text-xs text-muted">Responsable {row.openedByName ?? "Sin usuario"}</p>
            </div>
            <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-medium", getStatusTone(row.status))}>
              {formatShiftStatus(row.status)}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted">Fondo inicial</p>
              <p className="text-sm font-medium text-foreground">{formatCurrency(row.openingFloatCents)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Cobros en efectivo</p>
              <p className="text-sm font-medium text-foreground">{formatCurrency(row.cashSalesCents)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Reembolsos en efectivo completados</p>
              <p className="text-sm font-medium text-foreground">{formatCurrency(row.cashRefundsCents)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Efectivo esperado por ventas y reembolsos</p>
              <p className="text-sm font-medium text-foreground">{formatCurrency(row.expectedCashCents ?? 0)}</p>
            </div>
          </div>

          <p className="text-xs text-muted">
            Turno todavía abierto. Aun no debe interpretarse como cierre definitivo ni mostrar conciliación final.
          </p>
        </Card>
      ))}
    </div>
  );
}

export function RetailPostSaleRefundBreakdown({ report }: { report: RetailPostSaleReport }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {report.refundBreakdown.length > 0 ? (
        report.refundBreakdown.map((row) => (
          <Card key={row.key} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{row.label}</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted">Cantidad</span>
                <span className="font-medium text-foreground">{formatNumber(row.refundsCount)}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted">Monto</span>
                <span className="font-medium text-foreground">{formatCurrency(row.amountCents)}</span>
              </div>
            </div>
          </Card>
        ))
      ) : (
        <Card className="p-4 md:col-span-2 xl:col-span-4">
          <p className="text-sm text-muted">No hay reembolsos pendientes ni completados adicionales para desglosar.</p>
        </Card>
      )}
    </div>
  );
}

export function RetailPostSaleSummaryTables({ report }: { report: RetailPostSaleReport }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Postventa por motivo</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-2 py-2">Motivo</th>
                <th className="px-2 py-2">Operaciones</th>
                <th className="px-2 py-2">Monto</th>
              </tr>
            </thead>
            <tbody>
              {report.byReason.length > 0 ? report.byReason.map((row) => (
                <tr key={row.reasonCode} className="border-b border-border/60 text-foreground">
                  <td className="px-2 py-2">{formatPostSaleReason(row.reasonCode)}</td>
                  <td className="px-2 py-2">{formatNumber(row.operationsCount)}</td>
                  <td className="px-2 py-2">{formatCurrency(row.totalAmountCents)}</td>
                </tr>
              )) : (
                <tr>
                  <td className="px-2 py-3 text-muted" colSpan={3}>
                    No existen motivos de postventa para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Actividad registrada por usuario</p>
        <p className="mt-1 text-xs text-muted">
          Este desglose muestra quién registró las operaciones. No representa una evaluación de desempeño.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-2 py-2">Usuario</th>
                <th className="px-2 py-2">Anulaciones</th>
                <th className="px-2 py-2">Devoluciones</th>
                <th className="px-2 py-2">Operaciones</th>
                <th className="px-2 py-2">Monto</th>
              </tr>
            </thead>
            <tbody>
              {report.byResponsibleUser.map((row) => (
                <tr key={row.posUserId ?? "unknown"} className="border-b border-border/60 text-foreground">
                  <td className="px-2 py-2">{row.posUserName ?? row.posUserId ?? "Sin dato"}</td>
                  <td className="px-2 py-2">{formatNumber(row.cancelledSalesCount)}</td>
                  <td className="px-2 py-2">{formatNumber(row.returnsCount)}</td>
                  <td className="px-2 py-2">{formatNumber(row.operationsCount)}</td>
                  <td className="px-2 py-2">{formatCurrency(row.totalAmountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function RetailPostSaleTable({
  tenantSlug,
  report,
}: {
  tenantSlug: string;
  report: RetailPostSaleReport;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-2 py-2">{getRetailReportingLabel("post_sale_recorded_date")}</th>
            <th className="px-2 py-2">Tipo de operación</th>
            <th className="px-2 py-2">Folio de venta original</th>
            <th className="px-2 py-2">Monto comercial</th>
            <th className="px-2 py-2">Método de reembolso</th>
            <th className="px-2 py-2">Estado del reembolso</th>
            <th className="px-2 py-2">Motivo</th>
            <th className="px-2 py-2">Usuario responsable</th>
            <th className="px-2 py-2">Acceso útil</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.documentId} className="border-b border-border/60 align-top text-foreground">
              <td className="px-2 py-2">
                <div className="font-medium">{formatDateTime(row.registeredAt)}</div>
                {row.confirmedAt && row.confirmedAt !== row.registeredAt ? (
                  <div className="text-xs text-muted">Confirmado: {formatDateTime(row.confirmedAt)}</div>
                ) : null}
                {row.processedAt ? (
                  <div className="text-xs text-muted">Procesado: {formatDateTime(row.processedAt)}</div>
                ) : null}
              </td>
              <td className="px-2 py-2">
                <div className="font-medium">{row.operationLabel}</div>
                <div className="text-xs text-muted">
                  {formatNumber(row.lineCount)} líneas · {formatNumber(row.quantityReturned)} uds.
                </div>
              </td>
              <td className="px-2 py-2">{row.originalFolio}</td>
              <td className="px-2 py-2">{formatCurrency(row.commercialAmountCents)}</td>
              <td className="px-2 py-2">{formatPostSaleRefundMethod(row.refundMethod)}</td>
              <td className="px-2 py-2">{formatPostSaleRefundStatus(row.refundStatus)}</td>
              <td className="px-2 py-2">
                <div>{formatPostSaleReason(row.reasonCode)}</div>
                {row.comment ? <div className="text-xs text-muted">{row.comment}</div> : null}
              </td>
              <td className="px-2 py-2">{row.responsibleUserName ?? row.responsibleUserId ?? "Sin dato"}</td>
              <td className="px-2 py-2">
                <Link
                  href={buildRetailPostSaleReportHref({
                    tenantSlug,
                    filters: report.filters,
                    overrides: {
                      operationType: row.operationType,
                      reasonCode: row.reasonCode,
                    },
                  })}
                  className="text-primary hover:opacity-90"
                >
                  Ver similares
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RetailProductsTable({ report }: { report: RetailProductsReport }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-2 py-2">Producto</th>
            <th className="px-2 py-2">SKU</th>
            <th className="px-2 py-2">Unidad</th>
            <th className="px-2 py-2">Cantidad</th>
            <th className="px-2 py-2">Ordenes</th>
            <th className="px-2 py-2">Precio promedio</th>
            <th className="px-2 py-2">Venta cobrada</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.productKey} className="border-b border-border/60 align-top text-foreground">
              <td className="px-2 py-2">
                <div className="font-medium">{row.productName}</div>
                {row.variantName ? <div className="text-xs text-muted">{row.variantName}</div> : null}
              </td>
              <td className="px-2 py-2">{row.sku ?? "—"}</td>
              <td className="px-2 py-2">{row.unitLabel}</td>
              <td className="px-2 py-2">{formatQuantity(row.quantitySold)}</td>
              <td className="px-2 py-2">{formatNumber(row.ordersCount)}</td>
              <td className="px-2 py-2">{formatCurrency(row.averageUnitPriceCents)}</td>
              <td className="px-2 py-2">{formatCurrency(row.totalSoldCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
