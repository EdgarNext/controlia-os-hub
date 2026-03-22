import { ArrowDownRight, ArrowUpRight, Minus, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PosSalesHighlights as PosSalesHighlightsData } from "@/types/pos-reports";

type PosSalesHighlightsProps = {
  highlights: PosSalesHighlightsData;
};

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value / 100);
}

export function PosSalesHighlights({ highlights }: PosSalesHighlightsProps) {
  const rows = [
    {
      label: "Mejor dia",
      value: highlights.best_day.label,
      helper: formatCurrency(highlights.best_day.gross_cents),
      icon: Trophy,
    },
    {
      label: "Dia mas bajo",
      value: highlights.quietest_day.label,
      helper: formatCurrency(highlights.quietest_day.gross_cents),
      icon: Minus,
    },
    {
      label: "Mayor subida",
      value: highlights.strongest_growth?.label ?? "Sin cambio relevante",
      helper: highlights.strongest_growth
        ? `+${formatCurrency(highlights.strongest_growth.change_cents)}`
        : "No aplica",
      icon: ArrowUpRight,
    },
    {
      label: "Mayor caida",
      value: highlights.sharpest_drop?.label ?? "Sin cambio relevante",
      helper: highlights.sharpest_drop
        ? formatCurrency(highlights.sharpest_drop.change_cents)
        : "No aplica",
      icon: ArrowDownRight,
    },
  ] as const;

  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Variaciones relevantes</h2>
        <p className="text-sm text-muted">
          Puntos de cambio observables dentro del rango con actividad.
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
    </Card>
  );
}
