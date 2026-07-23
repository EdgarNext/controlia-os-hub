import Link from "next/link";

export function CatalogSectionNav({
  tenantSlug,
  activeSection,
}: {
  tenantSlug: string;
  activeSection: "items" | "providers";
}) {
  const base = `/${tenantSlug}/kitchen/catalog`;
  const providers = `${base}/providers`;
  const linkClass = (active: boolean) =>
    `inline-flex min-h-10 items-center rounded-[var(--radius-base)] border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? "border-primary bg-primary/10 text-foreground" : "border-transparent text-muted hover:border-border hover:bg-surface-2 hover:text-foreground"}`;

  return (
    <nav aria-label="Secciones del catálogo" className="rounded-[var(--radius-base)] border border-border bg-surface p-1">
      <div className="flex flex-wrap gap-1">
        <Link href={base} aria-current={activeSection === "items" ? "page" : undefined} className={linkClass(activeSection === "items")}>
          Insumos
        </Link>
        <Link href={providers} aria-current={activeSection === "providers" ? "page" : undefined} className={linkClass(activeSection === "providers")}>
          Proveedores
        </Link>
      </div>
    </nav>
  );
}
