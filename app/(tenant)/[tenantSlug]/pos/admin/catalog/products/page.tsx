import Link from "next/link";
import { CatalogErrorState } from "@/components/pos/catalog/CatalogErrorState";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { ProductList } from "@/components/pos/catalog/ProductList";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import { listCatalogProducts } from "@/lib/pos/catalog/queries";

type ProductsPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

type CatalogProductsPageResult =
  | {
      ok: true;
      products: Awaited<ReturnType<typeof listCatalogProducts>>;
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

async function loadCatalogProductsPageData(tenantSlug: string): Promise<CatalogProductsPageResult> {
  try {
    const tenant = await resolveTenantContextBySlug(tenantSlug);
    const products = await listCatalogProducts({ tenantId: tenant.tenantId });

    return {
      ok: true,
      products,
      tenantSlug: tenant.tenantSlug,
    };
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    return {
      ok: false,
      message: "No pudimos resolver el tenant o consultar productos para este slug.",
      hint: "Valida el tenantSlug y vuelve a intentar.",
    };
  }
}

export default async function CatalogProductsPage({ params }: ProductsPageProps) {
  const { tenantSlug } = await params;
  const result = await loadCatalogProductsPageData(tenantSlug);

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS Catalog · Productos"
        description="Create/Edit tenant catalog products."
      />
      {result.ok ? (
        <>
          <div className="flex justify-end">
            <Link
              href={`/${result.tenantSlug}/pos/admin/catalog/products/new`}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
            >
              Nuevo producto
            </Link>
          </div>
          <ProductList products={result.products} tenantSlug={result.tenantSlug} />
        </>
      ) : (
        <CatalogErrorState
          title="No fue posible cargar productos"
          message={result.message}
          hint={result.hint}
        />
      )}
    </div>
  );
}
