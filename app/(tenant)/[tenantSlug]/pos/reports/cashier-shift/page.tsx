import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { PosCashierShiftHighlights } from "@/components/pos/reports/cashier-shift/PosCashierShiftHighlights";
import { PosCashierShiftMetricCards } from "@/components/pos/reports/cashier-shift/PosCashierShiftMetricCards";
import { PosCashierShiftReportHeader } from "@/components/pos/reports/cashier-shift/PosCashierShiftReportHeader";
import { PosCashierShiftTable } from "@/components/pos/reports/cashier-shift/PosCashierShiftTable";
import { PosReportsOverviewFilters } from "@/components/pos/reports/overview/PosReportsOverviewFilters";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import { getPosCashierShiftReport } from "@/lib/pos/reports/cashier-shift";
import {
  buildPosReportsFiltersFromSearchParams,
  type PosReportsSearchParams,
} from "@/lib/pos/reports/search-params";
import type { PosCashierShiftReportData, PosReportsFilters } from "@/types/pos-reports";

type PosCashierShiftPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<PosReportsSearchParams>;
};

type PosCashierShiftPageResult =
  | {
      ok: true;
      filters: PosReportsFilters;
      defaultFilters: PosReportsFilters;
      report: PosCashierShiftReportData;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

async function loadPosCashierShiftPage(
  tenantSlug: string,
  searchParams: PosReportsSearchParams,
): Promise<PosCashierShiftPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "reports", "read");
    const { defaultFilters, filters } = buildPosReportsFiltersFromSearchParams(searchParams);
    const report = await getPosCashierShiftReport({
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
        message: "No tienes permisos para consultar cortes POS en este tenant.",
        hint: "Solicita acceso de administrador del tenant.",
      };
    }

    throw error;
  }
}

export default async function PosCashierShiftPage({
  params,
  searchParams,
}: PosCashierShiftPageProps) {
  const { tenantSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const result = await loadPosCashierShiftPage(tenantSlug, resolvedSearchParams);

  return (
    <div className="space-y-4">
      <PosCashierShiftReportHeader
        tenantSlug={tenantSlug}
        filters={result.ok ? result.filters : undefined}
      />

      {result.ok ? (
        <>
          <PosReportsOverviewFilters
            filters={result.filters}
            defaultFilters={result.defaultFilters}
          />

          {result.report.shifts.length === 0 ? (
            <StatePanel
              kind="empty"
              title="Sin cash shifts en el rango"
              message="Ajusta el periodo o confirma si este tenant ya sincroniza aperturas y cierres de caja."
            />
          ) : (
            <>
              <PosCashierShiftMetricCards
                cashShiftsCount={result.report.totals.cash_shifts_count}
                kiosksWithShiftsCount={result.report.totals.kiosks_with_shifts_count}
                totalExpectedCents={result.report.totals.total_expected_cents}
                openShiftsCount={result.report.totals.open_shifts_count}
                closedShiftsCount={result.report.totals.closed_shifts_count}
              />

              <PosCashierShiftHighlights
                cashShiftsCount={result.report.totals.cash_shifts_count}
                openShiftsCount={result.report.totals.open_shifts_count}
                limitationReason={result.report.limitation_reason}
              />

              <PosCashierShiftTable rows={result.report.shifts} />
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
