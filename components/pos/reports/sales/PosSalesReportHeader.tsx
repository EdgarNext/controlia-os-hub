import { buildPosReportsHref } from "@/lib/pos/reports/search-params";
import type { PosReportsFilters } from "@/types/pos-reports";
import { PosReportsSectionHeader } from "../PosReportsSectionHeader";

type PosSalesReportHeaderProps = {
  tenantSlug: string;
  filters?: PosReportsFilters;
};

export function PosSalesReportHeader({ tenantSlug, filters }: PosSalesReportHeaderProps) {
  return (
    <PosReportsSectionHeader
      title="POS · Ventas"
      description="Analiza ingresos, tendencia diaria y variaciones relevantes del periodo operativo."
      links={
        filters
          ? [
              {
                href: buildPosReportsHref(`/${tenantSlug}/pos/reports`, filters),
                label: "Ver resumen",
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
