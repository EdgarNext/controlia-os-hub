"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatRetailReportingCurrency } from "@/lib/retail-pos/reporting-formatters";
import { getRetailPriceTierLabel } from "@/lib/retail-pos/reporting-presentation";
import { RetailChartCard } from "./RetailChartCard";
import { RetailChartTooltip } from "./RetailChartTooltip";
import { RetailChartViewport } from "./RetailChartViewport";

export function RetailSalesPriceTierChart({
  coverage,
}: {
  coverage: { publicNetSalesCents: number; wholesaleNetSalesCents: number; unknownNetSalesCents: number };
}) {
  const data = [
    { tier: getRetailPriceTierLabel("public"), amountCents: coverage.publicNetSalesCents },
    { tier: getRetailPriceTierLabel("wholesale"), amountCents: coverage.wholesaleNetSalesCents },
    { tier: getRetailPriceTierLabel("unknown"), amountCents: coverage.unknownNetSalesCents },
  ];

  return (
    <RetailChartCard title="Distribución de ventas por nivel" description="Importe neto histórico por nivel registrado en la línea vendida.">
      <RetailChartViewport heightClassName="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart accessibilityLayer data={data} margin={{ left: 8, right: 8, top: 12, bottom: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="tier" stroke="var(--muted)" tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted)" tickLine={false} axisLine={false} tickFormatter={(value: number) => formatRetailReportingCurrency(value)} width={100} />
            <Tooltip content={({ active, payload, label }) => active && payload?.length ? <RetailChartTooltip label={String(label)} rows={[{ label: "Venta neta", value: formatRetailReportingCurrency(Number(payload[0]?.value ?? 0)) }]} /> : null} />
            <Bar dataKey="amountCents" name="Venta neta" fill="var(--primary)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </RetailChartViewport>
    </RetailChartCard>
  );
}
