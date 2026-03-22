import { notFound } from "next/navigation";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { updateProductAction } from "@/actions/pos/catalog/products.actions";
import { ProductForm } from "@/components/pos/catalog/ProductForm";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import { getCatalogProductById, listCatalogCategoriesForSelect } from "@/lib/pos/catalog/queries";

type ProductEditPageProps = {
  params: Promise<{ tenantSlug: string; id: string }>;
};

type ProductEditPageResult =
  | {
      ok: true;
      tenantSlug: string;
      tenantName: string;
      categories: Awaited<ReturnType<typeof listCatalogCategoriesForSelect>>;
      product: NonNullable<Awaited<ReturnType<typeof getCatalogProductById>>>;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

async function loadProductEditPage(tenantSlug: string, id: string): Promise<ProductEditPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "products", "manage");

    const [product, categories] = await Promise.all([
      getCatalogProductById({ tenantId: tenant.tenantId, id }),
      listCatalogCategoriesForSelect({ tenantId: tenant.tenantId }),
    ]);

    if (!product) {
      notFound();
    }

    return {
      ok: true,
      tenantSlug: tenant.tenantSlug,
      tenantName: tenant.tenantName,
      categories,
      product,
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "No tienes permisos para editar productos en este tenant.",
        hint: "Solicita acceso de administrador u operador del tenant.",
      };
    }

    throw error;
  }
}

export default async function ProductEditPage({ params }: ProductEditPageProps) {
  const { tenantSlug, id } = await params;
  const result = await loadProductEditPage(tenantSlug, id);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <CatalogSectionHeader
          title="POS · Editar producto"
          description="Actualiza un producto del catálogo POS."
        />
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      </div>
    );
  }

  const listPath = `/${result.tenantSlug}/pos/catalog/products`;

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS · Editar producto"
        description={`Organizacion: ${result.tenantName}`}
      />
      <ProductForm
        action={updateProductAction}
        tenantSlug={result.tenantSlug}
        productId={result.product.id}
        cancelHref={listPath}
        categories={result.categories}
        submitLabel="Guardar cambios"
        initialImagePath={result.product.image_path}
        initialValues={{
          name: result.product.name,
          category_id: result.product.category_id,
          class: result.product.class === "drink" ? "drink" : "food",
          price_cents: result.product.price_cents,
          is_active: result.product.is_active,
        }}
      />
      <div className="rounded-[var(--radius-base)] border border-border bg-surface p-3 text-sm text-muted">
        Variantes: pendiente de implementación en un iteracion posterior.
      </div>
    </div>
  );
}
