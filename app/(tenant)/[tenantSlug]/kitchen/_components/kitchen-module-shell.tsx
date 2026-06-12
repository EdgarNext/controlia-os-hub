import Link from "next/link";
import type { ReactNode } from "react";

type KitchenModuleShellProps = {
  tenantSlug: string;
  children: ReactNode;
};

const NAV_ITEMS = [
  { label: "Inventario", href: "inventory" },
  { label: "Insumos", href: "inventory/items" },
  { label: "Data Quality", href: "inventory/data-quality" },
  { label: "Recetas", href: "recipes" },
  { label: "Costeo", href: "recipes/costing" },
  { label: "Catering", href: "events" },
  { label: "Requisiciones", href: "events/requisitions" },
  { label: "Recepciones", href: "events/receipts" },
  { label: "Consumos", href: "events/consumption" },
] as const;

export function KitchenModuleShell({ tenantSlug, children }: KitchenModuleShellProps) {
  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Kitchen Ops</p>
        <h1 className="mt-1 text-lg font-semibold text-foreground">Cocina</h1>
        <p className="mt-2 text-sm text-muted">Inventario, recetas, costeo y operación de catering.</p>
        <nav aria-label="Navegación de cocina" className="mt-3 flex flex-wrap gap-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={`/${tenantSlug}/kitchen/${item.href}`}
              className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-surface"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </section>
      <section>{children}</section>
    </div>
  );
}
