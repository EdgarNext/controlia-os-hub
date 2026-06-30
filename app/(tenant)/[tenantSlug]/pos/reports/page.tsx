import Link from "next/link";
import { CreditCard, Package, Printer, Receipt, TrendingUp } from "lucide-react";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { PosReportsMetricCards } from "@/components/pos/reports/overview/PosReportsMetricCards";
import { PosReportsOverviewFilters } from "@/components/pos/reports/overview/PosReportsOverviewFilters";
import { PosReportsOverviewHeader } from "@/components/pos/reports/overview/PosReportsOverviewHeader";
import { PosReportsOverviewSummary } from "@/components/pos/reports/overview/PosReportsOverviewSummary";
import { PosReportsSalesChart } from "@/components/pos/reports/overview/PosReportsSalesChart";
import { PosReportsSectionHeader } from "@/components/pos/reports/PosReportsSectionHeader";
import { SimplePosIncomeCharts } from "@/components/pos/reports/simple/SimplePosIncomeCharts";
import { SimplePosReportsFilters } from "@/components/pos/reports/simple/SimplePosReportsFilters";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import { getPosReportsOverview } from "@/lib/pos/reports/overview";
import {
  buildPosReportsFiltersFromSearchParams,
  type PosReportsSearchParams,
} from "@/lib/pos/reports/search-params";
import {
  buildSimplePosReportsHref,
  buildSimplePosReportsState,
  formatSimplePosDateTime,
  getSimplePosIncomeReport,
  getSimplePosOrdersReport,
  getSimplePosProductsReport,
} from "@/lib/pos/simple-reports";
import type { SimplePosReportsState } from "@/types/simple-pos-reports";
import type { PosReportsDailyAggregateRow, PosReportsFilters } from "@/types/pos-reports";

type PosReportsPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<PosReportsSearchParams & Record<string, string | string[] | undefined>>;
};

type PosReportsPageResult =
  | {
      ok: true;
      filters: PosReportsFilters;
      defaultFilters: PosReportsFilters;
      overview: Awaited<ReturnType<typeof getPosReportsOverview>>;
      chartData: Array<{
        date: string;
        label: string;
        gross_cents: number;
        orders_count: number;
      }>;
      summaryRows: Array<{
        label: string;
        orders_count: number;
        gross_cents: number;
        share_percent: number;
      }>;
      dominantPayment: {
        label: string;
        cents: number;
      };
      bestDayLabel: string;
      bestDayGrossCents: number;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat("es-MX");

const MX_LABEL_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "2-digit",
  month: "short",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value / 100);
}

function formatShortMxDate(dateOnly: string): string {
  const date = new Date(`${dateOnly}T12:00:00.000Z`);
  return MX_LABEL_FORMATTER.format(date);
}

