"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RetailSalesActivityTrendPoint, RetailSalesTrendGranularity } from "@/lib/retail-pos/reporting-overview";
import { formatRetailReportingCurrency } from "@/lib/retail-pos/reporting-formatters";
import { RetailChartCard } from "./RetailChartCard";
import { RetailChartTooltip } from "./RetailChartTooltip";
import { RetailEmptyChartState } from "./RetailEmptyChartState";
import { RetailChartViewport } from "./RetailChartViewport";

type RetailSalesActivityChartPoint = RetailSalesActivityTrendPoint & {
  href?: string;
};

type RetailSalesActivityChartProps = {
  granularity: RetailSalesTrendGranularity;
  points: RetailSalesActivityChartPoint[];
};

export function RetailSalesActivityChart({ granularity, points }: RetailSalesActivityChartProps) {
  return (
    <RetailChartCard
      title="Venta cobrada y ticket promedio por periodo"
      description="Las barras muestran la venta cobrada. La línea muestra el ticket promedio calculado con la venta cobrada del bucket dividida entre sus ventas pagadas."
      footer={
        points.length > 0 ? (
          <details className="text-xs text-muted">
            <summary className="cursor-pointer font-medium text-foreground">Ver tabla de periodos</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="px-2 py-1">Periodo</th>
                    <th className="px-2 py-1">Venta cobrada</th>
                    <th className="px-2 py-1">Ventas pagadas</th>
                    <th className="px-2 py-1">Ticket promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.periodKey} className="border-b border-border/60 text-foreground">
                      <td className="px-2 py-1">
                        {point.href ? <Link href={point.href}>{point.periodLabel}</Link> : point.periodLabel}
                      </td>
                      <td className="px-2 py-1">{formatRetailReportingCurrency(point.collectedSalesCents)}</td>
                      <td className="px-2 py-1">{point.paidSalesCount}</td>
                      <td className="px-2 py-1">
                        {point.averageTicketCents === null
                          ? "Sin ticket"
                          : formatRetailReportingCurrency(point.averageTicketCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null
      }
    >
      {granularity === "none" ? (
        <RetailEmptyChartState message="Selecciona un rango de al menos dos días para consultar la evolución de ventas." />
      ) : (
        <RetailChartViewport heightClassName="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart accessibilityLayer data={points} margin={{ left: 8, right: 8, top: 12, bottom: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="periodLabel" stroke="var(--muted)" tickLine={false} axisLine={false} />
              <YAxis
                yAxisId="sales"
                stroke="var(--muted)"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => formatRetailReportingCurrency(value)}
                width={108}
              />
              <YAxis
                yAxisId="ticket"
                orientation="right"
                stroke="var(--muted)"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => formatRetailReportingCurrency(value)}
                width={108}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) {
                    return null;
                  }

                  const point = payload[0]?.payload as RetailSalesActivityTrendPoint;
                  return (
                    <RetailChartTooltip
                      label={String(label)}
                      rows={[
                        {
                          label: "Venta cobrada",
                          value: formatRetailReportingCurrency(point.collectedSalesCents),
                        },
                        {
                          label: "Ventas pagadas",
                          value: String(point.paidSalesCount),
                        },
                        {
                          label: "Ticket promedio",
                          value:
                            point.averageTicketCents === null
                              ? "Sin ticket"
                              : formatRetailReportingCurrency(point.averageTicketCents),
                        },
                      ]}
                    />
                  );
                }}
              />
              <Legend />
              <Bar
                yAxisId="sales"
                dataKey="collectedSalesCents"
                name="Venta cobrada"
                fill="var(--primary)"
                radius={[8, 8, 0, 0]}
                isAnimationActive={false}
              />
              <Line
                yAxisId="ticket"
                type="monotone"
                dataKey="averageTicketCents"
                name="Ticket promedio"
                stroke="var(--success)"
                strokeWidth={3}
                strokeDasharray="6 4"
                dot={{ r: 3, fill: "var(--success)", strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </RetailChartViewport>
      )}
    </RetailChartCard>
  );
}
