import { AlertTriangle, ClipboardCheck, ShieldX } from "lucide-react";
import { Card } from "@/components/ui/card";

type PosCashierShiftHighlightsProps = {
  cashShiftsCount: number;
  openShiftsCount: number;
  limitationReason: string;
};

export function PosCashierShiftHighlights({
  cashShiftsCount,
  openShiftsCount,
  limitationReason,
}: PosCashierShiftHighlightsProps) {
  const rows = [
    {
      label: "Cobertura confirmada",
      value: `${cashShiftsCount} cash shifts`,
      helper: "La fuente canonica actual ya permite listar aperturas y cierres reales por kiosco.",
      icon: ClipboardCheck,
    },
    {
      label: "Conciliacion monetaria",
      value: "No disponible",
      helper: limitationReason,
      icon: AlertTriangle,
    },
    {
      label: "Turnos abiertos",
      value: String(openShiftsCount),
      helper: "El seguimiento de turnos abiertos ya existe; expected y difference siguen fuera de fase.",
      icon: ShieldX,
    },
  ] as const;

  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Lectura operativa</h2>
        <p className="text-sm text-muted">
          Estado real de lo que hoy puede supervisarse con la fuente canonica de cash shifts.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
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
