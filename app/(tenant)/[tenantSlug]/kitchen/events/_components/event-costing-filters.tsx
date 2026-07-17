"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type EventCostingFiltersProps = {
  initialQuery: string;
  initialStatus: string;
  initialPeriod: "proximos" | "recientes" | "todos";
};

const statusOptions = [
  { value: "", label: "Todos los estados" },
  { value: "sin_servicios", label: "Sin servicios" },
  { value: "sin_recetas", label: "Sin recetas" },
  { value: "configuracion_incompleta", label: "Configuración incompleta" },
  { value: "pendiente_costeo", label: "Pendiente de costeo" },
  { value: "configuracion_modificada", label: "Configuración modificada" },
  { value: "precios_necesitan_revision", label: "Precios por revisar" },
  { value: "hay_precios_nuevos", label: "Hay precios nuevos" },
  { value: "costo_actualizado", label: "Costo actualizado" },
  { value: "costo_inicial_vigente", label: "Costo inicial vigente" },
] as const;

const periodOptions = [
  { value: "proximos", label: "Próximos" },
  { value: "recientes", label: "Recientes" },
  { value: "todos", label: "Todos" },
] as const;

export function EventCostingFilters({
  initialQuery,
  initialStatus,
  initialPeriod,
}: EventCostingFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const currentQueryString = searchParams.toString();

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextParams = new URLSearchParams(currentQueryString);
      const normalized = query.trim();
      if (normalized) {
        nextParams.set("q", normalized);
      } else {
        nextParams.delete("q");
      }
      const href = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
      const currentHref = currentQueryString ? `${pathname}?${currentQueryString}` : pathname;

      if (href === currentHref) {
        return;
      }

      startTransition(() => {
        router.replace(href);
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [currentQueryString, pathname, query, router]);

  const updateParam = (key: "status" | "period", value: string) => {
    const nextParams = new URLSearchParams(currentQueryString);
    if (!value || (key === "period" && value === "proximos")) {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }
    const href = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
    const currentHref = currentQueryString ? `${pathname}?${currentQueryString}` : pathname;

    if (href === currentHref) {
      return;
    }

    startTransition(() => {
      router.replace(href);
    });
  };

  const clearFilters = () => {
    if (!currentQueryString) {
      return;
    }

    startTransition(() => {
      router.replace(pathname);
    });
  };

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_220px_160px_auto]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar evento"
          className="h-11 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
        />
        <select
          value={initialStatus}
          onChange={(event) => updateParam("status", event.target.value)}
          className="h-11 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={initialPeriod}
          onChange={(event) => updateParam("period", event.target.value)}
          className="h-11 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
        >
          {periodOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={clearFilters}
          disabled={isPending}
          className="inline-flex h-11 items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
        >
          Limpiar filtros
        </button>
      </div>

      {isPending ? <p className="mt-2 text-xs text-muted">Actualizando eventos y costeo...</p> : null}
    </section>
  );
}
