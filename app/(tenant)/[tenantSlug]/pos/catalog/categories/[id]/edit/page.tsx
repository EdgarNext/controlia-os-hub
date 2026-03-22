import { notFound } from "next/navigation";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { updateCategoryAction } from "@/actions/pos/catalog/categories.actions";
import { CategoryForm } from "@/components/pos/catalog/CategoryForm";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import { getCatalogCategoryById } from "@/lib/pos/catalog/queries";

type CategoryEditPageProps = {
  params: Promise<{ tenantSlug: string; id: string }>;
};

type CategoryEditPageResult =
  | {
      ok: true;
      tenantSlug: string;
      tenantName: string;
      category: NonNullable<Awaited<ReturnType<typeof getCatalogCategoryById>>>;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

async function loadCategoryEditPage(tenantSlug: string, id: string): Promise<CategoryEditPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "categories", "manage");

    const category = await getCatalogCategoryById({
      tenantId: tenant.tenantId,
      id,
    });

    if (!category) {
      notFound();
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
        <CatalogSectionHeader
          title="POS · Editar categoría"
          description="Actualiza una categoría del catálogo POS."
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
        title="POS · Editar categoría"
        description={`Organizacion: ${result.tenantName}`}
      />
      <CategoryForm
        action={updateCategoryAction}
        tenantSlug={result.tenantSlug}
        categoryId={result.category.id}
        cancelHref={listPath}
        submitLabel="Guardar cambios"
        initialValues={{
          name: result.category.name,
          sort_order: result.category.sort_order,
          is_active: result.category.is_active,
        }}
      />
    </div>
  );
}
