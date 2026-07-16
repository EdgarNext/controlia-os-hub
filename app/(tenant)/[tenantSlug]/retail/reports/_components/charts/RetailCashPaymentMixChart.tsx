"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatRetailReportingCurrency } from "@/lib/retail-pos/reporting-formatters";
import { RetailChartCard } from "./RetailChartCard";
import { RetailChartTooltip } from "./RetailChartTooltip";
import { RetailChartViewport } from "./RetailChartViewport";
import { RetailEmptyChartState } from "./RetailEmptyChartState";

type RetailCashPaymentMixPoint = {
  shiftId: string;
  shiftLabel: string;
  deviceLabel: string;
  cashSalesCents: number;
  cardSalesCents: number;
  totalSalesCents: number;
  href?: string;
};

type RetailCashPaymentMixChartProps = {
  points: RetailCashPaymentMixPoint[];
};

export function RetailCashPaymentMixChart({ points }: RetailCashPaymentMixChartProps) {
  const router = useRouter();

  return (
    <RetailChartCard
      title="Composición de cobros por turno"
      description="Muestra cuánto se cobró en efectivo y cuánto con tarjeta dentro de cada turno incluido en el periodo."
      footer={
        points.length > 0 ? (
          <details className="text-xs text-muted">
            <summary className="cursor-pointer font-medium text-foreground">Ver tabla de cobros</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="px-2 py-1">Turno</th>
                    <th className="px-2 py-1">Efectivo</th>
                    <th className="px-2 py-1">Tarjeta</th>
                    <th className="px-2 py-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.shiftId} className="border-b border-border/60 text-foreground">
                      <td className="px-2 py-1">{point.shiftLabel}</td>
                      <td className="px-2 py-1">{formatRetailReportingCurrency(point.cashSalesCents)}</td>
                      <td className="px-2 py-1">{formatRetailReportingCurrency(point.cardSalesCents)}</td>
                      <td className="px-2 py-1">{formatRetailReportingCurrency(point.totalSalesCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null
      }
    >
      {points.length === 0 ? (
        <RetailEmptyChartState message="No hay cobros por turno para construir la composición del periodo." />
      ) : (
        <RetailChartViewport heightClassName="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart accessibilityLayer data={points} margin={{ left: 8, right: 8, top: 12, bottom: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="shiftLabel" stroke="var(--muted)" tickLine={false} axisLine={false} />
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

                  const point = payload[0]?.payload as RetailCashPaymentMixPoint;
                  return (
                    <RetailChartTooltip
                      label={`${String(label)} · ${point.deviceLabel}`}
                      rows={[
                        { label: "Cobros en efectivo", value: formatRetailReportingCurrency(point.cashSalesCents) },
                        { label: "Cobros con tarjeta", value: formatRetailReportingCurrency(point.cardSalesCents) },
                        { label: "Total cobrado", value: formatRetailReportingCurrency(point.totalSalesCents) },
                      ]}
                    />
                  );
                }}
              />
              <Legend />
              <Bar
                stackId="collections"
                dataKey="cashSalesCents"
                name="Cobros en efectivo"
                fill="var(--primary)"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
                onClick={(data) => {
                  const href = (data?.payload as RetailCashPaymentMixPoint | undefined)?.href;
                  if (href) {
                    router.push(href);
                  }
                }}
              />
              <Bar
                stackId="collections"
                dataKey="cardSalesCents"
                name="Cobros con tarjeta"
                fill="var(--success)"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
                onClick={(data) => {
                  const href = (data?.payload as RetailCashPaymentMixPoint | undefined)?.href;
                  if (href) {
                    router.push(href);
                  }
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </RetailChartViewport>
      )}
    </RetailChartCard>
  );
}
