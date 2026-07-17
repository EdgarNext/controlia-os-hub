import Link from "next/link";
import type { ChefEventPrimaryAction } from "@/lib/kitchen/event-catering/chef-costing";

export function EventCostingPrimaryAction({ action }: { action: ChefEventPrimaryAction }) {
  return (
    <Link
      href={action.href}
      className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
    >
      {action.label}
    </Link>
  );
}
