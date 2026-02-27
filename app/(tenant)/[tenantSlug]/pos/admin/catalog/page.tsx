import Link from "next/link";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";

const sections = [
  {
    path: "categories",
    title: "Categorías",
    description: "Consulta categorías tenant-scoped disponibles para el POS.",
  },
  {
    path: "products",
    title: "Productos",
    description: "Consulta productos tenant-scoped usados por sincronización POS.",
  },
];

type PosAdminCatalogPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function PosAdminCatalogPage({ params }: PosAdminCatalogPageProps) {
  const { tenantSlug } = await params;

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS Admin · Catalog"
        description="Read-only catalog views for categories and products."
      />

      <div className="grid gap-3 md:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.path}
            href={`/${tenantSlug}/pos/admin/catalog/${section.path}`}
            className="rounded-[var(--radius-base)] border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
          >
            <p className="text-sm font-semibold text-foreground">{section.title}</p>
            <p className="mt-2 text-sm text-muted">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
