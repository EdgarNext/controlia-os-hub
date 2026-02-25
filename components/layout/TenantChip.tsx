type TenantChipProps = {
  tenantSlug: string;
};

export function TenantChip({ tenantSlug }: TenantChipProps) {
  return (
    <span className="inline-flex max-w-40 items-center gap-2 truncate rounded-full border border-border bg-surface-2 px-2 py-1 text-xs text-muted">
      <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
      {tenantSlug}
    </span>
  );
}
