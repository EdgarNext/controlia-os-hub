import Link from "next/link";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { saveProductV2Action } from "@/actions/pos/catalog-v2.actions";
import { ProductV2Form } from "@/components/pos/catalog-v2/ProductV2Form";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import {
  listCatalogV2CategoriesForSelect,
} from "@/lib/pos/catalog-v2/queries";
import { getCatalogV2CategoriesPath, getCatalogV2CategoryNewPath, getCatalogV2ModifiersPath, getCatalogV2ProductsPath } from "@/lib/pos/catalog-v2/paths";

type ProductNewPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

type ProductNewPageResult =
  | {
      ok: true;
      tenantSlug: string;
      tenantName: string;
      categories: Awaited<ReturnType<typeof listCatalogV2CategoriesForSelect>>;
      hasCategories: boolean;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

async function loadProductNewPage(tenantSlug: string): Promise<ProductNewPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "products", "manage");
    const categories = await listCatalogV2CategoriesForSelect(tenant.tenantId);

    return {
      ok: true,
      tenantSlug: tenant.tenantSlug,
      tenantName: tenant.tenantName,
      categories,
      hasCategories: categories.length > 0,
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "No tienes permisos para crear productos en este tenant.",
        hint: "Solicita acceso de administrador u operador del tenant.",
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
        <CatalogSectionHeader title="POS · Nuevo producto V2" description="Alta de producto en el flujo nuevo." />
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      </div>
    );
  }

  const listPath = getCatalogV2ProductsPath(result.tenantSlug);

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS · Nuevo producto V2"
        description={`Organización: ${result.tenantName}. Crea el producto y luego entra a su detalle operativo.`}
      />

      <Card className="space-y-2 border-border/80 bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Paso 2</p>
        <p className="text-sm text-muted">
          Si todavía no tienes categorías, créalas primero. Si ya existen, puedes continuar con el producto y abrir
          después su detalle operativo.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={getCatalogV2CategoriesPath(result.tenantSlug)}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Ir a categorías
          </Link>
          <Link
            href={getCatalogV2ModifiersPath(result.tenantSlug)}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Ir a modificadores
          </Link>
          <Link
            href={listPath}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Volver a productos
          </Link>
        </div>
      </Card>

      {!result.hasCategories ? (
        <StatePanel
          kind="warning"
          title="Aún no hay categorías"
          message="Puedes crear productos sin categoría, pero el flujo recomendado es definir primero la estructura base."
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
      ) : null}

      <ProductV2Form
        action={saveProductV2Action}
        tenantSlug={result.tenantSlug}
        cancelHref={listPath}
        returnHref={listPath}
        categories={result.categories}
        defaultVariantOptions={[]}
        submitLabel="Crear producto"
      />
    </div>
  );
}
