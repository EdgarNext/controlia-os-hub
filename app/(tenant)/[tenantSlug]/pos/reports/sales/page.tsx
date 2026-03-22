import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { PosReportsOverviewFilters } from "@/components/pos/reports/overview/PosReportsOverviewFilters";
import { PosSalesBreakdown } from "@/components/pos/reports/sales/PosSalesBreakdown";
import { PosSalesHighlights } from "@/components/pos/reports/sales/PosSalesHighlights";
import { PosSalesMetricCards } from "@/components/pos/reports/sales/PosSalesMetricCards";
import { PosSalesReportHeader } from "@/components/pos/reports/sales/PosSalesReportHeader";
import { PosSalesTrendChart } from "@/components/pos/reports/sales/PosSalesTrendChart";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import { getPosSalesReport } from "@/lib/pos/reports/sales";
import {
  buildPosReportsFiltersFromSearchParams,
  type PosReportsSearchParams,
} from "@/lib/pos/reports/search-params";
import type { PosReportsFilters, PosSalesReportData } from "@/types/pos-reports";

type PosSalesPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<PosReportsSearchParams>;
};

type PosSalesPageResult =
  | {
      ok: true;
      filters: PosReportsFilters;
      defaultFilters: PosReportsFilters;
      report: PosSalesReportData;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

async function loadPosSalesPage(
  tenantSlug: string,
  searchParams: PosReportsSearchParams,
): Promise<PosSalesPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "reports", "read");
    const { defaultFilters, filters } = buildPosReportsFiltersFromSearchParams(searchParams);
    const report = await getPosSalesReport({
      tenantId: tenant.tenantId,
      filters,
    });

    return {
      ok: true,
      filters,
      defaultFilters,
      report,
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "No tienes permisos para consultar ventas POS en este tenant.",
        hint: "Solicita acceso de administrador del tenant.",
      };
    }

    throw error;
  }
}

export default async function PosSalesPage({ params, searchParams }: PosSalesPageProps) {
  const { tenantSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const result = await loadPosSalesPage(tenantSlug, resolvedSearchParams);

  return (
    <div className="space-y-4">
      <PosSalesReportHeader tenantSlug={tenantSlug} filters={result.ok ? result.filters : undefined} />

      {result.ok ? (
        <>
          <PosReportsOverviewFilters
            filters={result.filters}
            defaultFilters={result.defaultFilters}
          />

          {result.report.trend.length === 0 ? (
            <StatePanel
              kind="empty"
              title="Sin ventas en el rango seleccionado"
              message="Ajusta el rango o los filtros para analizar otra ventana operativa."
            />
          ) : (
            <>
              <PosSalesMetricCards
                grossCents={result.report.totals.gross_cents}
                ordersCount={result.report.totals.orders_count}
                averageTicketCents={result.report.totals.average_ticket_cents}
                averageDailySalesCents={result.report.highlights.average_daily_sales_cents}
              />

              <PosSalesTrendChart data={result.report.trend} />

              <div className="grid gap-4 xl:grid-cols-2">
                <PosSalesBreakdown
                  title="Distribucion por canal"
                  description="Participacion de venta rapida y mesas en el rango."
                  rows={result.report.channel_distribution}
                />
                <PosSalesBreakdown
                  title="Distribucion por metodo de pago"
                  description="Participacion por forma de pago registrada."
                  rows={result.report.payment_distribution}
                  emptyMessage="Selecciona todos los metodos de pago para ver esta distribucion."
                  countsAreEstimated={result.report.supports_payment_distribution}
                />
              </div>

              <PosSalesHighlights highlights={result.report.highlights} />
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
