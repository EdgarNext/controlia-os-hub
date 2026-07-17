import { EventCateringBadge } from "@/app/(tenant)/[tenantSlug]/kitchen/events/_components/event-catering-badge";

export function resolveCostingTone(
  label: string,
): "default" | "warning" | "success" | "info" | "danger" {
  if (label === "Costo inicial vigente" || label === "Costo actualizado") return "success";
  if (label === "Hay precios nuevos disponibles") return "warning";
  if (label === "Algunos precios necesitan revisión") return "danger";
  if (label === "Configuración modificada") return "info";
  return "warning";
}

export function CostingStatus({ label }: { label: string }) {
  return <EventCateringBadge label={label} tone={resolveCostingTone(label)} />;
}
