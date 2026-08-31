import { Skeleton } from "@/components/ui/skeleton";

function SkeletonBlock({ className }: { className: string }) {
  return <Skeleton shimmer className={className} aria-hidden="true" />;
}

export function KitchenCatalogFiltersSkeleton({ supplier = false }: { supplier?: boolean }) {
  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface px-3 py-3" aria-hidden="true">
      <div className="flex flex-wrap items-end gap-2">
        <SkeletonBlock className="h-10 min-w-[min(100%,18rem)] flex-1" />
        <SkeletonBlock className="h-10 w-36" />
        {supplier ? null : <SkeletonBlock className="h-10 w-44" />}
        {supplier ? null : <SkeletonBlock className="h-10 w-32" />}
        {supplier ? null : <SkeletonBlock className="h-10 w-24" />}
      </div>
    </section>
  );
}

export function KitchenCatalogContentSkeleton({ supplier = false }: { supplier?: boolean }) {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenCatalogFiltersSkeleton supplier={supplier} />
      <KitchenCardGridSkeleton cards={4} />
      <KitchenTableSkeleton rows={8} columns={supplier ? 7 : 7} />
    </div>
  );
}

export function KitchenRecipesContentSkeleton() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4" aria-hidden="true">
        <div className="flex flex-wrap items-end gap-3">
          <SkeletonBlock className="h-10 min-w-[260px] flex-1" />
          <SkeletonBlock className="h-10 w-56" />
          <SkeletonBlock className="h-10 w-56" />
          <SkeletonBlock className="h-10 w-36" />
        </div>
      </section>
      <KitchenTableSkeleton rows={8} columns={8} />
      <KitchenActionRowSkeleton actions={1} />
    </div>
  );
}

export function KitchenEventsContentSkeleton() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <p className="sr-only" role="status">Cargando eventos y costeo…</p>
      <KitchenCardGridSkeleton cards={4} />
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4" aria-hidden="true">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_240px_180px_auto]">
          <SkeletonBlock className="h-11 w-full" />
          <SkeletonBlock className="h-11 w-full" />
          <SkeletonBlock className="h-11 w-full" />
          <SkeletonBlock className="h-11 w-full" />
        </div>
      </section>
      <section className="space-y-3" aria-hidden="true">
        <div>
          <SkeletonBlock className="h-5 w-56" />
          <SkeletonBlock className="mt-2 h-4 w-full max-w-lg" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <article key={index} className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <SkeletonBlock className="h-5 w-44" />
                  <SkeletonBlock className="h-4 w-52" />
                </div>
                <SkeletonBlock className="h-6 w-28" />
              </div>
              <SkeletonBlock className="mt-3 h-4 w-40" />
              <SkeletonBlock className="mt-4 h-20 w-full" />
              <div className="mt-4 flex items-center justify-between gap-3">
                <SkeletonBlock className="h-10 w-36" />
                <SkeletonBlock className="h-10 w-10" />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function KitchenInventoryPriceUpdatesSkeleton() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4" aria-hidden="true">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SkeletonBlock className="h-11 w-full" />
          <SkeletonBlock className="h-11 w-full" />
          <SkeletonBlock className="h-11 w-full" />
          <SkeletonBlock className="h-11 w-full" />
        </div>
      </section>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4" aria-hidden="true">
          <SkeletonBlock className="h-5 w-44" />
          <SkeletonBlock className="mt-2 h-4 w-full max-w-xl" />
          <SkeletonBlock className="mt-4 h-11 w-full" />
          <div className="mt-4 overflow-hidden rounded-[var(--radius-base)] border border-border">
            <div className="grid grid-cols-5 gap-3 border-b border-border bg-surface-2 px-3 py-2">
              {Array.from({ length: 5 }).map((_, index) => <SkeletonBlock key={index} className="h-4 w-full" />)}
            </div>
            {Array.from({ length: 4 }).map((_, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-5 gap-3 border-t border-border px-3 py-4">
                {Array.from({ length: 5 }).map((__, cellIndex) => (
                  <SkeletonBlock key={cellIndex} className="h-4 w-full" />
                ))}
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4" aria-hidden="true">
          <SkeletonBlock className="h-5 w-36" />
          <SkeletonBlock className="mt-2 h-4 w-56" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4">
                <SkeletonBlock className="h-5 w-44" />
                <SkeletonBlock className="mt-3 h-11 w-full" />
                <SkeletonBlock className="mt-4 h-24 w-full" />
                <SkeletonBlock className="mt-4 h-11 w-full" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function KitchenReportsContentSkeleton() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4" aria-hidden="true">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="rounded-[var(--radius-base)] border border-border bg-surface p-3">
              <SkeletonBlock className="h-3 w-32" />
              <SkeletonBlock className="mt-3 h-7 w-24" />
            </div>
          ))}
        </div>
        <SkeletonBlock className="mt-3 h-16 w-full" />
      </section>
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4" aria-hidden="true">
        <SkeletonBlock className="h-5 w-48" />
        <SkeletonBlock className="mt-2 h-4 w-full max-w-2xl" />
        <div className="mt-3 overflow-hidden rounded-[var(--radius-base)] border border-border">
          <div className="grid grid-cols-7 gap-3 border-b border-border bg-surface-2 px-3 py-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-3 w-full" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-7 gap-3 border-t border-border px-3 py-4">
              {Array.from({ length: 7 }).map((__, cellIndex) => (
                <SkeletonBlock key={cellIndex} className="h-3 w-full" />
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function KitchenHeaderSkeleton() {
  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <SkeletonBlock className="h-6 w-56" />
      <SkeletonBlock className="mt-3 h-4 w-full max-w-2xl" />
      <SkeletonBlock className="mt-2 h-4 w-3/4 max-w-xl" />
    </section>
  );
}

export function KitchenCardGridSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: cards }).map((_, index) => (
        <article key={index} className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="mt-3 h-7 w-20" />
        </article>
      ))}
    </section>
  );
}

export function KitchenActionRowSkeleton({ actions = 3 }: { actions?: number }) {
  return (
    <section className="flex flex-wrap gap-2">
      {Array.from({ length: actions }).map((_, index) => (
        <SkeletonBlock key={index} className="h-9 w-36" />
      ))}
    </section>
  );
}

export function KitchenTableSkeleton({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <SkeletonBlock className="h-4 w-48" />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-border">
              {Array.from({ length: columns }).map((_, index) => (
                <th key={index} className="px-2 py-2 text-left">
                  <SkeletonBlock className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border/70">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={`${rowIndex}-${colIndex}`} className="px-2 py-3">
                    <SkeletonBlock className="h-3 w-full max-w-[140px]" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function KitchenModuleLoadingShell({
  cards = 4,
  tableRows = 6,
  tableColumns = 6,
}: {
  cards?: number;
  tableRows?: number;
  tableColumns?: number;
}) {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenHeaderSkeleton />
      <KitchenCardGridSkeleton cards={cards} />
      <KitchenActionRowSkeleton />
      <KitchenTableSkeleton rows={tableRows} columns={tableColumns} />
    </div>
  );
}
