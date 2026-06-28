"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SimplePosReportsFilters, SimplePosReportsPreset, SimplePosReportsView } from "@/types/simple-pos-reports";

type SimplePosReportsFiltersProps = {
  filters: SimplePosReportsFilters;
  view: SimplePosReportsView;
};

const presetOptions: Array<{ value: SimplePosReportsPreset; label: string }> = [
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "last7", label: "7 dias" },
  { value: "last30", label: "30 dias" },
  { value: "custom", label: "Personalizado" },
];

export function SimplePosReportsFilters({ filters, view }: SimplePosReportsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [preset, setPreset] = useState<SimplePosReportsPreset>(filters.preset);
  const [dateFrom, setDateFrom] = useState(filters.date_from);
  const [dateTo, setDateTo] = useState(filters.date_to);

  const navigate = (nextPreset: SimplePosReportsPreset, nextDateFrom: string, nextDateTo: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("view", view);
    nextParams.set("preset", nextPreset);
    nextParams.delete("page");
    nextParams.delete("orderId");

    if (nextPreset === "custom") {
      nextParams.set("date_from", nextDateFrom);
      nextParams.set("date_to", nextDateTo);
    } else {
      nextParams.delete("date_from");
      nextParams.delete("date_to");
    }

    const query = nextParams.toString();
    const href = query ? `${pathname}?${query}` : pathname;

    startTransition(() => {
      router.replace(href);
    });
  };

  const resetFilters = () => {
    setPreset("last7");
    navigate("last7", filters.date_from, filters.date_to);
  };

  return (
    <div className="rounded-[var(--radius-base)] border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {presetOptions.map((option) => {
            const isActive = option.value === preset;

            return (
              <button
                key={option.value}
                type="button"
                disabled={isPending}
                onClick={() => setPreset(option.value)}
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

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-1">
            <Label htmlFor="simple-pos-date-from">Desde</Label>
            <Input
              id="simple-pos-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              disabled={isPending || preset !== "custom"}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="simple-pos-date-to">Hasta</Label>
            <Input
              id="simple-pos-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              disabled={isPending || preset !== "custom"}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => navigate(preset, dateFrom, dateTo)}
              isLoading={isPending}
            >
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
