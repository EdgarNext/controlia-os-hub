"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import type { RetailPostSaleTrendPoint, RetailSalesTrendGranularity } from "@/lib/retail-pos/reporting-overview";
import {
  formatRetailReportingCount,
  formatRetailReportingCurrency,
} from "@/lib/retail-pos/reporting-formatters";
import { RetailChartCard } from "./RetailChartCard";
import { RetailChartTooltip } from "./RetailChartTooltip";
import { RetailEmptyChartState } from "./RetailEmptyChartState";
import { RetailChartViewport } from "./RetailChartViewport";

type RetailPostSaleTrendChartPoint = RetailPostSaleTrendPoint & {
  saleCancellationHref?: string;
  fullReturnHref?: string;
  partialReturnHref?: string;
};

type RetailPostSaleTrendChartProps = {
  granularity: RetailSalesTrendGranularity;
  points: RetailPostSaleTrendChartPoint[];
};

type RetailPostSaleTrendMode = "operations" | "commercial_amount";

function ModeToggle({
  mode,
  onChange,
}: {
  mode: RetailPostSaleTrendMode;
  onChange: (mode: RetailPostSaleTrendMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Selector de métrica de evolución de postventa"
      className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 p-1"
    >
      {[
        { key: "operations" as const, label: "Operaciones" },
        { key: "commercial_amount" as const, label: "Monto comercial" },
      ].map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={mode === option.key}
          onClick={() => onChange(option.key)}
          className={
            mode === option.key
              ? "rounded-[calc(var(--radius-base)-4px)] bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              : "rounded-[calc(var(--radius-base)-4px)] px-3 py-1.5 text-xs font-medium text-muted"
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function RetailPostSaleTrendChart({ granularity, points }: RetailPostSaleTrendChartProps) {
  const router = useRouter();
  const [mode, setMode] = useState<RetailPostSaleTrendMode>("operations");
  const hasAnyData = points.some(
    (point) =>
      point.saleCancellationsCount > 0 ||
      point.fullReturnsCount > 0 ||
      point.partialReturnsCount > 0 ||
      point.saleCancellationsCents > 0 ||
      point.fullReturnsCents > 0 ||
      point.partialReturnsCents > 0,
  );

  return (
    <RetailChartCard
      title="Evolución de operaciones de postventa"
      description="Compara por periodo las anulaciones de venta pagada, devoluciones totales y devoluciones parciales usando la fecha registrada del documento."
      footer={
        points.length > 0 ? (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer font-medium text-foreground">Ver tabla de periodos</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted">
                      <th className="px-2 py-1">Periodo</th>
                      <th className="px-2 py-1">Anulaciones</th>
                      <th className="px-2 py-1">Devoluciones totales</th>
                      <th className="px-2 py-1">Devoluciones parciales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((point) => (
                      <tr key={point.periodKey} className="border-b border-border/60 text-foreground">
                        <td className="px-2 py-1">{point.periodLabel}</td>
                        <td className="px-2 py-1">
                          {mode === "operations"
                            ? formatRetailReportingCount(point.saleCancellationsCount)
                            : formatRetailReportingCurrency(point.saleCancellationsCents)}
                        </td>
                        <td className="px-2 py-1">
                          {mode === "operations"
                            ? formatRetailReportingCount(point.fullReturnsCount)
                            : formatRetailReportingCurrency(point.fullReturnsCents)}
                        </td>
                        <td className="px-2 py-1">
                          {mode === "operations"
                            ? formatRetailReportingCount(point.partialReturnsCount)
                            : formatRetailReportingCurrency(point.partialReturnsCents)}
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
        <RetailEmptyChartState message="Selecciona un rango de al menos dos días para consultar la evolución de postventa." />
      ) : !hasAnyData ? (
        <RetailEmptyChartState message="No se registraron operaciones de postventa en este periodo." />
      ) : (
        <div className="space-y-3">
          <ModeToggle mode={mode} onChange={setMode} />
          <RetailChartViewport heightClassName="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart accessibilityLayer data={points} margin={{ left: 8, right: 8, top: 12, bottom: 8 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="periodLabel" stroke="var(--muted)" tickLine={false} axisLine={false} />
                <YAxis
                  stroke="var(--muted)"
                  tickLine={false}
                  axisLine={false}
                  width={112}
                  tickFormatter={(value: number) =>
                    mode === "operations"
                      ? formatRetailReportingCount(value)
                      : formatRetailReportingCurrency(value)
                  }
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) {
                      return null;
                    }

                    const point = payload[0]?.payload as RetailPostSaleTrendPoint;
                    return (
                      <RetailChartTooltip
                        label={String(label)}
                        rows={[
                          {
                            label: "Anulaciones de venta pagada",
                            value:
                              mode === "operations"
                                ? formatRetailReportingCount(point.saleCancellationsCount)
                                : formatRetailReportingCurrency(point.saleCancellationsCents),
                          },
                          {
                            label: "Devoluciones totales",
                            value:
                              mode === "operations"
                                ? formatRetailReportingCount(point.fullReturnsCount)
                                : formatRetailReportingCurrency(point.fullReturnsCents),
                          },
                          {
                            label: "Devoluciones parciales",
                            value:
                              mode === "operations"
                                ? formatRetailReportingCount(point.partialReturnsCount)
                                : formatRetailReportingCurrency(point.partialReturnsCents),
                          },
                        ]}
                      />
                    );
                  }}
                />
                <Legend />
                <Bar
                  stackId="post-sale"
                  dataKey={mode === "operations" ? "saleCancellationsCount" : "saleCancellationsCents"}
                  name="Anulaciones de venta pagada"
                  fill="var(--danger)"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={false}
                  onClick={(data) => {
                    const href = (data?.payload as RetailPostSaleTrendChartPoint | undefined)?.saleCancellationHref;
                    if (href) {
                      router.push(href);
                    }
                  }}
                />
                <Bar
                  stackId="post-sale"
                  dataKey={mode === "operations" ? "fullReturnsCount" : "fullReturnsCents"}
                  name="Devoluciones totales"
                  fill="var(--success)"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={false}
                  onClick={(data) => {
                    const href = (data?.payload as RetailPostSaleTrendChartPoint | undefined)?.fullReturnHref;
                    if (href) {
                      router.push(href);
                    }
                  }}
                />
                <Bar
                  stackId="post-sale"
                  dataKey={mode === "operations" ? "partialReturnsCount" : "partialReturnsCents"}
                  name="Devoluciones parciales"
                  fill="var(--warning)"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={false}
                  onClick={(data) => {
                    const href = (data?.payload as RetailPostSaleTrendChartPoint | undefined)?.partialReturnHref;
                    if (href) {
                      router.push(href);
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </RetailChartViewport>
        </div>
      )}
    </RetailChartCard>
  );
}
