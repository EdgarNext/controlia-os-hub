import Link from "next/link";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { CategoryList } from "@/components/pos/catalog/CategoryList";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import { listCatalogCategories } from "@/lib/pos/catalog/queries";
import {
  getCatalogV2CategoryNewPath,
  getCatalogV2CategoryEditPath,
  getCatalogV2ModifiersPath,
  getCatalogV2ProductsPath,
} from "@/lib/pos/catalog-v2/paths";

type CategoriesPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

type CatalogV2CategoriesPageResult =
  | {
      ok: true;
      tenantSlug: string;
      tenantName: string;
      categories: Awaited<ReturnType<typeof listCatalogCategories>>;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

async function loadCatalogV2CategoriesPage(tenantSlug: string): Promise<CatalogV2CategoriesPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "categories", "read");
    const categories = await listCatalogCategories({ tenantId: tenant.tenantId });

    return {
      ok: true,
      tenantSlug: tenant.tenantSlug,
      tenantName: tenant.tenantName,
      categories,
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "No tienes permisos para consultar categorías en este tenant.",
        hint: "Solicita acceso al módulo sales_pos.",
      };
    }

    throw error;
  }
}

export default async function CatalogV2CategoriesPage({ params }: CategoriesPageProps) {
  const { tenantSlug } = await params;
  const result = await loadCatalogV2CategoriesPage(tenantSlug);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <CatalogSectionHeader
          title="POS · Categorías V2"
          description="Master data base del flujo nuevo."
        />
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      </div>
    );
  }

  const activeCategories = result.categories.filter((category) => category.deleted_at == null);

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS · Categorías V2"
        description={`Organización: ${result.tenantName}. Crea y ordena las categorías antes de abrir productos.`}
      />

      <Card className="space-y-3 border-border/80 bg-surface p-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Arranque recomendado</p>
          <p className="text-sm text-muted">
            Las categorías son el primer paso del onboarding del catálogo V2. Cuando estén listas, continúa con los
            productos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={getCatalogV2CategoryNewPath(result.tenantSlug)}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Nueva categoría
          </Link>
          <Link
            href={getCatalogV2ModifiersPath(result.tenantSlug)}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Ir a modificadores
          </Link>
          <Link
            href={getCatalogV2ProductsPath(result.tenantSlug)}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Ir a productos
          </Link>
        </div>
      </Card>

      {activeCategories.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Todavía no hay categorías"
          message="Crea la primera categoría para empezar a organizar el catálogo."
        >
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={getCatalogV2CategoryNewPath(result.tenantSlug)}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
            >
              Crear categoría
            </Link>
          </div>
        </StatePanel>
      ) : (
        <CategoryList
          categories={result.categories}
          tenantSlug={result.tenantSlug}
          editHrefBuilder={getCatalogV2CategoryEditPath}
        />
      )}
    </div>
  );
}
