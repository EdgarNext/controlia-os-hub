import { ClipboardList, LockOpen, MonitorSmartphone, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";

type PosCashierShiftMetricCardsProps = {
  cashShiftsCount: number;
  kiosksWithShiftsCount: number;
  totalExpectedCents: number | null;
  openShiftsCount: number;
  closedShiftsCount: number;
};

const integerFormatter = new Intl.NumberFormat("es-MX");
const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function formatNullableCurrency(value: number | null) {
  return value == null ? "No disponible" : currencyFormatter.format(value / 100);
}

function formatNullableInteger(value: number | null) {
  return value == null ? "No disponible" : integerFormatter.format(value);
}

export function PosCashierShiftMetricCards({
  cashShiftsCount,
  kiosksWithShiftsCount,
  totalExpectedCents,
  openShiftsCount,
  closedShiftsCount,
}: PosCashierShiftMetricCardsProps) {
  const cards = [
    {
      label: "Turnos de caja",
      value: integerFormatter.format(cashShiftsCount),
      helper: "Turnos de caja canonicos en el periodo",
      icon: ClipboardList,
    },
    {
      label: "Kioscos con turno",
      value: integerFormatter.format(kiosksWithShiftsCount),
      helper: "Cobertura operativa del periodo",
      icon: MonitorSmartphone,
    },
    {
      label: "Expected total",
      value: formatNullableCurrency(totalExpectedCents),
      helper: "Pendiente de contrato canonico",
      icon: Wallet,
    },
    {
      label: "Turnos abiertos",
      value: formatNullableInteger(openShiftsCount),
      helper: `${integerFormatter.format(closedShiftsCount)} cerrados en el periodo`,
      icon: LockOpen,
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
