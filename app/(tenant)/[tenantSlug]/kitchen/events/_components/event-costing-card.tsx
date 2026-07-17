import Link from "next/link";
import {
  CalendarDays,
  CookingPot,
  MoreHorizontal,
  NotebookPen,
  TrendingUp,
  Users,
} from "lucide-react";
import type { ChefEventOverviewRow } from "@/lib/kitchen/event-catering/chef-costing";
import { EventCateringBadge } from "../_components/event-catering-badge";
import { EventCostingPrimaryAction } from "./event-costing-primary-action";

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCostLabel(row: ChefEventOverviewRow["initialCostDisplay"]): string {
  if (row.kind === "money") {
    return formatMoney(row.value);
  }
  return row.label;
}

function resolveStageLabel(row: ChefEventOverviewRow): string {
  if (row.costingStatus === "sin_servicios") return "Sin servicios";
  if (row.costingStatus === "sin_recetas" || row.costingStatus === "configuracion_incompleta") {
    return "Faltan recetas";
  }
  if (row.costingStatus === "pendiente_costeo") {
    return row.hasInitialPreview ? "Configuración lista" : "Pendiente de calcular";
  }
  if (row.configurationChanged) return "Configuración anterior";
  if (row.costingStatus === "hay_precios_nuevos") return "Hay precios nuevos";
  if (row.costingStatus === "costo_actualizado") return "Costo actualizado";
  return "Costo inicial vigente";
}

function resolvePrimaryCostMetric(row: ChefEventOverviewRow): {
  label: string;
  value: string;
  detail: string | null;
} {
  if (row.initialCostDisplay.semantic === "historical") {
    return {
      label: "Último costo guardado",
      value: formatCostLabel(row.initialCostDisplay),
      detail: "Configuración anterior",
    };
  }

  if (row.currentCostDisplay.kind === "money") {
    return {
      label: "Costo vigente",
      value: formatCostLabel(row.currentCostDisplay),
      detail: row.currentCostDisplay.detail,
    };
  }

  return {
    label: "Último costo guardado",
    value: formatCostLabel(row.initialCostDisplay),
    detail: row.initialCostDisplay.detail,
  };
}

function resolveTone(
  priority: ChefEventOverviewRow["priority"],
  label: string,
): "default" | "warning" | "success" | "info" | "danger" {
  if (label === "Precios por revisar") return "danger";
  if (label === "Configuración modificada" || label === "Configuración incompleta") return "info";
  if (priority === "action_required" || priority === "attention") return "warning";
  return "success";
}

function formatDateTime(value: string | null): string {
  if (!value) return "Sin costeo guardado";
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  });
}

function resolveCostBlock(row: ChefEventOverviewRow): {
  eyebrow: string;
  value: string;
  supporting: string | null;
} {
  if (row.costingStatus === "pendiente_costeo" && row.hasInitialPreview && row.previewCostTotal != null) {
    return {
      eyebrow: "Vista previa actual",
      value: formatMoney(row.previewCostTotal),
      supporting: "Lista para guardarse como costo inicial.",
    };
  }

  const primaryCostMetric = resolvePrimaryCostMetric(row);
  const perPerson =
    row.currentCostPerPerson != null
      ? `${formatMoney(row.currentCostPerPerson)} por persona`
      : row.initialCostPerPerson != null
        ? `${formatMoney(row.initialCostPerPerson)} por persona`
        : null;
  return {
    eyebrow: primaryCostMetric.label,
    value: primaryCostMetric.value,
    supporting:
      perPerson ??
      primaryCostMetric.detail ??
      null,
  };
}

function resolveCardTone(priority: ChefEventOverviewRow["priority"]) {
  if (priority === "action_required") return "border-warning/40";
  if (priority === "attention") return "border-primary/40";
  return "border-success/30";
}

export function EventCostingCard({
  tenantSlug,
  row,
}: {
  tenantSlug: string;
  row: ChefEventOverviewRow;
}) {
  const costBlock = resolveCostBlock(row);
  const variationText =
    row.priceVariationAmount != null && row.priceVariationPercent != null
      ? `Variación por precio: ${row.priceVariationAmount >= 0 ? "+" : ""}${formatMoney(row.priceVariationAmount)} · ${row.priceVariationPercent >= 0 ? "+" : ""}${row.priceVariationPercent.toLocaleString("es-MX", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}%`
      : row.priceVariationAmount != null
        ? `Variación por precio: ${row.priceVariationAmount >= 0 ? "+" : ""}${formatMoney(row.priceVariationAmount)}`
        : null;

  return (
    <article className={`rounded-[var(--radius-base)] border bg-surface p-4 ${resolveCardTone(row.priority)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">{row.event.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {row.dateContext.relativeLabel ? `${row.dateContext.relativeLabel} · ` : ""}
              {row.dateContext.weekdayLabel ? `${row.dateContext.weekdayLabel} · ` : ""}
              {row.dateContext.formattedDate}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" aria-hidden="true" />
              {row.event.expected_attendance != null
                ? `${Number(row.event.expected_attendance).toLocaleString("es-MX")} personas`
                : "Sin personas definidas"}
            </span>
          </div>
        </div>
        <EventCateringBadge label={row.costingLabel} tone={resolveTone(row.priority, row.costingLabel)} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5">
          <CookingPot className="h-4 w-4" aria-hidden="true" />
          {row.servicesCount.toLocaleString("es-MX")} servicios
        </span>
        <span className="inline-flex items-center gap-1.5">
          <NotebookPen className="h-4 w-4" aria-hidden="true" />
          {row.recipesCount.toLocaleString("es-MX")} recetas
        </span>
        <span>{resolveStageLabel(row)}</span>
      </div>

      <div className="mt-4 rounded-[var(--radius-base)] bg-surface-2 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">{costBlock.eyebrow}</p>
        <p className="mt-1 text-3xl font-semibold text-foreground">{costBlock.value}</p>
        {costBlock.supporting ? <p className="mt-1 text-sm text-muted">{costBlock.supporting}</p> : null}
        <p className="mt-2 text-sm text-muted">Actualizado {formatDateTime(row.lastCostedAt)}</p>
        {variationText ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            {variationText}
          </p>
        ) : null}
      </div>

      {row.nextStepMessage || row.costingMessage ? (
        <p className="mt-3 text-sm text-muted">{row.nextStepMessage ?? row.costingMessage}</p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <EventCostingPrimaryAction action={row.primaryAction} />
        <details className="relative">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 text-muted">
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Más acciones</span>
          </summary>
          <div className="absolute right-0 top-12 z-10 min-w-44 rounded-[var(--radius-base)] border border-border bg-surface p-1 shadow-sm">
            {row.primaryAction.href !== `/${tenantSlug}/kitchen/events/${row.event.id}/catering` ? (
              <Link
                href={`/${tenantSlug}/kitchen/events/${row.event.id}/catering`}
                className="block rounded-[var(--radius-base)] px-3 py-2 text-sm text-foreground hover:bg-surface-2"
              >
                Ver costeo
              </Link>
            ) : null}
            {row.secondaryAction ? (
              <Link
                href={row.secondaryAction.href}
                className="block rounded-[var(--radius-base)] px-3 py-2 text-sm text-foreground hover:bg-surface-2"
              >
                {row.secondaryAction.label}
              </Link>
            ) : null}
          </div>
        </details>
      </div>
    </article>
  );
}
