import type { ChefEventOverviewRow } from "@/lib/kitchen/event-catering/chef-costing";
import { EventCostingCard } from "./event-costing-card";

type EventCostingListProps = {
  tenantSlug: string;
  title: string;
  description: string;
  rows: ChefEventOverviewRow[];
};

export function EventCostingList({
  tenantSlug,
  title,
  description,
  rows,
}: EventCostingListProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          {title} · {rows.length.toLocaleString("es-MX")}
        </h2>
        <p className="text-sm text-muted">{description}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {rows.map((row) => (
          <EventCostingCard key={row.event.id} tenantSlug={tenantSlug} row={row} />
        ))}
      </div>
    </section>
  );
}
