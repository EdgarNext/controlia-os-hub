import { Skeleton } from "@/components/ui/skeleton";

export default function KitchenInventoryPriceUpdatesLoading() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-4 w-full max-w-2xl" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
      </section>

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <Skeleton className="h-4 w-36" />
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-4 w-full" />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-10 w-40" />
          </div>

          <div className="mt-4 flex gap-2">
            <Skeleton className="h-8 w-44 rounded-full" />
            <Skeleton className="h-8 w-40 rounded-full" />
            <Skeleton className="h-8 w-36 rounded-full" />
          </div>

          <Skeleton className="mt-4 h-11 w-full" />

          <div className="mt-4 overflow-hidden rounded-[var(--radius-base)] border border-border">
            <div className="grid grid-cols-5 gap-3 border-b border-border bg-surface-2 px-3 py-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </div>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="grid grid-cols-5 gap-3 border-t border-border px-3 py-4">
                {Array.from({ length: 5 }).map((__, cellIndex) => (
                  <Skeleton key={cellIndex} className="h-4 w-full" />
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-56" />
          </div>

          <div className="mt-4 space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <Skeleton className="h-9 w-24" />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-11 w-8" />
                </div>
                <div className="mt-4 h-28 rounded-[var(--radius-base)] border border-border bg-surface p-3">
                  <Skeleton className="h-4 w-24" />
                  <div className="mt-3 grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-28 w-full" />
                </div>
                <Skeleton className="mt-4 h-14 w-full" />
              </div>
            ))}
          </div>

          <Skeleton className="mt-4 h-20 w-full" />
          <Skeleton className="mt-4 h-11 w-full" />
        </section>
      </div>
    </div>
  );
}
