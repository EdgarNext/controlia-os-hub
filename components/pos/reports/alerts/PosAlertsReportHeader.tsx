import { buildPosReportsHref } from "@/lib/pos/reports/search-params";
import type { PosReportsFilters } from "@/types/pos-reports";
import { PosReportsSectionHeader } from "../PosReportsSectionHeader";

type PosAlertsReportHeaderProps = {
  tenantSlug: string;
  filters?: PosReportsFilters;
};

export function PosAlertsReportHeader({ tenantSlug, filters }: PosAlertsReportHeaderProps) {
  return (
    <PosReportsSectionHeader
      title="POS · Alertas"
      description="Prioriza hallazgos accionables del POS con reglas trazables y respaldadas por reportes del modulo."
      links={
        filters
          ? [
              {
                href: buildPosReportsHref(`/${tenantSlug}/pos/reports/sales`, filters),
                label: "Ver ventas",
              },
              {
                href: buildPosReportsHref(`/${tenantSlug}/pos/reports/products`, filters),
                label: "Ver productos",
              },
              {
                href: buildPosReportsHref(`/${tenantSlug}/pos/reports/cashier-shift`, filters),
                label: "Ver cortes",
              },
            ]
          : []
      }
    />
  );
}
