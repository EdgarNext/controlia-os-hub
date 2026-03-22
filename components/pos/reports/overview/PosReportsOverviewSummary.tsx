import { Card } from "@/components/ui/card";

type PosReportsOverviewSummaryRow = {
  label: string;
  orders_count: number;
  gross_cents: number;
  share_percent: number;
};

type PosReportsOverviewSummaryProps = {
  dateRangeLabel: string;
  bestDayLabel: string;
  bestDayGrossCents: number;
  rows: PosReportsOverviewSummaryRow[];
};

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value / 100);
}

export function PosReportsOverviewSummary({
  dateRangeLabel,
  bestDayLabel,
  bestDayGrossCents,
  rows,
}: PosReportsOverviewSummaryProps) {
  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Resumen operativo</h2>
          <p className="text-sm text-muted">{dateRangeLabel}</p>
        </div>

        <div className="rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Mejor dia</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{bestDayLabel}</p>
          <p className="text-sm text-muted">{formatCurrency(bestDayGrossCents)}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[calc(var(--radius-base)-4px)] border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Canal</th>
              <th className="px-4 py-3 font-semibold">Tickets</th>
              <th className="px-4 py-3 font-semibold">Ventas</th>
              <th className="px-4 py-3 font-semibold">% del total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <td className="px-4 py-3 font-medium text-foreground">{row.label}</td>
                <td className="px-4 py-3 text-muted">{row.orders_count}</td>
                <td className="px-4 py-3 text-muted">{formatCurrency(row.gross_cents)}</td>
                <td className="px-4 py-3 text-muted">{percentFormatter.format(row.share_percent)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
