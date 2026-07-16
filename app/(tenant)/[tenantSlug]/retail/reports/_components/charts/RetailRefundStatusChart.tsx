"use client";

import { useRouter } from "next/navigation";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  formatRetailReportingCount,
  formatRetailReportingCurrency,
  formatRetailReportingPercent,
} from "@/lib/retail-pos/reporting-formatters";
import { RetailChartCard } from "./RetailChartCard";
import { RetailChartTooltip } from "./RetailChartTooltip";
import { RetailEmptyChartState } from "./RetailEmptyChartState";
import { RetailChartViewport } from "./RetailChartViewport";

type RetailRefundStatusChartDatum = {
  key: "completed" | "pending" | "failed";
  label: string;
  refundsCount: number;
  amountCents: number;
  share: number | null;
  href?: string;
};

type RetailRefundStatusChartProps = {
  data: RetailRefundStatusChartDatum[];
};

function getSegmentColor(key: RetailRefundStatusChartDatum["key"]) {
  switch (key) {
    case "pending":
      return "var(--warning)";
    case "failed":
      return "var(--danger)";
    case "completed":
    default:
      return "var(--success)";
  }
}

export function RetailRefundStatusChart({ data }: RetailRefundStatusChartProps) {
  const router = useRouter();
  const totalCents = data.reduce((sum, row) => sum + row.amountCents, 0);

  return (
    <RetailChartCard
      title="Reembolsos por estado"
      description="Distingue qué parte de los reembolsos ya fue completada y qué parte continúa pendiente."
      footer={
        <div className="space-y-2">
          {data.map((row) => (
            <div key={row.key} className="flex items-start justify-between gap-3 text-xs">
              <div>
                <p className="font-medium text-foreground">{row.label}</p>
                <p className="text-muted">
                  {formatRetailReportingCurrency(row.amountCents)} · {formatRetailReportingCount(row.refundsCount)}
                  {row.share !== null ? ` · ${formatRetailReportingPercent(row.share)}` : ""}
                </p>
              </div>
              {row.href ? (
                <button type="button" onClick={() => router.push(row.href!)} className="text-primary hover:opacity-90">
                  Filtrar
                </button>
              ) : null}
            </div>
          ))}
        </div>
      }
    >
      {data.length === 0 || totalCents === 0 ? (
        <RetailEmptyChartState message="No se registraron reembolsos en este periodo." />
      ) : (
        <RetailChartViewport heightClassName="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart accessibilityLayer>
              <Pie
                data={data}
                dataKey="amountCents"
                nameKey="label"
                innerRadius={50}
                outerRadius={78}
                paddingAngle={2}
                onClick={(_, index) => {
                  const href = data[index]?.href;
                  if (href) {
                    router.push(href);
                  }
                }}
                isAnimationActive={false}
              >
                {data.map((row) => (
                  <Cell
                    key={row.key}
                    fill={getSegmentColor(row.key)}
                    style={{ cursor: row.href ? "pointer" : "default" }}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) {
                    return null;
                  }

                  const row = payload[0]?.payload as RetailRefundStatusChartDatum;
                  return (
                    <RetailChartTooltip
                      label={row.label}
                      rows={[
                        {
                          label: "Monto",
                          value: formatRetailReportingCurrency(row.amountCents),
                        },
                        {
                          label: "Cantidad",
                          value: formatRetailReportingCount(row.refundsCount),
                        },
                        {
                          label: "Participación",
                          value: row.share === null ? "Sin porcentaje" : formatRetailReportingPercent(row.share),
                        },
                      ]}
                    />
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </RetailChartViewport>
      )}
    </RetailChartCard>
  );
}
