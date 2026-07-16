"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatRetailReportingCount,
  formatRetailReportingCurrency,
} from "@/lib/retail-pos/reporting-formatters";
import { RetailChartCard } from "./RetailChartCard";
import { RetailChartTooltip } from "./RetailChartTooltip";
import { RetailEmptyChartState } from "./RetailEmptyChartState";
import { RetailChartViewport } from "./RetailChartViewport";

type RetailPostSaleReasonsChartRow = {
  reasonCode: string;
  label: string;
  operationsCount: number;
  totalAmountCents: number;
  href?: string;
};

type RetailPostSaleReasonsChartProps = {
  rows: RetailPostSaleReasonsChartRow[];
};

type RetailPostSaleReasonsMode = "operations" | "commercial_amount";

function ModeToggle({
  mode,
  onChange,
}: {
  mode: RetailPostSaleReasonsMode;
  onChange: (mode: RetailPostSaleReasonsMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Selector de métrica de motivos principales"
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

export function RetailPostSaleReasonsChart({ rows }: RetailPostSaleReasonsChartProps) {
  const router = useRouter();
  const [mode, setMode] = useState<RetailPostSaleReasonsMode>("operations");
  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((left, right) =>
      mode === "operations"
        ? right.operationsCount - left.operationsCount || right.totalAmountCents - left.totalAmountCents
        : right.totalAmountCents - left.totalAmountCents || right.operationsCount - left.operationsCount,
    );
    return copy.slice(0, 10);
  }, [mode, rows]);

  return (
    <RetailChartCard
      title="Motivos principales"
      description="Muestra qué motivos concentran más operaciones o mayor monto comercial revertido."
      footer={
        sortedRows.length > 0 ? (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer font-medium text-foreground">Ver tabla de motivos</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted">
                      <th className="px-2 py-1">Motivo</th>
                      <th className="px-2 py-1">Operaciones</th>
                      <th className="px-2 py-1">Monto comercial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => (
                      <tr key={row.reasonCode} className="border-b border-border/60 text-foreground">
                        <td className="px-2 py-1">{row.label}</td>
                        <td className="px-2 py-1">{formatRetailReportingCount(row.operationsCount)}</td>
                        <td className="px-2 py-1">{formatRetailReportingCurrency(row.totalAmountCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null
      }
    >
      {rows.length === 0 ? (
        <RetailEmptyChartState message="No existen motivos de postventa para los filtros seleccionados." />
      ) : (
        <div className="space-y-3">
          <ModeToggle mode={mode} onChange={setMode} />
          <RetailChartViewport heightClassName="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                accessibilityLayer
                data={sortedRows}
                layout="vertical"
                margin={{ left: 8, right: 8, top: 12, bottom: 8 }}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="var(--muted)"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) =>
                    mode === "operations"
                      ? formatRetailReportingCount(value)
                      : formatRetailReportingCurrency(value)
                  }
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  stroke="var(--muted)"
                  tickLine={false}
                  axisLine={false}
                  width={132}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) {
                      return null;
                    }

                    const row = payload[0]?.payload as RetailPostSaleReasonsChartRow;
                    return (
                      <RetailChartTooltip
                        label={String(label)}
                        rows={[
                          {
                            label: "Operaciones",
                            value: formatRetailReportingCount(row.operationsCount),
                          },
                          {
                            label: "Monto comercial",
                            value: formatRetailReportingCurrency(row.totalAmountCents),
                          },
                        ]}
                      />
                    );
                  }}
                />
                <Bar
                  dataKey={mode === "operations" ? "operationsCount" : "totalAmountCents"}
                  name={mode === "operations" ? "Operaciones" : "Monto comercial"}
                  fill={mode === "operations" ? "var(--primary)" : "var(--danger)"}
                  radius={[0, 6, 6, 0]}
                  isAnimationActive={false}
                  onClick={(data) => {
                    const href = (data?.payload as RetailPostSaleReasonsChartRow | undefined)?.href;
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
