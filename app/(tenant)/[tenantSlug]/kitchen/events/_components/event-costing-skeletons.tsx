import { Skeleton } from "@/components/ui/skeleton";

export function EventDetailSkeleton() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4" aria-hidden="true">
        <Skeleton shimmer className="h-4 w-20" />
        <Skeleton shimmer className="mt-2 h-7 w-72" />
        <Skeleton shimmer className="mt-3 h-4 w-full max-w-2xl" />
        <div className="mt-3 flex flex-wrap gap-2">
          <Skeleton shimmer className="h-4 w-32" />
          <Skeleton shimmer className="h-4 w-40" />
          <Skeleton shimmer className="h-4 w-24" />
          <Skeleton shimmer className="h-4 w-24" />
        </div>
      </section>
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4" aria-hidden="true">
        <Skeleton shimmer className="h-4 w-28" />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton shimmer key={index} className="h-24 w-full" />
          ))}
        </div>
      </section>
      <section className="rounded-[var(--radius-base)] border border-primary/40 bg-primary/10 p-4" aria-hidden="true">
        <Skeleton shimmer className="h-4 w-28" />
        <Skeleton shimmer className="mt-3 h-6 w-full max-w-2xl" />
        <Skeleton shimmer className="mt-4 h-10 w-44" />
      </section>
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4" aria-hidden="true">
        <Skeleton shimmer className="h-5 w-44" />
        <Skeleton shimmer className="mt-2 h-4 w-full max-w-xl" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4">
              <Skeleton shimmer className="h-5 w-40" />
              <Skeleton shimmer className="mt-2 h-4 w-56" />
              <div className="mt-3 flex gap-2">
                <Skeleton shimmer className="h-7 w-28" />
                <Skeleton shimmer className="h-7 w-28" />
                <Skeleton shimmer className="h-7 w-24" />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Skeleton shimmer className="h-16 w-full" />
                <Skeleton shimmer className="h-16 w-full" />
                <Skeleton shimmer className="h-16 w-full" />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4" aria-hidden="true">
        <Skeleton shimmer className="h-5 w-52" />
        <Skeleton shimmer className="mt-4 h-24 w-full" />
      </section>
    </div>
  );
}

export const EventCateringContentSkeleton = EventDetailSkeleton;
