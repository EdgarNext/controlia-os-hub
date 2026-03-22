"use client";

import { useSyncExternalStore } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import type { PosProductsChartPoint } from "@/types/pos-reports";

type PosProductsRevenueChartProps = {
  data: PosProductsChartPoint[];
};

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function subscribe() {
  return () => {};
}

function truncateLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

export function PosProductsRevenueChart({ data }: PosProductsRevenueChartProps) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Top productos por ingreso</h2>
        <p className="text-sm text-muted">
          Ranking del periodo para ubicar rapidamente donde se concentra la venta.
        </p>
      </div>

      {!isClient ? (
        <div className="h-96 w-full animate-pulse rounded-[var(--radius-base)] bg-surface-2" />
      ) : (
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...data].reverse()} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" horizontal={false} />
              <XAxis
                type="number"
                stroke="var(--muted)"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => currencyFormatter.format(value / 100)}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={140}
                stroke="var(--muted)"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: string) => truncateLabel(value)}
              />
              <Tooltip
                formatter={(value: number | string | undefined, name: string | undefined) => {
                  const numericValue =
                    typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;

                  if (name === "gross_cents") {
                    return [currencyFormatter.format(numericValue / 100), "Ventas"];
                  }

                  return [numericValue, "Unidades"];
                }}
                labelFormatter={(label) => `Producto: ${label}`}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-base)",
                  color: "var(--foreground)",
                }}
              />
              <Bar dataKey="gross_cents" fill="var(--primary)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