function buildChartData(daily: PosReportsDailyAggregateRow[]) {
  const grouped = new Map<
    string,
    { date: string; label: string; gross_cents: number; orders_count: number }
  >();

  for (const row of daily) {
    const current = grouped.get(row.business_date_mx) ?? {
      date: row.business_date_mx,
      label: formatShortMxDate(row.business_date_mx),
      gross_cents: 0,
      orders_count: 0,
    };

    current.gross_cents += row.gross_cents;
    current.orders_count += row.orders_count;
    grouped.set(row.business_date_mx, current);
  }

  return [...grouped.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function buildSummaryRows(daily: PosReportsDailyAggregateRow[]) {
  const totalsByChannel = new Map<
    string,
    { label: string; orders_count: number; gross_cents: number }
  >();

  for (const row of daily) {
    const key = row.is_tab ? "tabs" : "quick-sale";
    const label = row.is_tab ? "Mesas" : "Mostrador / WhatsApp";
    const current = totalsByChannel.get(key) ?? { label, orders_count: 0, gross_cents: 0 };

    current.orders_count += row.orders_count;
    current.gross_cents += row.gross_cents;
    totalsByChannel.set(key, current);
  }

  const totalGross = [...totalsByChannel.values()].reduce(
    (accumulator, row) => accumulator + row.gross_cents,
    0,
  );

  return [...totalsByChannel.values()]
    .map((row) => ({
      ...row,
      share_percent: totalGross > 0 ? (row.gross_cents / totalGross) * 100 : 0,
    }))
    .sort((left, right) => right.gross_cents - left.gross_cents);
}

function buildDominantPaymentLabel(overview: Awaited<ReturnType<typeof getPosReportsOverview>>) {
  const options = [
    { label: "Efectivo", cents: overview.totals.cash_cents },
    { label: "Tarjeta", cents: overview.totals.card_cents },
    { label: "Transferencia", cents: overview.totals.transfer_cents },
  ];
  const dominant = [...options].sort((left, right) => right.cents - left.cents)[0];

  return dominant.cents > 0 ? dominant : { label: "Sin ventas", cents: 0 };
}

function buildBestDay(chartData: Array<{ label: string; gross_cents: number }>) {
  const bestDay = [...chartData].sort((left, right) => right.gross_cents - left.gross_cents)[0];

  if (!bestDay) {
    return {
      bestDayLabel: "Sin datos",
      bestDayGrossCents: 0,
    };
  }

  return {
    bestDayLabel: bestDay.label,
    bestDayGrossCents: bestDay.gross_cents,
  };
}

async function loadVariantsOverviewPage(
  tenantSlug: string,
  searchParams: PosReportsSearchParams,
): Promise<PosReportsPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "reports", "read");
    const { defaultFilters, filters } = buildPosReportsFiltersFromSearchParams(searchParams);
    const overview = await getPosReportsOverview({
      tenantId: tenant.tenantId,
      filters,
    });
    const chartData = buildChartData(overview.daily);
    const summaryRows = buildSummaryRows(overview.daily);
    const dominantPayment = buildDominantPaymentLabel(overview);
    const { bestDayLabel, bestDayGrossCents } = buildBestDay(chartData);

    return {
      ok: true,
      filters,
      defaultFilters,
      overview,
      chartData,
      summaryRows,
      dominantPayment,
      bestDayLabel,
      bestDayGrossCents,
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "No tienes permisos para consultar reportes POS en este tenant.",
        hint: "Solicita acceso de administrador del tenant.",
      };
    }

    throw error;
  }
}

