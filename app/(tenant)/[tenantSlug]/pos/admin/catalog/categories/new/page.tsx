import { assertTenantAdmin } from "@/app/(tenant)/lib/tenant-access";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { createCategoryAction } from "@/actions/pos/catalog/categories.actions";
import { CategoryForm } from "@/components/pos/catalog/CategoryForm";
import { CatalogErrorState } from "@/components/pos/catalog/CatalogErrorState";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";

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
    const tenant = await resolveTenantContextBySlug(tenantSlug);
    await assertTenantAdmin(tenant.tenantId);

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
        hint: "Solicita acceso de administrador del tenant.",
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
          title="POS Catalog · Nueva categoría"
          description="Crear categoría tenant-scoped"
        />
        <CatalogErrorState title="Sin permisos" message={result.message} hint={result.hint} />
      </div>
    );
  }

  const listPath = `/${result.tenantSlug}/pos/admin/catalog/categories`;

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS Catalog · Nueva categoría"
        description={`Tenant: ${result.tenantName}`}
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
