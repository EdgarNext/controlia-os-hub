import { Card } from "@/components/ui/card";
import type { PosProductPerformanceRow } from "@/types/pos-reports";

type PosProductsTableProps = {
  rows: PosProductPerformanceRow[];
};

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value / 100);
}

function formatMixLabel(row: PosProductPerformanceRow) {
  if (row.quick_sale_gross_cents > 0 && row.tab_gross_cents > 0) {
    return "Mixto";
  }

  if (row.tab_gross_cents > 0) {
    return "Mesas";
  }

  return "Venta rapida";
}

export function PosProductsTable({ rows }: PosProductsTableProps) {
  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Desempeno por producto</h2>
        <p className="text-sm text-muted">
          Tabla operativa para revisar ingreso, volumen y concentracion por item vendido.
        </p>
      </div>

      <div className="overflow-x-auto rounded-[calc(var(--radius-base)-4px)] border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Producto</th>
              <th className="px-4 py-3 font-semibold">Categoria</th>
              <th className="px-4 py-3 font-semibold">Unidades</th>
              <th className="px-4 py-3 font-semibold">Tickets</th>
              <th className="px-4 py-3 font-semibold">Ventas</th>
              <th className="px-4 py-3 font-semibold">Precio promedio</th>
              <th className="px-4 py-3 font-semibold">% mix</th>
              <th className="px-4 py-3 font-semibold">Canal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.product_id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{row.product_name}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted">
                      {row.product_type ? <span>{row.product_type}</span> : null}
                      {row.product_class ? <span>{row.product_class}</span> : null}
                      {row.is_popular ? <span>Popular</span> : null}
                      {row.is_sold_out ? <span>Sold out</span> : null}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{row.category_name ?? "Sin categoria"}</td>
                <td className="px-4 py-3 text-muted">{row.units_sold}</td>
                <td className="px-4 py-3 text-muted">{row.order_count}</td>
                <td className="px-4 py-3 font-medium text-foreground">
                  {formatCurrency(row.gross_cents)}
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatCurrency(row.average_unit_price_cents)}
                </td>
                <td className="px-4 py-3 text-muted">
                  {percentFormatter.format(row.share_percent)}%
                </td>
                <td className="px-4 py-3 text-muted">{formatMixLabel(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