function SimpleMetricCards({
  grossCents,
  ordersCount,
  averageTicketCents,
  paidOrdersCount,
  printedOrdersCount,
}: {
  grossCents: number;
  ordersCount: number;
  averageTicketCents: number;
  paidOrdersCount: number;
  printedOrdersCount: number;
}) {
  const cards = [
    {
      label: "Ingresos",
      value: formatCurrency(grossCents),
      helper: "Venta total del periodo",
      icon: CreditCard,
    },
    {
      label: "Ordenes",
      value: integerFormatter.format(ordersCount),
      helper: "Tickets pagados",
      icon: Receipt,
    },
    {
      label: "Ticket promedio",
      value: formatCurrency(averageTicketCents),
      helper: "Promedio por orden",
      icon: TrendingUp,
    },
    {
      label: "Pagadas",
      value: integerFormatter.format(paidOrdersCount),
      helper: "Ordenes con status PAID",
      icon: Receipt,
    },
    {
      label: "Impresas",
      value: integerFormatter.format(printedOrdersCount),
      helper: "Ordenes con print_status SENT",
      icon: Printer,
    },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card key={card.label} className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted">{card.label}</p>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[calc(var(--radius-base)-4px)] bg-surface-2 text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-semibold text-foreground">{card.value}</p>
              <p className="text-xs text-muted">{card.helper}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function SimpleOrdersMetricCards({
  grossCents,
  paidOrdersCount,
  averageTicketCents,
  printedOrdersCount,
}: {
  grossCents: number;
  paidOrdersCount: number;
  averageTicketCents: number;
  printedOrdersCount: number;
}) {
  const cards = [
    {
      label: "Ingresos",
      value: formatCurrency(grossCents),
      helper: "Venta total del periodo",
      icon: CreditCard,
    },
    {
      label: "Ordenes pagadas",
      value: integerFormatter.format(paidOrdersCount),
      helper: "Tickets cobrados en el rango",
      icon: Receipt,
    },
    {
      label: "Ticket promedio",
      value: formatCurrency(averageTicketCents),
      helper: "Promedio por orden pagada",
      icon: TrendingUp,
    },
    {
      label: "Impresas",
      value: integerFormatter.format(printedOrdersCount),
      helper: "Ordenes con print_status SENT",
      icon: Printer,
    },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card key={card.label} className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted">{card.label}</p>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[calc(var(--radius-base)-4px)] bg-surface-2 text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-semibold text-foreground">{card.value}</p>
              <p className="text-xs text-muted">{card.helper}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function SimpleProductsTable({
  tenantSlug,
  rows,
}: {
  tenantSlug: string;
  rows: Awaited<ReturnType<typeof getSimplePosProductsReport>>["rows"];
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">Productos vendidos</h2>
        <p className="text-sm text-muted">Top 100 productos por ingresos dentro del rango.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-2 text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Cantidad</th>
              <th className="px-4 py-3 font-medium">Precio prom.</th>
              <th className="px-4 py-3 font-medium">Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.catalog_item_id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{row.product_name}</div>
                  <div className="text-xs text-muted">
                    {row.product_type ?? "product"} · {row.product_class ?? "n/a"}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{row.category_name ?? "Sin categoria"}</td>
                <td className="px-4 py-3">{integerFormatter.format(row.units_sold)}</td>
                <td className="px-4 py-3">{formatCurrency(row.average_unit_price_cents)}</td>
                <td className="px-4 py-3 font-medium">{formatCurrency(row.revenue_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border px-4 py-3 text-xs text-muted">
        Los accesos a categorias y productos se mantienen en
        {" "}
        <Link href={`/${tenantSlug}/pos/catalog/categories`} className="text-foreground underline">
          catalogo simple
        </Link>
        .
      </div>
    </Card>
  );
}

function SimpleOrdersTable({
  tenantSlug,
  state,
  report,
}: {
  tenantSlug: string;
  state: SimplePosReportsState;
  report: Awaited<ReturnType<typeof getSimplePosOrdersReport>>;
}) {
  const basePath = `/${tenantSlug}/pos/reports`;
  const previousPageHref =
    report.page > 1
      ? buildSimplePosReportsHref(basePath, {
          view: "orders",
          filters: state.filters,
          page: report.page - 1,
        })
      : null;
  const nextPageHref =
    report.page < report.total_pages
      ? buildSimplePosReportsHref(basePath, {
          view: "orders",
          filters: state.filters,
          page: report.page + 1,
        })
      : null;

  return (
    <div className="space-y-4">
      {report.selected_order ? (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Detalle {report.selected_order.order.folio_text}
              </h2>
              <p className="text-sm text-muted">
                {formatSimplePosDateTime(report.selected_order.order.created_at)}
              </p>
            </div>
            <Link
              href={buildSimplePosReportsHref(basePath, {
                view: "orders",
                filters: state.filters,
                page: report.page,
              })}
              className="inline-flex min-h-9 items-center rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2 px-3 text-sm"
            >
              Cerrar detalle
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
              <p className="text-xs text-muted">Total</p>
              <p className="text-lg font-semibold">{formatCurrency(report.selected_order.order.total_cents)}</p>
            </div>
            <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
              <p className="text-xs text-muted">Pago</p>
              <p className="text-lg font-semibold">{report.selected_order.order.payment_method ?? "N/A"}</p>
            </div>
            <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
              <p className="text-xs text-muted">Impresion</p>
              <p className="text-lg font-semibold">{report.selected_order.order.print_status}</p>
            </div>
            <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
              <p className="text-xs text-muted">Partidas</p>
              <p className="text-lg font-semibold">{integerFormatter.format(report.selected_order.items.length)}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-2 text-left text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Cantidad</th>
                  <th className="px-4 py-3 font-medium">Precio</th>
                  <th className="px-4 py-3 font-medium">Importe</th>
                </tr>
              </thead>
              <tbody>
                {report.selected_order.items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{item.product_name}</td>
                    <td className="px-4 py-3 text-muted">{item.category_name ?? "Sin categoria"}</td>
                    <td className="px-4 py-3">{integerFormatter.format(item.qty)}</td>
                    <td className="px-4 py-3">{formatCurrency(item.unit_price_cents)}</td>
                    <td className="px-4 py-3">{formatCurrency(item.line_total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Ordenes recientes</h2>
              <p className="text-sm text-muted">Paginacion server-side de 50 ordenes por pagina.</p>
            </div>
            <div className="text-sm text-muted">
              Pagina {report.page} de {report.total_pages} · {integerFormatter.format(report.total_count)} ordenes
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-2 text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Folio</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Pago</th>
                <th className="px-4 py-3 font-medium">Impresion</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{row.folio_text}</td>
                  <td className="px-4 py-3 text-muted">{formatSimplePosDateTime(row.created_at)}</td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3">{row.payment_method ?? "N/A"}</td>
                  <td className="px-4 py-3">{row.print_status}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(row.total_cents)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={buildSimplePosReportsHref(basePath, {
                        view: "orders",
                        filters: state.filters,
                        page: report.page,
                        orderId: row.id,
                      })}
                      className="inline-flex min-h-9 items-center rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2 px-3 text-sm"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
          {previousPageHref ? (
            <Link href={previousPageHref} className="inline-flex min-h-9 items-center rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2 px-3 text-sm">
              Pagina anterior
            </Link>
          ) : <span />}
          {nextPageHref ? (
            <Link href={nextPageHref} className="inline-flex min-h-9 items-center rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2 px-3 text-sm">
              Siguiente pagina
            </Link>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

async function renderSimpleReports(tenantSlug: string, tenantId: string, state: SimplePosReportsState) {
  if (state.view === "products") {
    const report = await getSimplePosProductsReport({
      tenantId,
      filters: state.filters,
    });

    return (
      <div className="space-y-4">
        <PosReportsSectionHeader
          title="Reportes POS simple"
          description="Ventas de cafeteria sobre orders, order_items y catalogo simple."
        />
        <SimplePosReportsFilters filters={state.filters} view={state.view} />
        {state.warning ? (
          <div className="rounded-[var(--radius-base)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
            {state.warning}
          </div>
        ) : null}

        {report.rows.length === 0 ? (
          <StatePanel
            kind="empty"
            title="Sin productos vendidos en el rango"
            message="Ajusta el periodo para revisar otro conjunto de ventas."
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="space-y-2 p-4">
                <p className="text-sm text-muted">Ingresos del rango</p>
                <p className="text-2xl font-semibold">{formatCurrency(report.totals.revenue_cents)}</p>
              </Card>
              <Card className="space-y-2 p-4">
                <p className="text-sm text-muted">Unidades vendidas</p>
                <p className="text-2xl font-semibold">{integerFormatter.format(report.totals.units_sold)}</p>
              </Card>
              <Card className="space-y-2 p-4">
                <p className="text-sm text-muted">Productos distintos</p>
                <p className="text-2xl font-semibold">{integerFormatter.format(report.totals.distinct_products_count)}</p>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="space-y-4 p-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">Top productos por cantidad</h2>
                </div>
                <ol className="space-y-2">
                  {report.top_by_units.map((row) => (
                    <li key={row.catalog_item_id} className="flex items-center justify-between gap-3 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2">
                      <div>
                        <p className="font-medium">{row.product_name}</p>
                        <p className="text-xs text-muted">{row.category_name ?? "Sin categoria"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{integerFormatter.format(row.units_sold)}</p>
                        <p className="text-xs text-muted">unidades</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>

              <Card className="space-y-4 p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">Top productos por ingresos</h2>
                </div>
                <ol className="space-y-2">
                  {report.top_by_revenue.map((row) => (
                    <li key={row.catalog_item_id} className="flex items-center justify-between gap-3 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2">
                      <div>
                        <p className="font-medium">{row.product_name}</p>
                        <p className="text-xs text-muted">{row.category_name ?? "Sin categoria"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(row.revenue_cents)}</p>
                        <p className="text-xs text-muted">{integerFormatter.format(row.units_sold)} unidades</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            </div>

            <SimpleProductsTable tenantSlug={tenantSlug} rows={report.rows} />
          </>
        )}
      </div>
    );
  }

  if (state.view === "orders") {
    const report = await getSimplePosOrdersReport({
      tenantId,
      filters: state.filters,
      page: state.page,
      orderId: state.orderId,
    });

    return (
      <div className="space-y-4">
        <PosReportsSectionHeader
          title="Reportes POS simple"
          description="Ordenes recientes del POS simple con detalle bajo demanda."
        />
        <SimplePosReportsFilters filters={state.filters} view={state.view} />
        {state.warning ? (
          <div className="rounded-[var(--radius-base)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
            {state.warning}
          </div>
        ) : null}

        {report.rows.length === 0 ? (
          <StatePanel
            kind="empty"
            title="Sin ordenes en el rango"
            message="Ajusta el periodo para revisar otra ventana operativa."
          />
        ) : (
          <>
            <SimpleOrdersMetricCards
              grossCents={report.totals.gross_cents}
              paidOrdersCount={report.totals.paid_orders_count}
              averageTicketCents={report.totals.average_ticket_cents}
              printedOrdersCount={report.totals.printed_orders_count}
            />
            <SimpleOrdersTable tenantSlug={tenantSlug} state={state} report={report} />
          </>
        )}
      </div>
    );
  }

  const report = await getSimplePosIncomeReport({
    tenantId,
    filters: state.filters,
  });

  return (
    <div className="space-y-4">
      <PosReportsSectionHeader
        title="Reportes POS simple"
        description="Vista operativa para cafeterias sobre report_sales_daily y ordenes pagadas."
      />
      <SimplePosReportsFilters filters={state.filters} view={state.view} />
      {state.warning ? (
        <div className="rounded-[var(--radius-base)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
          {state.warning}
        </div>
      ) : null}

      {report.daily.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Sin ingresos en el rango"
          message="Ajusta las fechas para consultar otra ventana operativa."
        />
      ) : (
        <>
          <SimpleMetricCards
            grossCents={report.totals.gross_cents}
            ordersCount={report.totals.orders_count}
            averageTicketCents={report.totals.average_ticket_cents}
            paidOrdersCount={report.totals.paid_orders_count}
            printedOrdersCount={report.totals.printed_orders_count}
          />
          <SimplePosIncomeCharts data={report.daily} />
        </>
      )}
    </div>
  );
}

export default async function PosReportsPage({ params, searchParams }: PosReportsPageProps) {
  const { tenantSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const tenant = await resolveSalesPosPageContext(tenantSlug, "reports", "read");

  if (tenant.posType === "simple") {
    return renderSimpleReports(
      tenantSlug,
      tenant.tenantId,
      buildSimplePosReportsState(resolvedSearchParams),
    );
  }

  const result = await loadVariantsOverviewPage(tenantSlug, resolvedSearchParams);

  return (
    <div className="space-y-4">
      <PosReportsOverviewHeader
        tenantSlug={tenantSlug}
        filters={result.ok ? result.filters : undefined}
      />
      {result.ok ? (
        <>
          <PosReportsOverviewFilters
            filters={result.filters}
            defaultFilters={result.defaultFilters}
          />

          {result.overview.daily.length === 0 ? (
            <StatePanel
              kind="empty"
              title="Sin ventas en el rango seleccionado"
              message="Ajusta el rango o los filtros para revisar otra ventana operativa."
            />
          ) : (
            <>
              <PosReportsMetricCards
                grossCents={result.overview.totals.gross_cents}
                ordersCount={result.overview.totals.orders_count}
                averageTicketCents={result.overview.totals.average_ticket_cents}
                dominantPayment={result.dominantPayment}
              />

              <PosReportsSalesChart data={result.chartData} />

              <PosReportsOverviewSummary
                dateRangeLabel={`Periodo consultado: ${formatShortMxDate(result.filters.date_from)} - ${formatShortMxDate(result.filters.date_to)}`}
                bestDayLabel={result.bestDayLabel}
                bestDayGrossCents={result.bestDayGrossCents}
                rows={result.summaryRows}
              />
            </>
          )}
        </>
      ) : (
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      )}
    </div>
  );
}
