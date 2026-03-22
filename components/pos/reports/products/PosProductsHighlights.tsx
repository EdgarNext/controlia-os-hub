import { Package2, Target, TrendingDown, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PosProductsHighlights as PosProductsHighlightsData } from "@/types/pos-reports";

type PosProductsHighlightsProps = {
  highlights: PosProductsHighlightsData;
};

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value / 100);
}

export function PosProductsHighlights({ highlights }: PosProductsHighlightsProps) {
  const rows = [
    {
      label: "Mayor ingreso",
      value: highlights.top_revenue_product?.label ?? "Sin datos",
      helper: highlights.top_revenue_product
        ? `${formatCurrency(highlights.top_revenue_product.gross_cents)} | ${highlights.top_revenue_product.units_sold} unidades`
        : "No aplica",
      icon: Trophy,
    },
    {
      label: "Mayor volumen",
      value: highlights.top_units_product?.label ?? "Sin datos",
      helper: highlights.top_units_product
        ? `${highlights.top_units_product.units_sold} unidades | ${formatCurrency(highlights.top_units_product.gross_cents)}`
        : "No aplica",
      icon: Package2,
    },
  ] as const;

  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Lectura operativa</h2>
        <p className="text-sm text-muted">
          Puntos rapidos para detectar lideres y productos con menor traccion en el rango.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((row) => {
          const Icon = row.icon;

          return (
            <div
              key={row.label}
              className="rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2 p-3"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                <p className="text-sm font-medium text-muted">{row.label}</p>
              </div>
              <p className="mt-2 text-base font-semibold text-foreground">{row.value}</p>
              <p className="text-sm text-muted">{row.helper}</p>
            </div>
          );
        })}
      </div>

      <div className="space-y-3 rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2 p-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">Bajo desempeno del periodo</p>
        </div>

        {highlights.low_performers.length === 0 ? (
          <p className="text-sm text-muted">No hay productos vendidos para comparar desempeno.</p>
        ) : (
          <div className="space-y-2">
            {highlights.low_performers.map((row) => (
              <div key={row.product_id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{row.product_name}</p>
                  <p className="text-xs text-muted">
                    {row.units_sold} unidades en {row.order_count} tickets
                  </p>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <Target className="h-4 w-4 text-muted" aria-hidden="true" />
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(row.gross_cents)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
