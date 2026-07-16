import { formatRetailReportingTimeZoneLabel } from "@/lib/retail-pos/reporting-formatters";

type RetailReportPeriodContextProps = {
  periodLabel: string;
  primaryDateLabel: string;
  note: string;
};

export function RetailReportPeriodContext({
  periodLabel,
  primaryDateLabel,
  note,
}: RetailReportPeriodContextProps) {
  return (
    <div className="rounded-[var(--radius-base)] border border-border bg-surface px-4 py-3 text-sm text-muted">
      <p className="font-medium text-foreground">Periodo seleccionado: {periodLabel}</p>
      <p>{primaryDateLabel}</p>
      <p>Zona horaria: {formatRetailReportingTimeZoneLabel()}</p>
      <p>{note}</p>
    </div>
  );
}
