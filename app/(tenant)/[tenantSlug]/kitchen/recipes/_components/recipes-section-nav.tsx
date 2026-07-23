import Link from "next/link";

export type RecipesSection = "recipes" | "costing" | "imports";

export function RecipesSectionNav({
  tenantSlug,
  activeSection,
}: {
  tenantSlug: string;
  activeSection: RecipesSection;
}) {
  const base = `/${tenantSlug}/kitchen/recipes`;
  const links: Array<{ href: string; label: string; section: RecipesSection }> = [
    { href: base, label: "Recetas", section: "recipes" },
    { href: `${base}/costing`, label: "Tablero de costeo", section: "costing" },
    { href: `${base}/imports`, label: "Importaciones de recetario", section: "imports" },
  ];
  const linkClass = (active: boolean) =>
    `inline-flex min-h-10 items-center rounded-[var(--radius-base)] border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? "border-primary bg-primary/10 text-foreground" : "border-transparent text-muted hover:border-border hover:bg-surface-2 hover:text-foreground"}`;

  return (
    <nav aria-label="Secciones de recetas" className="rounded-[var(--radius-base)] border border-border bg-surface p-1">
      <div className="flex flex-wrap gap-1">
        {links.map((link) => (
          <Link key={link.section} href={link.href} aria-current={activeSection === link.section ? "page" : undefined} className={linkClass(activeSection === link.section)}>
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
