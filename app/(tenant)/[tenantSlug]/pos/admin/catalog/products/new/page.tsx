import { assertTenantAdmin } from "@/app/(tenant)/lib/tenant-access";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { createProductAction } from "@/actions/pos/catalog/products.actions";
import { CatalogErrorState } from "@/components/pos/catalog/CatalogErrorState";
import { ProductForm } from "@/components/pos/catalog/ProductForm";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import { listCatalogCategoriesForSelect } from "@/lib/pos/catalog/queries";

type ProductNewPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

type ProductNewPageResult =
  | {
      ok: true;
      tenantSlug: string;
      tenantName: string;
      categories: Awaited<ReturnType<typeof listCatalogCategoriesForSelect>>;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

async function loadProductNewPage(tenantSlug: string): Promise<ProductNewPageResult> {
  try {
    const tenant = await resolveTenantContextBySlug(tenantSlug);
    await assertTenantAdmin(tenant.tenantId);
    const categories = await listCatalogCategoriesForSelect({ tenantId: tenant.tenantId });

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
        message: "No tienes permisos para crear productos en este tenant.",
        hint: "Solicita acceso de administrador del tenant.",
      };
    }

    throw error;
  }
}

export default async function ProductNewPage({ params }: ProductNewPageProps) {
  const { tenantSlug } = await params;
  const result = await loadProductNewPage(tenantSlug);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <CatalogSectionHeader
          title="POS Catalog · Nuevo producto"
          description="Crear producto tenant-scoped"
        />
        <CatalogErrorState title="Sin permisos" message={result.message} hint={result.hint} />
      </div>
    );
  }

  const listPath = `/${result.tenantSlug}/pos/admin/catalog/products`;

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS Catalog · Nuevo producto"
        description={`Tenant: ${result.tenantName}`}
      />
      <ProductForm
        action={createProductAction}
        tenantSlug={result.tenantSlug}
        cancelHref={listPath}
        categories={result.categories}
        submitLabel="Guardar producto"
      />
    </div>
  );
}
