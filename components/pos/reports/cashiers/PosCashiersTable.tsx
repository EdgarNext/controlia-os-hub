import { Card } from "@/components/ui/card";
import type { PosCashierPerformanceRow } from "@/types/pos-reports";

type PosCashiersTableProps = {
  rows: PosCashierPerformanceRow[];
};

function formatNullableMetric(value: number | null, kind: "currency" | "integer" | "percent") {
  if (value == null) {
    return "No disponible";
  }

  if (kind === "currency") {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0,
    }).format(value / 100);
  }

  if (kind === "percent") {
    return `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(value)}%`;
  }

  return new Intl.NumberFormat("es-MX").format(value);
}

export function PosCashiersTable({ rows }: PosCashiersTableProps) {
  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Roster operativo</h2>
        <p className="text-sm text-muted">
          Lista de cajeros configurados mientras se habilita una fuente canonica de desempeno individual.
        </p>
      </div>

      <div className="overflow-x-auto rounded-[calc(var(--radius-base)-4px)] border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Cajero</th>
              <th className="px-4 py-3 font-semibold">Rol</th>
              <th className="px-4 py-3 font-semibold">Ventas</th>
              <th className="px-4 py-3 font-semibold">Tickets</th>
              <th className="px-4 py-3 font-semibold">Ticket promedio</th>
              <th className="px-4 py-3 font-semibold">% ventas</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.cashier_id} className="border-t border-border">
                <td className="px-4 py-3 font-medium text-foreground">{row.cashier_name}</td>
                <td className="px-4 py-3 text-muted">{row.cashier_role}</td>
                <td className="px-4 py-3 text-muted">
                  {formatNullableMetric(row.gross_cents, "currency")}
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatNullableMetric(row.orders_count, "integer")}
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatNullableMetric(row.average_ticket_cents, "currency")}
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatNullableMetric(row.share_percent, "percent")}
                </td>
                <td className="px-4 py-3 text-muted">Pendiente fuente canonica</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
