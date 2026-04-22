import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { updateCategoryAction } from "@/actions/pos/catalog/categories.actions";
import { CategoryForm } from "@/components/pos/catalog/CategoryForm";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import { getCatalogCategoryById } from "@/lib/pos/catalog/queries";
import { getCatalogV2CategoriesPath } from "@/lib/pos/catalog-v2/paths";

type CategoryEditPageProps = {
  params: Promise<{ tenantSlug: string; id: string }>;
};

type CategoryEditPageResult =
  | {
      ok: true;
      tenantSlug: string;
      tenantName: string;
      category: Awaited<ReturnType<typeof getCatalogCategoryById>>;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

async function loadCategoryEditPage(tenantSlug: string, id: string): Promise<CategoryEditPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "categories", "manage");
    const category = await getCatalogCategoryById({ tenantId: tenant.tenantId, id });

    if (!category) {
      return {
        ok: false,
        message: "No encontramos esta categoría en el catálogo V2.",
        hint: "Valida el identificador y vuelve a intentar.",
      };
    }

    return {
      ok: true,
      tenantSlug: tenant.tenantSlug,
      tenantName: tenant.tenantName,
      category,
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "No tienes permisos para editar categorías en este tenant.",
        hint: "Solicita acceso de administrador u operador del tenant.",
      };
    }

    throw error;
  }
}

export default async function CategoryEditPage({ params }: CategoryEditPageProps) {
  const { tenantSlug, id } = await params;
  const result = await loadCategoryEditPage(tenantSlug, id);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <CatalogSectionHeader title="POS · Editar categoría V2" description="Edita el master data del flujo nuevo." />
        <StatePanel kind="error" title="Categoría no disponible" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      </div>
    );
  }

  const listPath = getCatalogV2CategoriesPath(result.tenantSlug);

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS · Editar categoría V2"
        description={`Organización: ${result.tenantName}. Ajusta el nombre o el orden sin salir de V2.`}
      />

      <Card className="space-y-2 border-border/80 bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Categoría actual</p>
        <p className="text-sm text-muted">
          {result.category?.name ?? "Sin nombre"} · orden {result.category?.sort_order ?? 0}
        </p>
      </Card>

      <CategoryForm
        action={updateCategoryAction}
        tenantSlug={result.tenantSlug}
        cancelHref={listPath}
        returnHref={listPath}
        categoryId={result.category?.id}
        submitLabel="Guardar categoría"
        initialValues={
          result.category
            ? {
                name: result.category.name,
                sort_order: result.category.sort_order,
                is_active: result.category.is_active,
              }
            : undefined
        }
      />
    </div>
  );
}
