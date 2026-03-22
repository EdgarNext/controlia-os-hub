import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { PosReportsOverviewFilters } from "@/components/pos/reports/overview/PosReportsOverviewFilters";
import { PosProductsHighlights } from "@/components/pos/reports/products/PosProductsHighlights";
import { PosProductsMetricCards } from "@/components/pos/reports/products/PosProductsMetricCards";
import { PosProductsReportHeader } from "@/components/pos/reports/products/PosProductsReportHeader";
import { PosProductsRevenueChart } from "@/components/pos/reports/products/PosProductsRevenueChart";
import { PosProductsTable } from "@/components/pos/reports/products/PosProductsTable";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import { getPosProductsReport } from "@/lib/pos/reports/products";
import {
  buildPosReportsFiltersFromSearchParams,
  type PosReportsSearchParams,
} from "@/lib/pos/reports/search-params";
import type { PosProductsReportData, PosReportsFilters } from "@/types/pos-reports";

type PosProductsPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<PosReportsSearchParams>;
};

type PosProductsPageResult =
  | {
      ok: true;
      filters: PosReportsFilters;
      defaultFilters: PosReportsFilters;
      report: PosProductsReportData;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

async function loadPosProductsPage(
  tenantSlug: string,
  searchParams: PosReportsSearchParams,
): Promise<PosProductsPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "reports", "read");
    const { defaultFilters, filters } = buildPosReportsFiltersFromSearchParams(searchParams);
    const report = await getPosProductsReport({
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
        message: "No tienes permisos para consultar productos POS en este tenant.",
        hint: "Solicita acceso de administrador del tenant.",
      };
    }

    throw error;
  }
}

export default async function PosProductsPage({ params, searchParams }: PosProductsPageProps) {
  const { tenantSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const result = await loadPosProductsPage(tenantSlug, resolvedSearchParams);

  return (
    <div className="space-y-4">
      <PosProductsReportHeader
        tenantSlug={tenantSlug}
        filters={result.ok ? result.filters : undefined}
      />

      {result.ok ? (
        <>
          <PosReportsOverviewFilters
            filters={result.filters}
            defaultFilters={result.defaultFilters}
          />

          {result.report.products.length === 0 ? (
            <StatePanel
              kind="empty"
              title="Sin productos vendidos en el rango"
              message="Ajusta el rango o los filtros para revisar otro periodo operativo."
            />
          ) : (
            <>
              <PosProductsMetricCards
                grossCents={result.report.totals.gross_cents}
                unitsSold={result.report.totals.units_sold}
                productsSoldCount={result.report.totals.products_sold_count}
                topFiveSharePercent={result.report.totals.top_five_share_percent}
              />

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
                <PosProductsRevenueChart data={result.report.top_products_chart} />
                <PosProductsHighlights highlights={result.report.highlights} />
              </div>

              <PosProductsTable rows={result.report.products} />
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
