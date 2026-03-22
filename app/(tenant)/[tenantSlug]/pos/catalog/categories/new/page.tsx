import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { createCategoryAction } from "@/actions/pos/catalog/categories.actions";
import { CategoryForm } from "@/components/pos/catalog/CategoryForm";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";

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
        <CatalogSectionHeader
          title="POS · Nueva categoría"
          description="Crea una categoría del catálogo operativo POS."
        />
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      </div>
    );
  }

  const listPath = `/${result.tenantSlug}/pos/catalog/categories`;

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS · Nueva categoría"
        description={`Organizacion: ${result.tenantName}`}
      />
      <CategoryForm
        action={createCategoryAction}
        tenantSlug={result.tenantSlug}
        cancelHref={listPath}
        submitLabel="Guardar categoría"
      />
    </div>
  );
}
