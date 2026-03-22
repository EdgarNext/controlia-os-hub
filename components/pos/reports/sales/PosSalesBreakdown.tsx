import { Card } from "@/components/ui/card";
import type { PosSalesDistributionRow } from "@/types/pos-reports";

type PosSalesBreakdownProps = {
  title: string;
  description: string;
  rows: PosSalesDistributionRow[];
  emptyMessage?: string;
  countsAreEstimated?: boolean;
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

export function PosSalesBreakdown({
  title,
  description,
  rows,
  emptyMessage = "Sin datos disponibles",
  countsAreEstimated = false,
}: PosSalesBreakdownProps) {
  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2 px-4 py-6 text-sm text-muted">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.key} className="space-y-2 rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{row.label}</p>
                  <p className="text-xs text-muted">
                    {countsAreEstimated ? "Participacion estimada" : `${row.orders_count} tickets`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{formatCurrency(row.gross_cents)}</p>
                  <p className="text-xs text-muted">{percentFormatter.format(row.share_percent)}% del total</p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(row.share_percent, 4)}%` }}
                />
              </div>
            </div>
          ))}

          {countsAreEstimated ? (
            <p className="text-xs text-muted">
              La participacion por tickets es estimada desde la proporcion de ventas, porque la fuente actual no expone conteo canonico por metodo de pago.
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
