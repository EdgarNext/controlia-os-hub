import { buildPosReportsHref } from "@/lib/pos/reports/search-params";
import type { PosReportsFilters } from "@/types/pos-reports";
import { PosReportsSectionHeader } from "../PosReportsSectionHeader";

type PosReportsOverviewHeaderProps = {
  tenantSlug: string;
  filters?: PosReportsFilters;
};

export function PosReportsOverviewHeader({ tenantSlug, filters }: PosReportsOverviewHeaderProps) {
  return (
    <PosReportsSectionHeader
      title="POS · Reportes"
      description="Monitorea ventas, tickets y tendencia operativa del POS en el rango seleccionado."
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
                href: buildPosReportsHref(`/${tenantSlug}/pos/reports/alerts`, filters),
                label: "Ver alertas",
              },
            ]
          : []
      }
    />
  );
}
