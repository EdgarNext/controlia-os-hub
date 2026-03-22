import { Boxes, DollarSign, Package2, PieChart } from "lucide-react";
import { Card } from "@/components/ui/card";

type PosProductsMetricCardsProps = {
  grossCents: number;
  unitsSold: number;
  productsSoldCount: number;
  topFiveSharePercent: number;
};

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat("es-MX");
const percentFormatter = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });

function formatCurrency(value: number) {
  return currencyFormatter.format(value / 100);
}

export function PosProductsMetricCards({
  grossCents,
  unitsSold,
  productsSoldCount,
  topFiveSharePercent,
}: PosProductsMetricCardsProps) {
  const cards = [
    {
      label: "Venta por producto",
      value: formatCurrency(grossCents),
      helper: "Ingreso sumado desde lineas vendidas",
      icon: DollarSign,
    },
    {
      label: "Unidades vendidas",
      value: integerFormatter.format(unitsSold),
      helper: "Cantidad total despachada en el rango",
      icon: Package2,
    },
    {
      label: "Productos con venta",
      value: integerFormatter.format(productsSoldCount),
      helper: "Catalogo con al menos una unidad vendida",
      icon: Boxes,
    },
    {
      label: "Concentracion top 5",
      value: `${percentFormatter.format(topFiveSharePercent)}%`,
      helper: "Participacion de los 5 productos lideres",
      icon: PieChart,
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
