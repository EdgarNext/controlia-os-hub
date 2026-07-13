import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import styles from "./retail-report-skeleton.module.css";
import type {
  RetailCashShiftReport,
  RetailProductsReport,
  RetailReportsOverview,
  RetailReportsPageFilters,
  RetailSalesReport,
} from "@/lib/retail-pos/reports";

type QueryValue = string | string[] | undefined;

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("es-MX");

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

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
      | "cancelled"
      | undefined,
  };
}

export function formatCurrency(cents: number) {
  return currencyFormatter.format(cents / 100);
}

export function formatNumber(value: number) {
  if (Number.isInteger(value)) {
    return numberFormatter.format(value);
  }

  return value.toLocaleString("es-MX", { maximumFractionDigits: 2 });
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return dateTimeFormatter.format(new Date(value));
}

export function formatOrderStatus(status: "pending_payment" | "paid" | "cancelled") {
  switch (status) {
    case "paid":
      return "Pagado";
    case "cancelled":
      return "Cancelado";
    case "pending_payment":
    default:
      return "Pendiente";
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

function getStatusTone(status: "pending_payment" | "paid" | "cancelled" | "open" | "closed" | "canceled") {
  if (status === "paid" || status === "closed") {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "cancelled" || status === "canceled") {
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
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Retail Reports</p>
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
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Retail Reports</p>
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
              <option value="cancelled">Cancelados</option>
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
  items: Array<{ label: string; value: string; detail?: string; tone?: "default" | "warning" }>;
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
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="space-y-3 p-4">
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
          label: "Venta neta",
          value: formatCurrency(overview.summary.netSalesCents),
          detail: `${formatNumber(overview.summary.paidOrders)} pedidos pagados`,
        },
        {
          label: "Efectivo",
          value: formatCurrency(overview.summary.cashCents),
          detail: `Tarjeta ${formatCurrency(overview.summary.cardCents)}`,
        },
        {
          label: "Ticket promedio",
          value: formatCurrency(overview.summary.averageTicketCents),
          detail: `Bruta ${formatCurrency(overview.summary.grossSalesCents)}`,
        },
        {
          label: "Descuentos",
          value: formatCurrency(overview.summary.discountsCents),
          detail: `Unidades vendidas ${formatNumber(overview.summary.soldUnits)}`,
          tone: overview.summary.discountsCents > 0 ? "warning" : "default",
        },
      ]}
    />
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
            <th className="px-2 py-2">Metodo</th>
            <th className="px-2 py-2">Pagos</th>
            <th className="px-2 py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {paymentMethods.map((row) => (
            <tr key={row.method} className="border-b border-border/60 text-foreground">
              <td className="px-2 py-2">{row.method === "cash" ? "Efectivo" : "Tarjeta"}</td>
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
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Auditoria basica</p>
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
        <p className="text-sm text-muted">{audit.note}</p>
        <p className="text-xs text-muted">
          Ticket de pedido: {formatNumber(audit.orderPrintedCount)} impresiones y{" "}
          {formatNumber(audit.orderReprintedCount)} reimpresiones.
        </p>
        <p className="text-xs text-muted">
          Ticket de pago: {formatNumber(audit.paymentPrintedCount)} impresiones y{" "}
          {formatNumber(audit.paymentReprintedCount)} reimpresiones.
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
            <th className="px-2 py-2">Total</th>
            <th className="px-2 py-2">Metodo</th>
            <th className="px-2 py-2">Origen</th>
            <th className="px-2 py-2">Cobro</th>
            <th className="px-2 py-2">Creado</th>
            <th className="px-2 py-2">Pagado</th>
            <th className="px-2 py-2">Cancelado</th>
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
              <td className="px-2 py-2">{formatCurrency(order.totalCents)}</td>
              <td className="px-2 py-2">
                {order.paymentMethod === "cash"
                  ? "Efectivo"
                  : order.paymentMethod === "card"
                    ? "Tarjeta"
                    : "—"}
              </td>
              <td className="px-2 py-2">{order.originDeviceName ?? "—"}</td>
              <td className="px-2 py-2">{order.paidDeviceName ?? "—"}</td>
              <td className="px-2 py-2">{formatDateTime(order.createdAt)}</td>
              <td className="px-2 py-2">{formatDateTime(order.paidAt)}</td>
              <td className="px-2 py-2">{formatDateTime(order.cancelledAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RetailCashShiftTable({
  tenantSlug,
  report,
}: {
  tenantSlug: string;
  report: RetailCashShiftReport;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-2 py-2">Caja</th>
            <th className="px-2 py-2">Estado</th>
            <th className="px-2 py-2">Apertura</th>
            <th className="px-2 py-2">Cierre</th>
            <th className="px-2 py-2">Fondo</th>
            <th className="px-2 py-2">Efectivo esperado</th>
            <th className="px-2 py-2">Declarado</th>
            <th className="px-2 py-2">Diferencia</th>
            <th className="px-2 py-2">Ventas efectivo</th>
            <th className="px-2 py-2">Ventas tarjeta</th>
            <th className="px-2 py-2">Pagos</th>
            <th className="px-2 py-2">Ordenes</th>
            <th className="px-2 py-2">Accion</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.cashShiftId} className="border-b border-border/60 align-top text-foreground">
              <td className="px-2 py-2">
                <div className="font-medium">{row.deviceName ?? "Sin terminal"}</div>
                <div className="text-xs text-muted">Abre {row.openedByName ?? "—"}</div>
                <div className="text-xs text-muted">Cierra {row.closedByName ?? "—"}</div>
              </td>
              <td className="px-2 py-2">
                <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-medium", getStatusTone(row.status))}>
                  {formatShiftStatus(row.status)}
                </span>
                {row.closingNote ? <div className="mt-1 max-w-44 text-xs text-muted">{row.closingNote}</div> : null}
              </td>
              <td className="px-2 py-2">{formatDateTime(row.openedAt)}</td>
              <td className="px-2 py-2">{formatDateTime(row.closedAt)}</td>
              <td className="px-2 py-2">{formatCurrency(row.openingFloatCents)}</td>
              <td className="px-2 py-2">{formatCurrency(row.expectedCashCents ?? 0)}</td>
              <td className="px-2 py-2">{formatCurrency(row.declaredCashCents ?? 0)}</td>
              <td className="px-2 py-2">{formatCurrency(row.differenceCents ?? 0)}</td>
              <td className="px-2 py-2">{formatCurrency(row.cashSalesCents)}</td>
              <td className="px-2 py-2">{formatCurrency(row.cardSalesCents)}</td>
              <td className="px-2 py-2">{formatNumber(row.paymentsCount)}</td>
              <td className="px-2 py-2">{formatNumber(row.ordersCount)}</td>
              <td className="px-2 py-2">
                <Link
                  href={`/${tenantSlug}/retail/reports/cash/${row.cashShiftId}`}
                  className="inline-flex min-h-9 items-center rounded-[var(--radius-base)] border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface-2"
                >
                  Ver Reporte Z
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
            <th className="px-2 py-2">Total vendido</th>
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
              <td className="px-2 py-2">{formatNumber(row.quantitySold)}</td>
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
