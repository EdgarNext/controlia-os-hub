import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { PosReportsMetricCards } from "@/components/pos/reports/overview/PosReportsMetricCards";
import { PosReportsOverviewFilters } from "@/components/pos/reports/overview/PosReportsOverviewFilters";
import { PosReportsOverviewHeader } from "@/components/pos/reports/overview/PosReportsOverviewHeader";
import { PosReportsOverviewSummary } from "@/components/pos/reports/overview/PosReportsOverviewSummary";
import { PosReportsSalesChart } from "@/components/pos/reports/overview/PosReportsSalesChart";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import { getPosReportsOverview } from "@/lib/pos/reports/overview";
import {
  buildPosReportsFiltersFromSearchParams,
  type PosReportsSearchParams,
} from "@/lib/pos/reports/search-params";
import type { PosReportsDailyAggregateRow, PosReportsFilters } from "@/types/pos-reports";

type PosReportsPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<PosReportsSearchParams>;
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

const MX_LABEL_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "2-digit",
  month: "short",
});

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
    const label = row.is_tab ? "Mesas" : "Venta rapida";
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
    { label: "Empleado", cents: overview.totals.employee_cents },
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

async function loadPosReportsPage(
  tenantSlug: string,
  searchParams: PosReportsSearchParams,
): Promise<PosReportsPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "reports", "read");
    // Keep filters URL-driven to match existing tenant pages such as events/status.
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

export default async function PosReportsPage({ params, searchParams }: PosReportsPageProps) {
  const { tenantSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const result = await loadPosReportsPage(tenantSlug, resolvedSearchParams);

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
