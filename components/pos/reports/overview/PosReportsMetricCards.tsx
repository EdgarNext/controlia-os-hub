import { CreditCard, DollarSign, Receipt, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";

type PosReportsMetricCardsProps = {
  grossCents: number;
  ordersCount: number;
  averageTicketCents: number;
  dominantPayment: {
    label: string;
    cents: number;
  };
};

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat("es-MX");

function formatCurrency(value: number) {
  return currencyFormatter.format(value / 100);
}

export function PosReportsMetricCards({
  grossCents,
  ordersCount,
  averageTicketCents,
  dominantPayment,
}: PosReportsMetricCardsProps) {
  const cards = [
    {
      label: "Venta total",
      value: formatCurrency(grossCents),
      helper: "Total del periodo filtrado",
      icon: DollarSign,
    },
    {
      label: "Tickets",
      value: integerFormatter.format(ordersCount),
      helper: "Ordenes pagadas en el rango",
      icon: Receipt,
    },
    {
      label: "Ticket promedio",
      value: formatCurrency(averageTicketCents),
      helper: "Promedio por ticket pagado",
      icon: TrendingUp,
    },
    {
      label: "Metodo dominante",
      value: dominantPayment.label,
      helper: dominantPayment.cents > 0 ? formatCurrency(dominantPayment.cents) : "Sin ventas",
      icon: CreditCard,
    },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
