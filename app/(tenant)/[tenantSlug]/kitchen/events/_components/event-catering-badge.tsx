type EventCateringBadgeTone =
  | "default"
  | "muted"
  | "warning"
  | "success"
  | "info"
  | "danger";

const toneClasses: Record<EventCateringBadgeTone, string> = {
  default: "text-foreground",
  muted: "text-muted",
  warning: "text-warning",
  success: "text-success",
  info: "text-primary",
  danger: "text-danger",
};

export function EventCateringBadge({
  label,
  tone = "default",
}: {
  label: ReactNode;
  tone?: EventCateringBadgeTone;
}) {
  return (
    <span className={`inline-flex rounded-full border border-border px-2 py-0.5 text-xs ${toneClasses[tone]}`}>
      {label}
    </span>
  );
}
import type { ReactNode } from "react";
