import { Card } from "@/components/ui/card";
import type { PosCashierShiftRow } from "@/types/pos-reports";

type PosCashierShiftTableProps = {
  rows: PosCashierShiftRow[];
};

const mxDateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatNullableCurrency(value: number | null) {
  if (value == null) {
    return "No disponible";
  }

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function formatDateTime(value: string) {
  return mxDateTimeFormatter.format(new Date(value));
}

export function PosCashierShiftTable({ rows }: PosCashierShiftTableProps) {
  function formatStatus(value: PosCashierShiftRow["status"]) {
    if (value === "open") return "Abierto";
    if (value === "canceled") return "Cancelado";
    return "Cerrado";
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Turnos de caja</h2>
        <p className="text-sm text-muted">
          Tabla principal de supervision con aperturas y cierres de caja canonicos del periodo.
        </p>
      </div>

      <div className="overflow-x-auto rounded-[calc(var(--radius-base)-4px)] border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Kiosco</th>
              <th className="px-4 py-3 font-semibold">Apertura</th>
              <th className="px-4 py-3 font-semibold">Cierre</th>
              <th className="px-4 py-3 font-semibold">Operador apertura</th>
              <th className="px-4 py-3 font-semibold">Operador cierre</th>
              <th className="px-4 py-3 font-semibold">Fondo inicial</th>
              <th className="px-4 py-3 font-semibold">Efectivo declarado</th>
              <th className="px-4 py-3 font-semibold">Expected</th>
              <th className="px-4 py-3 font-semibold">Difference</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.cash_shift_id} className="border-t border-border">
                <td className="px-4 py-3 font-medium text-foreground">{row.kiosk_label}</td>
                <td className="px-4 py-3 text-muted">
                  {formatDateTime(row.opened_at)}
                </td>
                <td className="px-4 py-3 text-muted">
                  {row.closed_at ? formatDateTime(row.closed_at) : "Abierto"}
                </td>
                <td className="px-4 py-3 text-muted">{row.opened_by_pos_user_name}</td>
                <td className="px-4 py-3 text-muted">
                  {row.closed_by_pos_user_name ?? "No disponible"}
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatNullableCurrency(row.opening_float_cents)}
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatNullableCurrency(row.declared_cash_cents)}
                </td>
                <td className="px-4 py-3 text-muted">{formatNullableCurrency(row.expected_cents)}</td>
                <td className="px-4 py-3 text-muted">
                  {formatNullableCurrency(row.difference_cents)}
                </td>
                <td className="px-4 py-3 text-muted">{formatStatus(row.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
