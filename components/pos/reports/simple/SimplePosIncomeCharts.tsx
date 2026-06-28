"use client";

import { useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { SimplePosIncomeDailyPoint } from "@/types/simple-pos-reports";

type SimplePosIncomeChartsProps = {
  data: SimplePosIncomeDailyPoint[];
};

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function subscribe() {
  return () => {};
}

export function SimplePosIncomeCharts({ data }: SimplePosIncomeChartsProps) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);

  if (!isClient) {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-72 rounded-[var(--radius-base)] bg-surface-2" />
        <div className="h-72 rounded-[var(--radius-base)] bg-surface-2" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="space-y-4 p-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Ingresos por dia</h2>
          <p className="text-sm text-muted">Serie diaria basada en `report_sales_daily`.</p>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
              <XAxis dataKey="label" stroke="var(--muted)" tickLine={false} axisLine={false} />
              <YAxis
                stroke="var(--muted)"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => currencyFormatter.format(value / 100)}
              />
              <Tooltip
                formatter={(value: number | string | undefined) => {
                  const numericValue =
                    typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
                  return [currencyFormatter.format(numericValue / 100), "Ingresos"];
                }}
                labelFormatter={(label) => `Fecha: ${label}`}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-base)",
                }}
              />
              <Line
                type="monotone"
                dataKey="gross_cents"
                stroke="var(--primary)"
                strokeWidth={3}
                dot={{ r: 3, strokeWidth: 0, fill: "var(--primary)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Ordenes por dia</h2>
          <p className="text-sm text-muted">Tickets pagados agrupados por fecha local MX.</p>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
              <XAxis dataKey="label" stroke="var(--muted)" tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted)" tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value: number | string | undefined) => {
                  const numericValue =
                    typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
                  return [numericValue, "Ordenes"];
                }}
                labelFormatter={(label) => `Fecha: ${label}`}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-base)",
                }}
              />
              <Bar dataKey="orders_count" fill="var(--primary)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
