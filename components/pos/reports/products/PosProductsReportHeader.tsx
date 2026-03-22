import { buildPosReportsHref } from "@/lib/pos/reports/search-params";
import type { PosReportsFilters } from "@/types/pos-reports";
import { PosReportsSectionHeader } from "../PosReportsSectionHeader";

type PosProductsReportHeaderProps = {
  tenantSlug: string;
  filters?: PosReportsFilters;
};

export function PosProductsReportHeader({
  tenantSlug,
  filters,
}: PosProductsReportHeaderProps) {
  return (
    <PosReportsSectionHeader
      title="POS · Productos"
      description="Detecta que productos empujan ingresos, volumen y concentracion dentro del periodo consultado."
      links={
        filters
          ? [
              {
                href: buildPosReportsHref(`/${tenantSlug}/pos/reports`, filters),
                label: "Ver resumen",
              },
              {
                href: buildPosReportsHref(`/${tenantSlug}/pos/reports/sales`, filters),
                label: "Ver ventas",
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
