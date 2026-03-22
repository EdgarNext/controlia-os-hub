import { AlertTriangle, CircleAlert, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PosAlertsSummary } from "@/types/pos-reports";

type PosAlertsSummaryCardsProps = {
  summary: PosAlertsSummary;
};

const integerFormatter = new Intl.NumberFormat("es-MX");

export function PosAlertsSummaryCards({ summary }: PosAlertsSummaryCardsProps) {
  const cards = [
    {
      label: "Criticas",
      value: integerFormatter.format(summary.critical_count),
      helper: "Revisar primero",
      icon: AlertTriangle,
    },
    {
      label: "Medias",
      value: integerFormatter.format(summary.medium_count),
      helper: "Requieren seguimiento operativo",
      icon: CircleAlert,
    },
    {
      label: "Informativas",
      value: integerFormatter.format(summary.info_count),
      helper: "Contexto util para supervision",
      icon: Info,
    },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card key={card.label} className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted">{card.label}</p>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[calc(var(--radius-base)-4px)] bg-surface-2 text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-semibold text-foreground">{card.value}</p>
              <p className="text-xs text-muted">{card.helper}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
