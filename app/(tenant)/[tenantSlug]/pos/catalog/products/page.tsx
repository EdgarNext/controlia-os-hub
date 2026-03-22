import {
  importProductsCsvAction,
} from "@/actions/pos/catalog/products.actions";
import { CatalogCsvImportCard } from "@/components/pos/catalog/CatalogCsvImportCard";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { StatePanel } from "@/components/ui/state-panel";
import { ProductList } from "@/components/pos/catalog/ProductList";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import { listCatalogCategories, listCatalogProducts } from "@/lib/pos/catalog/queries";

type ProductsPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

type CatalogProductsPageResult =
  | {
      ok: true;
      products: Awaited<ReturnType<typeof listCatalogProducts>>;
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

async function loadCatalogProductsPageData(tenantSlug: string): Promise<CatalogProductsPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "products", "read");
    const [products, categories] = await Promise.all([
      listCatalogProducts({ tenantId: tenant.tenantId }),
      listCatalogCategories({ tenantId: tenant.tenantId }),
    ]);

    return {
      ok: true,
      products,
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
        message: "No tienes permisos para consultar productos POS en este tenant.",
        hint: "Solicita acceso de administrador u operador del tenant.",
      };
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
        title="POS · Productos"
        description="Gestiona productos del catálogo de alimentos y bebidas para POS."
      />
      {result.ok ? (
        <>
          <div className="flex justify-end">
            <a
              href={`/${result.tenantSlug}/pos/catalog/products/template.csv`}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
            >
              Descargar template CSV
            </a>
          </div>
          <CatalogCsvImportCard
            action={importProductsCsvAction}
            tenantSlug={result.tenantSlug}
            title="Carga masiva de productos"
            description="Columnas esperadas: nombre, categoría, Tipo (food/drink), precio e is_active."
          />
          <ProductList
            products={result.products}
            categories={result.categories}
            tenantSlug={result.tenantSlug}
          />
        </>
      ) : (
        <StatePanel
          kind="error"
          title="No fue posible cargar los productos"
          message={result.message}
        >
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      )}
    </div>
  );
}
