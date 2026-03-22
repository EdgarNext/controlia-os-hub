import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";

type PosCashiersCoverageSummaryProps = {
  attributedOrdersCount: number;
  unattributedOrdersCount: number;
  limitationReason: string;
};

export function PosCashiersCoverageSummary({
  attributedOrdersCount,
  unattributedOrdersCount,
  limitationReason,
}: PosCashiersCoverageSummaryProps) {
  const rows = [
    {
      label: "Ordenes atribuibles",
      value: attributedOrdersCount,
      helper: "Hoy no hay relacion canonica activa con pos_users",
      icon: CheckCircle2,
    },
    {
      label: "Ordenes sin atribucion",
      value: unattributedOrdersCount,
      helper: limitationReason,
      icon: AlertTriangle,
    },
  ] as const;

  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Cobertura de atribucion</h2>
        <p className="text-sm text-muted">
          Estado actual de la fuente que deberia ligar orden pagada con cajero.
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
