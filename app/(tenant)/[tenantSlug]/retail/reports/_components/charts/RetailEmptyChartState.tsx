type RetailEmptyChartStateProps = {
  message: string;
};

export function RetailEmptyChartState({ message }: RetailEmptyChartStateProps) {
  return (
    <div className="flex h-full min-h-56 items-center justify-center rounded-[var(--radius-base)] border border-dashed border-border bg-surface-2 px-4 py-6 text-center">
      <p className="max-w-sm text-sm text-muted">{message}</p>
    </div>
  );
}
