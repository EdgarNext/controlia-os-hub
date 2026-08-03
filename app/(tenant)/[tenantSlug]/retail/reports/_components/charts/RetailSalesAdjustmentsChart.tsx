"use client";

import Link from "next/link";
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
import type { RetailSalesAdjustmentsTrendPoint, RetailSalesTrendGranularity } from "@/lib/retail-pos/reporting-overview";
import { formatRetailReportingCurrency } from "@/lib/retail-pos/reporting-formatters";
import { RetailChartCard } from "./RetailChartCard";
import { RetailChartTooltip } from "./RetailChartTooltip";
import { RetailEmptyChartState } from "./RetailEmptyChartState";
import { RetailChartViewport } from "./RetailChartViewport";

type RetailSalesAdjustmentsChartPoint = RetailSalesAdjustmentsTrendPoint & {
  discountHref?: string;
  postSaleHref?: string;
};

type RetailSalesAdjustmentsChartProps = {
  granularity: RetailSalesTrendGranularity;
  points: RetailSalesAdjustmentsChartPoint[];
};

export function RetailSalesAdjustmentsChart({ granularity, points }: RetailSalesAdjustmentsChartProps) {
  const hasAnyAdjustments = points.some(
    (point) => point.discountsCents > 0 || point.saleCancellationsCents > 0 || point.returnsCents > 0,
  );

  return (
    <RetailChartCard
      title="Descuentos y postventa por periodo"
      description="Los descuentos reducen el importe al momento del cobro. Las cancelaciones y devoluciones se registran después de la venta. Se muestran juntas para comparar su impacto por periodo, pero son operaciones diferentes."
      footer={
        points.length > 0 ? (
          <details className="text-xs text-muted">
            <summary className="cursor-pointer font-medium text-foreground">Ver tabla de periodos</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="px-2 py-1">Periodo</th>
                    <th className="px-2 py-1">Descuento concedido</th>
                    <th className="px-2 py-1">Ventas canceladas</th>
                    <th className="px-2 py-1">Devoluciones</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.periodKey} className="border-b border-border/60 text-foreground">
                      <td className="px-2 py-1">{point.periodLabel}</td>
                      <td className="px-2 py-1">
                        {point.discountHref ? (
                          <Link href={point.discountHref}>{formatRetailReportingCurrency(point.discountsCents)}</Link>
                        ) : (
                          formatRetailReportingCurrency(point.discountsCents)
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {point.postSaleHref ? (
                          <Link href={point.postSaleHref}>{formatRetailReportingCurrency(point.saleCancellationsCents)}</Link>
                        ) : (
                          formatRetailReportingCurrency(point.saleCancellationsCents)
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {point.postSaleHref ? (
                          <Link href={point.postSaleHref}>{formatRetailReportingCurrency(point.returnsCents)}</Link>
                        ) : (
                          formatRetailReportingCurrency(point.returnsCents)
                        )}
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
      ) : !hasAnyAdjustments ? (
        <RetailEmptyChartState message="No se registraron descuentos, cancelaciones o devoluciones en este periodo." />
      ) : (
        <RetailChartViewport heightClassName="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart accessibilityLayer data={points} margin={{ left: 8, right: 8, top: 12, bottom: 8 }}>
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

                  const point = payload[0]?.payload as RetailSalesAdjustmentsTrendPoint;
                  return (
                    <RetailChartTooltip
                      label={String(label)}
                      rows={[
                        {
                          label: "Descuento concedido",
                          value: formatRetailReportingCurrency(point.discountsCents),
                        },
                        {
                          label: "Ventas canceladas",
                          value: formatRetailReportingCurrency(point.saleCancellationsCents),
                        },
                        {
                          label: "Devoluciones",
                          value: formatRetailReportingCurrency(point.returnsCents),
                        },
                      ]}
                    />
                  );
                }}
              />
              <Legend />
              <Bar
                dataKey="discountsCents"
                name="Descuento concedido"
                fill="var(--warning)"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="saleCancellationsCents"
                name="Cancelaciones de venta pagada"
                fill="var(--danger)"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="returnsCents"
                name="Devoluciones"
                fill="var(--success)"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </RetailChartViewport>
      )}
    </RetailChartCard>
  );
}
