"use client";

type RetailChartTooltipRow = {
  label: string;
  value: string;
};

type RetailChartTooltipProps = {
  label: string;
  rows: RetailChartTooltipRow[];
};

export function RetailChartTooltip({ label, rows }: RetailChartTooltipProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="min-w-44 rounded-[var(--radius-base)] border border-border bg-surface p-3 shadow-sm">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <div className="mt-2 space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3 text-xs">
            <span className="text-muted">{row.label}</span>
            <span className="font-medium text-foreground">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
