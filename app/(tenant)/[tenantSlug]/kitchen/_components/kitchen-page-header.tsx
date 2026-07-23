import type { ReactNode } from "react";

type KitchenPageHeaderProps = {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  metadata?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
};

export function KitchenPageHeader({
  title,
  description,
  eyebrow,
  metadata,
  actions,
  icon,
}: KitchenPageHeaderProps) {
  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      {eyebrow ? <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">{eyebrow}</p> : null}
      <div className="mt-1 flex items-center gap-2 text-foreground">{icon ? <span className="text-primary">{icon}</span> : null}<h1 className="text-lg font-semibold">{title}</h1></div>
      {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
      {metadata ? <div className="mt-2 text-xs text-muted">{metadata}</div> : null}
      {actions ? <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}
