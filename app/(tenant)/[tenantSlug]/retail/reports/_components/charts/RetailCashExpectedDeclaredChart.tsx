"use client";

import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRetailReportingCurrency } from "@/lib/retail-pos/reporting-formatters";
import { RetailChartCard } from "./RetailChartCard";
import { RetailChartTooltip } from "./RetailChartTooltip";
import { RetailChartViewport } from "./RetailChartViewport";
import { RetailEmptyChartState } from "./RetailEmptyChartState";

type RetailCashExpectedDeclaredPoint = {
  shiftId: string;
  shiftLabel: string;
  deviceLabel: string;
  openedAt: string;
  closedAt: string | null;
  expectedCashCents: number;
  declaredCashCents: number;
  differenceCents: number;
  href?: string;
};

type RetailCashExpectedDeclaredChartProps = {
  points: RetailCashExpectedDeclaredPoint[];
};

export function RetailCashExpectedDeclaredChart({ points }: RetailCashExpectedDeclaredChartProps) {
  const router = useRouter();

  return (
    <RetailChartCard
      title="Efectivo esperado contra declarado por turno"
      description="Compara por turno cerrado el efectivo esperado por ventas y reembolsos contra el efectivo declarado al cierre."
      footer={
        points.length > 0 ? (
          <details className="text-xs text-muted">
            <summary className="cursor-pointer font-medium text-foreground">Ver tabla de turnos</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="px-2 py-1">Turno</th>
                    <th className="px-2 py-1">Esperado</th>
                    <th className="px-2 py-1">Declarado</th>
                    <th className="px-2 py-1">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.shiftId} className="border-b border-border/60 text-foreground">
                      <td className="px-2 py-1">{point.shiftLabel}</td>
                      <td className="px-2 py-1">{formatRetailReportingCurrency(point.expectedCashCents)}</td>
                      <td className="px-2 py-1">{formatRetailReportingCurrency(point.declaredCashCents)}</td>
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
        <RetailEmptyChartState message="No hay turnos cerrados con efectivo declarado para comparar esperado y declarado." />
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

                  const point = payload[0]?.payload as RetailCashExpectedDeclaredPoint;
                  return (
                    <RetailChartTooltip
                      label={`${String(label)} · ${point.deviceLabel}`}
                      rows={[
                        { label: "Efectivo esperado", value: formatRetailReportingCurrency(point.expectedCashCents) },
                        { label: "Efectivo declarado", value: formatRetailReportingCurrency(point.declaredCashCents) },
                        { label: "Diferencia", value: formatRetailReportingCurrency(point.differenceCents) },
                      ]}
                    />
                  );
                }}
              />
              <Legend />
              <Bar
                dataKey="expectedCashCents"
                name="Efectivo esperado"
                fill="var(--primary)"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
                onClick={(data) => {
                  const href = (data?.payload as RetailCashExpectedDeclaredPoint | undefined)?.href;
                  if (href) {
                    router.push(href);
                  }
                }}
              />
              <Bar
                dataKey="declaredCashCents"
                name="Efectivo declarado"
                fill="var(--success)"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
                onClick={(data) => {
                  const href = (data?.payload as RetailCashExpectedDeclaredPoint | undefined)?.href;
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
