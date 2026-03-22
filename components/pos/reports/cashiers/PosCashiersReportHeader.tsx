import { buildPosReportsHref } from "@/lib/pos/reports/search-params";
import type { PosReportsFilters } from "@/types/pos-reports";
import { PosReportsSectionHeader } from "../PosReportsSectionHeader";

type PosCashiersReportHeaderProps = {
  tenantSlug: string;
  filters?: PosReportsFilters;
};

export function PosCashiersReportHeader({
  tenantSlug,
  filters,
}: PosCashiersReportHeaderProps) {
  return (
    <PosReportsSectionHeader
      title="POS · Cajeros"
      description="Revisa la cobertura actual de atribucion por cajero y el contexto operativo del periodo consultado."
      links={
        filters
          ? [
              {
                href: buildPosReportsHref(`/${tenantSlug}/pos/reports`, filters),
                label: "Ver resumen",
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
