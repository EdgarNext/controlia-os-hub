type KitchenStatusBadgeProps = {
  status: string | null | undefined;
};

const STATUS_COPY: Record<string, string> = {
  draft: "Borrador",
  reviewed: "Revisada",
  approved: "Aprobada",
  canceled: "Cancelada",
  planned: "Planeado",
  confirmed: "Confirmado",
  received: "Recibido",
  active: "Activa",
  archived: "Archivada",
};

const STATUS_TONE: Record<string, string> = {
  draft: "text-muted",
  reviewed: "text-amber-700",
  approved: "text-emerald-700",
  canceled: "text-foreground",
  planned: "text-sky-700",
  confirmed: "text-emerald-700",
  received: "text-emerald-700",
  active: "text-emerald-700",
  archived: "text-foreground",
};

export function KitchenStatusBadge({ status }: KitchenStatusBadgeProps) {
  const raw = (status ?? "").toLowerCase();
  const label = STATUS_COPY[raw] ?? (status || "—");
  const tone = STATUS_TONE[raw] ?? "text-muted";

  return (
    <span className={`inline-flex rounded-full border border-border px-2 py-0.5 text-xs ${tone}`}>
      {label}
    </span>
  );
}
