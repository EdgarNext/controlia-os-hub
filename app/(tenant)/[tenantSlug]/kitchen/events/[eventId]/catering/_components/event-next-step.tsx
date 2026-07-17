import Link from "next/link";
import { ArrowRight, CircleAlert } from "lucide-react";
import type { ChefEventPrimaryAction } from "@/lib/kitchen/event-catering/chef-costing";

export function EventNextStep({
  message,
  action,
}: {
  message: string;
  action: ChefEventPrimaryAction;
}) {
  return (
    <section className="rounded-[var(--radius-base)] border border-primary/40 bg-primary/10 p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-surface">
          <CircleAlert className="h-5 w-5 text-primary" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Siguiente paso</p>
          <p className="mt-2 text-base font-semibold text-foreground">{message}</p>
          <Link
            href={action.href}
            className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-base)] border border-border bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {action.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
