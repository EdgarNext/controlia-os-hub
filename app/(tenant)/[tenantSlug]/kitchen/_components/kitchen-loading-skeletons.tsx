function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[var(--radius-base)] bg-surface-2 ${className}`} aria-hidden="true" />;
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
