import Link from "next/link";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { importCategoriesCsvAction } from "@/actions/pos/catalog/categories.actions";
import { CatalogCsvImportCard } from "@/components/pos/catalog/CatalogCsvImportCard";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { CategoryList } from "@/components/pos/catalog/CategoryList";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
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
    const tenant = await resolveSalesPosPageContext(tenantSlug, "categories", "read");
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

    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "No tienes permisos para consultar categorías POS en este tenant.",
        hint: "Solicita acceso de administrador u operador del tenant.",
      };
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
        title="POS · Categorías"
        description="Master data compartido para el catálogo POS. Esta tabla alimenta tanto el flujo clásico como el nuevo flujo v2."
      />
      {result.ok ? (
        <>
          <Card className="space-y-2 border-border/80 bg-surface">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Contexto de la vista</p>
              <p className="text-sm text-muted">
                Las categorías no tienen una ruta v2 separada. Se mantienen como referencia compartida para productos,
                por eso esta pantalla conserva el CRUD clásico y se integra con ambos flujos.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/${result.tenantSlug}/pos/catalog/products`}
                className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
              >
                Ir a productos v2
              </Link>
            </div>
          </Card>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <a
              href={`/${result.tenantSlug}/pos/catalog/categories/template.csv`}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
            >
              Descargar template CSV
            </a>
            <Link
              href={`/${result.tenantSlug}/pos/catalog/categories/new`}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
            >
              Nueva categoría
            </Link>
          </div>
          <CatalogCsvImportCard
            action={importCategoriesCsvAction}
            tenantSlug={result.tenantSlug}
            title="Carga masiva de categorías"
            description="Usa el template CSV para crear o actualizar categorías por nombre."
          />
          <CategoryList categories={result.categories} tenantSlug={result.tenantSlug} />
        </>
      ) : (
        <StatePanel
          kind="error"
          title="No fue posible cargar las categorías"
          message={result.message}
        >
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      )}
    </div>
  );
}
