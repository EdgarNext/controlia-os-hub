import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { PosReportsOverviewFilters } from "@/components/pos/reports/overview/PosReportsOverviewFilters";
import { PosCashiersCoverageSummary } from "@/components/pos/reports/cashiers/PosCashiersCoverageSummary";
import { PosCashiersMetricCards } from "@/components/pos/reports/cashiers/PosCashiersMetricCards";
import { PosCashiersReportHeader } from "@/components/pos/reports/cashiers/PosCashiersReportHeader";
import { PosCashiersTable } from "@/components/pos/reports/cashiers/PosCashiersTable";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import { getPosCashiersReport } from "@/lib/pos/reports/cashiers";
import {
  buildPosReportsFiltersFromSearchParams,
  type PosReportsSearchParams,
} from "@/lib/pos/reports/search-params";
import type { PosCashiersReportData, PosReportsFilters } from "@/types/pos-reports";

type PosCashiersPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<PosReportsSearchParams>;
};

type PosCashiersPageResult =
  | {
      ok: true;
      filters: PosReportsFilters;
      defaultFilters: PosReportsFilters;
      report: PosCashiersReportData;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

async function loadPosCashiersPage(
  tenantSlug: string,
  searchParams: PosReportsSearchParams,
): Promise<PosCashiersPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "reports", "read");
    const { defaultFilters, filters } = buildPosReportsFiltersFromSearchParams(searchParams);
    const report = await getPosCashiersReport({
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
        message: "No tienes permisos para consultar cajeros POS en este tenant.",
        hint: "Solicita acceso de administrador del tenant.",
      };
    }

    throw error;
  }
}

export default async function PosCashiersPage({ params, searchParams }: PosCashiersPageProps) {
  const { tenantSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const result = await loadPosCashiersPage(tenantSlug, resolvedSearchParams);

  return (
    <div className="space-y-4">
      <PosCashiersReportHeader
        tenantSlug={tenantSlug}
        filters={result.ok ? result.filters : undefined}
      />

      {result.ok ? (
        <>
          <PosReportsOverviewFilters
            filters={result.filters}
            defaultFilters={result.defaultFilters}
          />

          {result.report.cashiers.length === 0 ? (
            <StatePanel
              kind="empty"
              title="Sin cajeros configurados"
              message="Activa usuarios POS para este tenant antes de evaluar cobertura por cajero."
            />
          ) : (
            <>
              <PosCashiersMetricCards
                grossCents={result.report.totals.gross_cents}
                ordersCount={result.report.totals.orders_count}
                averageTicketCents={result.report.totals.average_ticket_cents}
                configuredCashiersCount={result.report.totals.configured_cashiers_count}
              />

              {!result.report.attribution_supported ? (
                <StatePanel
                  kind="empty"
                  title="Desempeno por cajero aun no disponible"
                  message={result.report.limitation_reason}
                />
              ) : null}

              <PosCashiersCoverageSummary
                attributedOrdersCount={result.report.totals.attributed_orders_count}
                unattributedOrdersCount={result.report.totals.unattributed_orders_count}
                limitationReason={result.report.limitation_reason}
              />

              <PosCashiersTable rows={result.report.cashiers} />
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
