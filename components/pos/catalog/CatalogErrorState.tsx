export function CatalogErrorState({
  title,
  message,
  hint,
}: {
  title: string;
  message: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--radius-base)] border border-danger/40 bg-danger-soft p-6">
      <p className="text-sm font-semibold text-danger">{title}</p>
      <p className="mt-2 text-sm text-danger/90">{message}</p>
      {hint ? <p className="mt-1 text-xs text-danger/80">{hint}</p> : null}
    </div>
  );
}
