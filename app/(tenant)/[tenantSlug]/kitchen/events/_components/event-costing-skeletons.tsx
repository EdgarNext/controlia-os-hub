import { Skeleton } from "@/components/ui/skeleton";

export function EventOverviewSkeleton() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
        <Skeleton className="mt-4 h-10 w-36" />
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-[var(--radius-base)] border border-border bg-surface px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        ))}
      </section>
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_240px_180px_auto]">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </section>
      <section className="space-y-3">
        <div>
          <Skeleton className="h-5 w-56" />
          <Skeleton className="mt-2 h-4 w-full max-w-lg" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-4 w-52" />
                </div>
                <Skeleton className="h-6 w-28" />
              </div>
              <Skeleton className="mt-3 h-4 w-40" />
              <Skeleton className="mt-4 h-20 w-full" />
              <div className="mt-4 flex items-center justify-between gap-3">
                <Skeleton className="h-10 w-36" />
                <Skeleton className="h-10 w-10" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function EventDetailSkeleton() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-2 h-7 w-72" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
      </section>
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <Skeleton className="h-4 w-28" />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      </section>
      <section className="rounded-[var(--radius-base)] border border-border bg-primary/10 p-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-3 h-6 w-full max-w-2xl" />
        <Skeleton className="mt-4 h-10 w-44" />
      </section>
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-4 w-56" />
              <div className="mt-3 flex gap-2">
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-7 w-24" />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="mt-4 h-24 w-full" />
      </section>
    </div>
  );
}
