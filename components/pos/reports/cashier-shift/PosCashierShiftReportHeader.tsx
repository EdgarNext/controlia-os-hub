import { buildPosReportsHref } from "@/lib/pos/reports/search-params";
import type { PosReportsFilters } from "@/types/pos-reports";
import { PosReportsSectionHeader } from "../PosReportsSectionHeader";

type PosCashierShiftReportHeaderProps = {
  tenantSlug: string;
  filters?: PosReportsFilters;
};

export function PosCashierShiftReportHeader({
  tenantSlug,
  filters,
}: PosCashierShiftReportHeaderProps) {
  return (
    <PosReportsSectionHeader
      title="POS · Cortes"
      description="Supervisa aperturas y cierres de caja reales por kiosco dentro del periodo, con conciliacion monetaria aun parcial."
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
