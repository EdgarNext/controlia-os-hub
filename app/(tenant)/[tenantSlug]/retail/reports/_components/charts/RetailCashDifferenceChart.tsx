"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatRetailReportingCurrency } from "@/lib/retail-pos/reporting-formatters";
import { RetailChartCard } from "./RetailChartCard";
import { RetailChartTooltip } from "./RetailChartTooltip";
import { RetailChartViewport } from "./RetailChartViewport";
import { RetailEmptyChartState } from "./RetailEmptyChartState";

type RetailCashDifferencePoint = {
  shiftId: string;
  shiftLabel: string;
  deviceLabel: string;
  differenceCents: number;
  expectedCashCents: number;
  declaredCashCents: number;
  href?: string;
};

type RetailCashDifferenceChartProps = {
  points: RetailCashDifferencePoint[];
};

export function RetailCashDifferenceChart({ points }: RetailCashDifferenceChartProps) {
  const router = useRouter();

  return (
    <RetailChartCard
      title="Diferencias de caja por turno"
      description="Permite ubicar turnos cerrados con sobrante, faltante o conciliación exacta sin depender únicamente del color."
      footer={
        points.length > 0 ? (
          <details className="text-xs text-muted">
            <summary className="cursor-pointer font-medium text-foreground">Ver tabla de diferencias</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="px-2 py-1">Turno</th>
                    <th className="px-2 py-1">Resultado</th>
                    <th className="px-2 py-1">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.shiftId} className="border-b border-border/60 text-foreground">
                      <td className="px-2 py-1">{point.shiftLabel}</td>
                      <td className="px-2 py-1">
                        {point.differenceCents > 0 ? "Sobrante" : point.differenceCents < 0 ? "Faltante" : "Sin diferencia"}
                      </td>
                      <td className="px-2 py-1">{formatRetailReportingCurrency(point.differenceCents)}</td>
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
        <RetailEmptyChartState message="No hay turnos cerrados con diferencia calculable para esta visualización." />
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

                  const point = payload[0]?.payload as RetailCashDifferencePoint;
                  return (
                    <RetailChartTooltip
                      label={`${String(label)} · ${point.deviceLabel}`}
                      rows={[
                        { label: "Diferencia de caja", value: formatRetailReportingCurrency(point.differenceCents) },
                        { label: "Efectivo esperado", value: formatRetailReportingCurrency(point.expectedCashCents) },
                        { label: "Efectivo declarado", value: formatRetailReportingCurrency(point.declaredCashCents) },
                      ]}
                    />
                  );
                }}
              />
              <Bar
                dataKey="differenceCents"
                name="Diferencia de caja"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
                onClick={(data) => {
                  const href = (data?.payload as RetailCashDifferencePoint | undefined)?.href;
                  if (href) {
                    router.push(href);
                  }
                }}
              >
                {points.map((point) => (
                  <Cell
                    key={point.shiftId}
                    fill={
                      point.differenceCents > 0
                        ? "var(--warning)"
                        : point.differenceCents < 0
                          ? "var(--danger)"
                          : "var(--success)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </RetailChartViewport>
      )}
    </RetailChartCard>
  );
}
