"use client";

import { useSyncExternalStore } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";

type PosReportsSalesChartPoint = {
  date: string;
  label: string;
  gross_cents: number;
  orders_count: number;
};

type PosReportsSalesChartProps = {
  data: PosReportsSalesChartPoint[];
};

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function subscribe() {
  return () => {};
}

export function PosReportsSalesChart({ data }: PosReportsSalesChartProps) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Tendencia diaria</h2>
        <p className="text-sm text-muted">Evolucion de ventas en el rango seleccionado.</p>
      </div>

      {!isClient ? (
        <div className="h-72 w-full animate-pulse rounded-[var(--radius-base)] bg-surface-2" />
      ) : (
        <div className="h-72 w-full">
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
                formatter={(value: number | string | undefined, name: string | undefined) => {
                  const numericValue =
                    typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;

                  return name === "gross_cents"
                    ? [currencyFormatter.format(numericValue / 100), "Ventas"]
                    : [numericValue, "Tickets"];
                }}
                labelFormatter={(label) => `Fecha: ${label}`}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-base)",
                  color: "var(--foreground)",
                }}
              />
              <Line
                type="monotone"
                dataKey="gross_cents"
                name="gross_cents"
                stroke="var(--primary)"
                strokeWidth={3}
                dot={{ r: 3, strokeWidth: 0, fill: "var(--primary)" }}
                activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
