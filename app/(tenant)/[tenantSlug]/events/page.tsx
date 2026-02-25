import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays } from "lucide-react";
import { PageFrame } from "@/components/layout/PageFrame";
import { EventsListSection } from "./components/EventsListSection";
import { EventsStatusFilter } from "./components/EventsStatusFilter";

type StatusFilter = "all" | "draft" | "published";

function normalizeStatusFilter(rawStatus: string | undefined): StatusFilter {
  if (rawStatus === "draft" || rawStatus === "published") {
    return rawStatus;
  }

  return "all";
}

function EventsListFallback() {
  return (
    <div className="space-y-2">
      <div className="h-16 rounded-[var(--radius-base)] border border-border bg-surface-2" />
      <div className="h-16 rounded-[var(--radius-base)] border border-border bg-surface-2" />
      <div className="h-16 rounded-[var(--radius-base)] border border-border bg-surface-2" />
    </div>
  );
}

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { tenantSlug } = await params;
  const { status } = await searchParams;
  const statusFilter = normalizeStatusFilter(status);

  return (
    <PageFrame>
      <div className="space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
              <h1 className="text-xl font-semibold">Events</h1>
            </div>
            <p className="text-sm text-muted">Manage event drafts and lifecycle for this tenant.</p>
          </div>

          <Link
            href={`/${tenantSlug}/events/new`}
            className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
          >
            Create event
          </Link>
        </header>

        <EventsStatusFilter selected={statusFilter} />

        <Suspense key={statusFilter} fallback={<EventsListFallback />}>
          <EventsListSection tenantSlug={tenantSlug} statusFilter={statusFilter} />
        </Suspense>
      </div>
    </PageFrame>
  );
}
