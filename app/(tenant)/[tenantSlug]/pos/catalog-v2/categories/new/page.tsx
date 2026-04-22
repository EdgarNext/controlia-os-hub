import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { createCategoryAction } from "@/actions/pos/catalog/categories.actions";
import { CategoryForm } from "@/components/pos/catalog/CategoryForm";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import { getCatalogV2CategoriesPath, getCatalogV2ProductsPath } from "@/lib/pos/catalog-v2/paths";

type CategoryNewPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

type CategoryNewPageResult =
  | {
      ok: true;
      tenantSlug: string;
      tenantName: string;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

async function loadCategoryNewPage(tenantSlug: string): Promise<CategoryNewPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "categories", "manage");

    return {
      ok: true,
      tenantSlug: tenant.tenantSlug,
      tenantName: tenant.tenantName,
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "No tienes permisos para crear categorías en este tenant.",
        hint: "Solicita acceso de administrador u operador del tenant.",
      };
    }

    throw error;
  }
}

export default async function CategoryNewPage({ params }: CategoryNewPageProps) {
  const { tenantSlug } = await params;
  const result = await loadCategoryNewPage(tenantSlug);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <CatalogSectionHeader title="POS · Nueva categoría V2" description="Alta de master data para el flujo nuevo." />
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      </div>
    );
  }

  const listPath = getCatalogV2CategoriesPath(result.tenantSlug);

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS · Nueva categoría V2"
        description={`Organización: ${result.tenantName}. Crea la base del catálogo antes de entrar a productos.`}
      />

      <Card className="space-y-2 border-border/80 bg-surface p-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Paso 1</p>
          <p className="text-sm text-muted">
            Esta categoría quedará disponible para el flujo de productos V2 inmediatamente después de guardarla.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={getCatalogV2ProductsPath(result.tenantSlug)}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Ir a productos
          </a>
        </div>
      </Card>

      <CategoryForm
        action={createCategoryAction}
        tenantSlug={result.tenantSlug}
        cancelHref={listPath}
        returnHref={listPath}
        submitLabel="Guardar categoría"
      />
    </div>
  );
}
