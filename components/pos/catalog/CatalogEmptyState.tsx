export function CatalogEmptyState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-[var(--radius-base)] border border-border bg-surface p-6 text-sm text-muted">
      {message}
    </div>
  );
}
