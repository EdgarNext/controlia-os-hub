import { Receipt, ShieldAlert, Users, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";

type PosCashiersMetricCardsProps = {
  grossCents: number;
  ordersCount: number;
  averageTicketCents: number;
  configuredCashiersCount: number;
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

export function PosCashiersMetricCards({
  grossCents,
  ordersCount,
  averageTicketCents,
  configuredCashiersCount,
}: PosCashiersMetricCardsProps) {
  const cards = [
    {
      label: "Ventas del periodo",
      value: formatCurrency(grossCents),
      helper: "Contexto total antes de atribuir por cajero",
      icon: Wallet,
    },
    {
      label: "Tickets del periodo",
      value: integerFormatter.format(ordersCount),
      helper: "Ordenes pagadas dentro del rango",
      icon: Receipt,
    },
    {
      label: "Ticket promedio",
      value: formatCurrency(averageTicketCents),
      helper: "Promedio general del periodo",
      icon: ShieldAlert,
    },
    {
      label: "Cajeros configurados",
      value: integerFormatter.format(configuredCashiersCount),
      helper: "Usuarios POS activos en este tenant",
      icon: Users,
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
