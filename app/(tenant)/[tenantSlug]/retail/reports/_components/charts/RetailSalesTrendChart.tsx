"use client";

import Link from "next/link";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RetailSalesTrendGranularity, RetailSalesTrendPoint } from "@/lib/retail-pos/reporting-overview";
import { formatRetailReportingCurrency } from "@/lib/retail-pos/reporting-formatters";
import { RetailChartCard } from "./RetailChartCard";
import { RetailChartTooltip } from "./RetailChartTooltip";
import { RetailEmptyChartState } from "./RetailEmptyChartState";
import { RetailChartViewport } from "./RetailChartViewport";

type RetailSalesTrendChartPoint = RetailSalesTrendPoint & {
  href?: string;
};

type RetailSalesTrendChartProps = {
  granularity: RetailSalesTrendGranularity;
  points: RetailSalesTrendChartPoint[];
};

export function RetailSalesTrendChart({ granularity, points }: RetailSalesTrendChartProps) {
  return (
    <RetailChartCard
      title="Tendencia de venta cobrada y resultado comercial"
      description="La venta se agrupa por fecha de cobro y la postventa por fecha registrada. Una devolución de hoy puede afectar el resultado de hoy."
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
                    <th className="px-2 py-1">Resultado comercial</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.periodKey} className="border-b border-border/60 text-foreground">
                      <td className="px-2 py-1">
                        {point.href ? <Link href={point.href}>{point.periodLabel}</Link> : point.periodLabel}
                      </td>
                      <td className="px-2 py-1">{formatRetailReportingCurrency(point.collectedSalesCents)}</td>
                      <td className="px-2 py-1">{formatRetailReportingCurrency(point.commercialResultCents)}</td>
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
        <RetailEmptyChartState message="Selecciona un rango de al menos dos días para consultar la tendencia." />
      ) : (
        <RetailChartViewport heightClassName="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart accessibilityLayer data={points} margin={{ left: 8, right: 8, top: 12, bottom: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="periodLabel" stroke="var(--muted)" tickLine={false} axisLine={false} />
              <YAxis
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

                  const point = payload[0]?.payload as RetailSalesTrendPoint;
                  return (
                    <RetailChartTooltip
                      label={String(label)}
                      rows={[
                        {
                          label: "Venta cobrada",
                          value: formatRetailReportingCurrency(point.collectedSalesCents),
                        },
                        {
                          label: "Resultado comercial",
                          value: formatRetailReportingCurrency(point.commercialResultCents),
                        },
                      ]}
                    />
                  );
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="collectedSalesCents"
                name="Venta cobrada"
                stroke="var(--primary)"
                strokeWidth={3}
                dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="commercialResultCents"
                name="Resultado comercial"
                stroke="var(--success)"
                strokeWidth={3}
                strokeDasharray="6 4"
                dot={{ r: 3, fill: "var(--success)", strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </RetailChartViewport>
      )}
    </RetailChartCard>
  );
}
