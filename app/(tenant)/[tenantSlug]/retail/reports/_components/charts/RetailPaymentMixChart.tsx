"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import type { RetailPaymentMixDatum } from "@/lib/retail-pos/reporting-overview";
import {
  formatRetailReportingCurrency,
  formatRetailReportingPercent,
} from "@/lib/retail-pos/reporting-formatters";
import { RetailChartTooltip } from "./RetailChartTooltip";
import { RetailEmptyChartState } from "./RetailEmptyChartState";

type RetailPaymentMixChartDatum = RetailPaymentMixDatum & {
  href?: string;
};

type RetailPaymentMixChartProps = {
  data: RetailPaymentMixChartDatum[];
};

function subscribe() {
  return () => {};
}

export function RetailPaymentMixChart({ data }: RetailPaymentMixChartProps) {
  const router = useRouter();
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  const totalCents = data.reduce((sum, row) => sum + row.amountCents, 0);

  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Mezcla de cobro</h2>
        <p className="text-xs text-muted">
          Proporción de la venta cobrada recibida en efectivo y con tarjeta dentro del rango seleccionado.
        </p>
      </div>

      {totalCents === 0 ? (
        <RetailEmptyChartState message="No hay cobros registrados para construir la mezcla en este periodo." />
      ) : !isClient ? (
        <div className="h-[240px] w-full animate-pulse rounded-[var(--radius-base)] bg-surface-2" aria-hidden="true" />
      ) : (
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart accessibilityLayer>
              <Pie
                data={data}
                dataKey="amountCents"
                nameKey="label"
                innerRadius={58}
                outerRadius={86}
                paddingAngle={2}
                onClick={(_, index) => {
                  const href = data[index]?.href;
                  if (href) {
                    router.push(href);
                  }
                }}
                isAnimationActive={false}
              >
                {data.map((row, index) => (
                  <Cell
                    key={row.method}
                    fill={index === 0 ? "var(--primary)" : "var(--success)"}
                    style={{ cursor: row.href ? "pointer" : "default" }}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) {
                    return null;
                  }

                  const row = payload[0]?.payload as RetailPaymentMixChartDatum;
                  return (
                    <RetailChartTooltip
                      label={row.label}
                      rows={[
                        {
                          label: "Monto",
                          value: formatRetailReportingCurrency(row.amountCents),
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
        </div>
      )}

      <div className="border-t border-border pt-3">
        <div className="space-y-2">
          {data.map((row) => (
            <div key={row.method} className="flex items-start justify-between gap-3 text-xs">
              <div>
                <p className="font-medium text-foreground">{row.label}</p>
                <p className="text-muted">
                  {formatRetailReportingCurrency(row.amountCents)}
                  {row.share !== null ? ` · ${formatRetailReportingPercent(row.share)}` : ""}
                </p>
              </div>
              {row.href ? (
                <button
                  type="button"
                  onClick={() => router.push(row.href!)}
                  className="text-primary hover:opacity-90"
                >
                  Ver detalle
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
