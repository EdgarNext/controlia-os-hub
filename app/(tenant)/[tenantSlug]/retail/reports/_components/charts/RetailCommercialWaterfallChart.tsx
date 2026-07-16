"use client";

import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RetailCommercialWaterfallDatum } from "@/lib/retail-pos/reporting-overview";
import { formatRetailReportingCurrency } from "@/lib/retail-pos/reporting-formatters";
import { RetailChartCard } from "./RetailChartCard";
import { RetailChartTooltip } from "./RetailChartTooltip";
import { RetailChartViewport } from "./RetailChartViewport";

type RetailCommercialWaterfallChartDatum = RetailCommercialWaterfallDatum & {
  href?: string;
};

type RetailCommercialWaterfallChartProps = {
  data: RetailCommercialWaterfallChartDatum[];
};

type WaterfallBarRow = RetailCommercialWaterfallChartDatum & {
  baseCents: number;
  valueCents: number;
};

function buildWaterfallRows(data: RetailCommercialWaterfallChartDatum[]): WaterfallBarRow[] {
  let runningTotal = 0;

  return data.map((item) => {
    if (item.kind === "decrease") {
      const nextTotal = runningTotal - item.amountCents;
      const row = {
        ...item,
        baseCents: nextTotal,
        valueCents: item.amountCents,
      };
      runningTotal = nextTotal;
      return row;
    }

    runningTotal = item.amountCents;
    return {
      ...item,
      baseCents: 0,
      valueCents: item.amountCents,
    };
  });
}

function getBarFill(kind: RetailCommercialWaterfallDatum["kind"], key: RetailCommercialWaterfallDatum["key"]) {
  if (kind === "decrease") {
    return key === "discounts" ? "var(--warning)" : "var(--danger)";
  }

  if (key === "commercial_result") {
    return "var(--success)";
  }

  return "var(--primary)";
}

export function RetailCommercialWaterfallChart({ data }: RetailCommercialWaterfallChartProps) {
  const router = useRouter();
  const rows = buildWaterfallRows(data);

  return (
    <RetailChartCard
      title="Construcción del resultado comercial"
      description="Cómo la venta bruta se convierte en venta cobrada y después en resultado comercial del periodo, sin restar reembolsos pendientes."
      footer={
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Lectura textual</p>
          <ul className="space-y-1 text-xs text-muted">
            {data.map((item) => (
              <li key={item.key}>
                {item.label}: {formatRetailReportingCurrency(item.amountCents)}
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <RetailChartViewport heightClassName="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart accessibilityLayer data={rows} margin={{ left: 8, right: 8, top: 12, bottom: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="var(--muted)"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                stroke="var(--muted)"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => formatRetailReportingCurrency(value)}
                width={108}
              />
              <Tooltip
                cursor={{ fill: "rgb(from var(--foreground) r g b / 0.04)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) {
                    return null;
                  }

                  const row = payload[0]?.payload as WaterfallBarRow;
                  return (
                    <RetailChartTooltip
                      label={row.label}
                      rows={[
                        {
                          label: row.kind === "decrease" ? "Ajuste aplicado" : "Monto visible",
                          value: formatRetailReportingCurrency(row.amountCents),
                        },
                        {
                          label: row.kind === "decrease" ? "Impacto en el resultado" : "Nivel alcanzado",
                          value:
                            row.kind === "decrease"
                              ? `-${formatRetailReportingCurrency(row.amountCents)}`
                              : formatRetailReportingCurrency(row.amountCents),
                        },
                      ]}
                    />
                  );
                }}
              />
              <Bar dataKey="baseCents" stackId="waterfall" fill="transparent" isAnimationActive={false} />
              <Bar
                dataKey="valueCents"
                stackId="waterfall"
                radius={[8, 8, 0, 0]}
                isAnimationActive={false}
                onClick={(_, index) => {
                  const href = rows[index]?.href;
                  if (href) {
                    router.push(href);
                  }
                }}
              >
                {rows.map((row) => (
                  <Cell
                    key={row.key}
                    fill={getBarFill(row.kind, row.key)}
                    style={{ cursor: row.href ? "pointer" : "default" }}
                  />
                ))}
              </Bar>
          </BarChart>
        </ResponsiveContainer>
      </RetailChartViewport>
    </RetailChartCard>
  );
}
