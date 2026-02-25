import { Badge } from "@/components/ui/badge";
import type { EventStatus } from "@/types/events";

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const variant = status === "published" ? "success" : status === "closed" ? "danger" : "warning";

  return <Badge variant={variant}>{status}</Badge>;
}
