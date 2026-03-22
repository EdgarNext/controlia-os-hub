import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { PosAlertsHighlights } from "@/components/pos/reports/alerts/PosAlertsHighlights";
import { PosAlertsList } from "@/components/pos/reports/alerts/PosAlertsList";
import { PosAlertsReportHeader } from "@/components/pos/reports/alerts/PosAlertsReportHeader";
import { PosAlertsSummaryCards } from "@/components/pos/reports/alerts/PosAlertsSummaryCards";
import { PosReportsOverviewFilters } from "@/components/pos/reports/overview/PosReportsOverviewFilters";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import { getPosAlertsReport } from "@/lib/pos/reports/alerts";
import {
  buildPosReportsFiltersFromSearchParams,
  type PosReportsSearchParams,
} from "@/lib/pos/reports/search-params";
import type { PosAlertsReportData, PosReportsFilters } from "@/types/pos-reports";

type PosAlertsPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<PosReportsSearchParams>;
};

type PosAlertsPageResult =
  | {
      ok: true;
      filters: PosReportsFilters;
      defaultFilters: PosReportsFilters;
      report: PosAlertsReportData;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

async function loadPosAlertsPage(
  tenantSlug: string,
  searchParams: PosReportsSearchParams,
): Promise<PosAlertsPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "reports", "read");
    const { defaultFilters, filters } = buildPosReportsFiltersFromSearchParams(searchParams);
    const report = await getPosAlertsReport({
      tenantId: tenant.tenantId,
      tenantSlug,
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
        message: "No tienes permisos para consultar alertas POS en este tenant.",
        hint: "Solicita acceso de administrador del tenant.",
      };
    }

    throw error;
  }
}

export default async function PosAlertsPage({ params, searchParams }: PosAlertsPageProps) {
  const { tenantSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const result = await loadPosAlertsPage(tenantSlug, resolvedSearchParams);

  return (
    <div className="space-y-4">
      <PosAlertsReportHeader tenantSlug={tenantSlug} filters={result.ok ? result.filters : undefined} />

      {result.ok ? (
        <>
          <PosReportsOverviewFilters
            filters={result.filters}
            defaultFilters={result.defaultFilters}
          />

          {result.report.alerts.length === 0 ? (
            <StatePanel
              kind="empty"
              title="Sin alertas relevantes en el rango"
              message="No se detectaron hallazgos accionables con las reglas trazables disponibles para este periodo."
            />
          ) : (
            <>
              <PosAlertsSummaryCards summary={result.report.summary} />
              <PosAlertsHighlights
                alerts={result.report.alerts}
                limitations={result.report.limitations}
              />
              <PosAlertsList alerts={result.report.alerts} />
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
