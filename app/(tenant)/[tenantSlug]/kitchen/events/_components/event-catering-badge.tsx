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
  warning: "text-amber-700",
  success: "text-emerald-700",
  info: "text-sky-700",
  danger: "text-danger",
};

export function EventCateringBadge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: EventCateringBadgeTone;
}) {
  return (
    <span className={`inline-flex rounded-full border border-border px-2 py-0.5 text-xs ${toneClasses[tone]}`}>
      {label}
    </span>
  );
}

