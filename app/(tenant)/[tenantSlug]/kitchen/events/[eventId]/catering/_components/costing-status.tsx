import { EventCateringBadge } from "@/app/(tenant)/[tenantSlug]/kitchen/events/_components/event-catering-badge";
import type { ChefCostingStatus } from "@/lib/kitchen/event-catering/costing-status";
import { getChefCostingStatusPresentation } from "@/lib/kitchen/event-catering/costing-status";

export function resolveCostingTone(
  label: string,
): "default" | "warning" | "success" | "info" | "danger" {
  if (label === "Costo inicial vigente" || label === "Costo actualizado") return "success";
  if (label === "Hay precios nuevos") return "warning";
  if (label === "Precios por revisar") return "danger";
  if (label === "Configuración modificada") return "info";
  return "warning";
}

export function CostingStatus({ label }: { label: string }) {
  return <EventCateringBadge label={label} tone={resolveCostingTone(label)} />;
}

export function costingStatusLabel(status: ChefCostingStatus): string {
  return getChefCostingStatusPresentation(status).label;
}
