import Link from "next/link";
import { CatalogErrorState } from "@/components/pos/catalog/CatalogErrorState";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { CategoryList } from "@/components/pos/catalog/CategoryList";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import { listCatalogCategories } from "@/lib/pos/catalog/queries";

type CategoriesPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

type CatalogCategoriesPageResult =
  | {
      ok: true;
      categories: Awaited<ReturnType<typeof listCatalogCategories>>;
      tenantSlug: string;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

function isRedirectErrorLike(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }

  return String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");
}

async function loadCatalogCategoriesPageData(tenantSlug: string): Promise<CatalogCategoriesPageResult> {
  try {
    const tenant = await resolveTenantContextBySlug(tenantSlug);
    const categories = await listCatalogCategories({ tenantId: tenant.tenantId });

    return {
      ok: true,
      categories,
      tenantSlug: tenant.tenantSlug,
    };
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    return {
      ok: false,
      message: "No pudimos resolver el tenant o consultar el catálogo para este slug.",
      hint: "Valida el tenantSlug y vuelve a intentar.",
    };
  }
}

export default async function CatalogCategoriesPage({ params }: CategoriesPageProps) {
  const { tenantSlug } = await params;
  const result = await loadCatalogCategoriesPageData(tenantSlug);

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS Catalog · Categorías"
        description="Read-only view of tenant catalog categories."
      />
      {result.ok ? (
        <>
          <div className="flex justify-end">
            <Link
              href={`/${result.tenantSlug}/pos/admin/catalog/categories/new`}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
            >
              Nueva categoría
            </Link>
          </div>
          <CategoryList categories={result.categories} tenantSlug={result.tenantSlug} />
        </>
      ) : (
        <CatalogErrorState
          title="No fue posible cargar categorías"
          message={result.message}
          hint={result.hint}
        />
      )}
    </div>
  );
}
