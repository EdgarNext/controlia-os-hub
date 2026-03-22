"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PosReportSaleChannel, PosReportsFilters } from "@/types/pos-reports";

type PosReportsOverviewFiltersProps = {
  filters: PosReportsFilters;
  defaultFilters: PosReportsFilters;
};

const saleChannelOptions: Array<{ value: PosReportSaleChannel; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "quick-sale", label: "Venta rapida" },
  { value: "tabs", label: "Mesas" },
];

const paymentMethodOptions: Array<{ value: PosReportsFilters["payment_method"]; label: string }> = [
  { value: "all", label: "Todos los pagos" },
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "employee", label: "Empleado" },
];

export function PosReportsOverviewFilters({
  filters,
  defaultFilters,
}: PosReportsOverviewFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [dateFrom, setDateFrom] = useState(filters.date_from);
  const [dateTo, setDateTo] = useState(filters.date_to);
  const [saleChannel, setSaleChannel] = useState<PosReportSaleChannel>(filters.sale_channel);
  const [paymentMethod, setPaymentMethod] = useState<PosReportsFilters["payment_method"]>(
    filters.payment_method,
  );

  const navigateWithFilters = (nextFilters: PosReportsFilters) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("date_from", nextFilters.date_from);
    nextParams.set("date_to", nextFilters.date_to);

    if (nextFilters.sale_channel === "all") {
      nextParams.delete("sale_channel");
    } else {
      nextParams.set("sale_channel", nextFilters.sale_channel);
    }

    if (nextFilters.payment_method === "all") {
      nextParams.delete("payment_method");
    } else {
      nextParams.set("payment_method", nextFilters.payment_method);
    }

    const query = nextParams.toString();
    const href = query ? `${pathname}?${query}` : pathname;

    startTransition(() => {
      router.replace(href);
    });
  };

  const applyCurrentFilters = () => {
    navigateWithFilters({
      date_from: dateFrom,
      date_to: dateTo,
      sale_channel: saleChannel,
      payment_method: paymentMethod,
    });
  };

  const resetFilters = () => {
    setDateFrom(defaultFilters.date_from);
    setDateTo(defaultFilters.date_to);
    setSaleChannel(defaultFilters.sale_channel);
    setPaymentMethod(defaultFilters.payment_method);
    navigateWithFilters(defaultFilters);
  };

  return (
    <div className="rounded-[var(--radius-base)] border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {saleChannelOptions.map((option) => {
            const isActive = option.value === saleChannel;

            return (
              <button
                key={option.value}
                type="button"
                disabled={isPending}
                onClick={() => setSaleChannel(option.value)}
                className={[
                  "rounded-[var(--radius-base)] border px-3 py-2 text-sm transition-colors duration-200",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface-2 text-foreground hover:bg-surface",
                ].join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px_auto] md:items-end">
          <div className="space-y-1">
            <Label htmlFor="pos-reports-date-from">Desde</Label>
            <Input
              id="pos-reports-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pos-reports-date-to">Hasta</Label>
            <Input
              id="pos-reports-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pos-reports-payment-method">Metodo de pago</Label>
            <select
              id="pos-reports-payment-method"
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(event.target.value as PosReportsFilters["payment_method"])
              }
              disabled={isPending}
              className="h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {paymentMethodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={applyCurrentFilters} isLoading={isPending}>
              Aplicar filtros
            </Button>
            <Button type="button" variant="secondary" onClick={resetFilters} disabled={isPending}>
              Restablecer
            </Button>
          </div>
        </div>

        {isPending ? <p className="text-xs text-muted">Actualizando reportes...</p> : null}
      </div>
    </div>
  );
}
